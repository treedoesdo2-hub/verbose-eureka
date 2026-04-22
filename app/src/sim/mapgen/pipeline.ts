import type { BiomeId, TerrainKind } from '@schema/map';
import { fbm2D, hashStringToSeed, makeRng, subRng } from './noise';
import type { DeployZone, MapGenRequest, MapGenResult, ObjectiveAnchor } from './types';
import { WALK_FOOT, WALK_PRONE_ONLY, WALK_WHEELED } from './types';

// Terrain byte codes — must match TERRAIN_KINDS in sim/world.ts.
const T = {
  open: 0,
  road: 1,
  building: 2,
  forest: 3,
  water: 4,
  rubble: 5,
} as const satisfies Record<TerrainKind, number>;

type BiomeDef = {
  // (elevation, fertility) → terrain preference bands.
  paint(elev: number, fert: number, rng01: number): TerrainKind;
  // Density targets per 10k cells.
  buildingClusters: number;
  buildingClusterSize: [number, number]; // min, max
  forestClusters: number;
  roadDensity: number; // 0..1
};

const BIOMES: Record<BiomeId, BiomeDef> = {
  urban_sparse: {
    paint(elev, fert) {
      if (elev < 0.18) return 'water';
      if (fert > 0.72) return 'forest';
      return 'open';
    },
    buildingClusters: 45,
    buildingClusterSize: [3, 7],
    forestClusters: 6,
    roadDensity: 0.55,
  },
  rural_open: {
    paint(elev, fert) {
      if (elev < 0.15) return 'water';
      if (fert > 0.62) return 'forest';
      return 'open';
    },
    buildingClusters: 8,
    buildingClusterSize: [2, 4],
    forestClusters: 18,
    roadDensity: 0.2,
  },
  mixed: {
    paint(elev, fert) {
      if (elev < 0.16) return 'water';
      if (fert > 0.68) return 'forest';
      return 'open';
    },
    buildingClusters: 22,
    buildingClusterSize: [2, 6],
    forestClusters: 12,
    roadDensity: 0.35,
  },
};

export function runPipeline(req: MapGenRequest): MapGenResult {
  const W = req.size;
  const H = req.size;
  const N = W * H;
  const seedBase = hashStringToSeed(req.seed);

  const terrain = new Uint8Array(N);
  const elevation = new Float32Array(N);
  const walkability = new Uint8Array(N);
  const coverValue = new Uint8Array(N);
  const structureHeight = new Uint8Array(N);

  const biomeDef = BIOMES[req.biome];

  // ---- Step: elevation (one fBm field, normalized) ----
  {
    const seed = subRng(seedBase, 'elevation-seed')();
    const s = ((seed * 0xffffffff) | 0) >>> 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = fbm2D(x, y, 0.021, 5, s, W);
        elevation[y * W + x] = v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const range = max - min || 1;
    for (let i = 0; i < N; i++) elevation[i] = (elevation[i] - min) / range;
  }

  // ---- Step: fertility (second fBm, used for paint only) ----
  const fertility = new Float32Array(N);
  {
    const s = hashStringToSeed(`${req.seed}:fertility`);
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = fbm2D(x, y, 0.014, 4, s, W);
        fertility[y * W + x] = v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const range = max - min || 1;
    for (let i = 0; i < N; i++) fertility[i] = (fertility[i] - min) / range;
  }

  // ---- Step: biome paint ----
  {
    const paintRng = subRng(seedBase, 'biome-paint');
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const kind = biomeDef.paint(elevation[i], fertility[i], paintRng());
        terrain[i] = T[kind];
      }
    }
  }

  // ---- Step: remove small islands (post-paint, per-terrain connectivity).
  // Keep only water components >= 0.2% of map area; smaller get filled to open.
  removeSmallWaterIslands(terrain, W, H, Math.max(32, Math.floor(N * 0.002)));

  // ---- Step: road skeleton (grid cross through the map center, density-gated).
  if (biomeDef.roadDensity > 0) {
    stampRoadSkeleton(terrain, W, H, biomeDef.roadDensity, seedBase);
  }

  // ---- Step: building clusters (scatter, rejection sampling on open/road).
  scatterBuildingClusters(
    terrain,
    structureHeight,
    W,
    H,
    biomeDef.buildingClusters,
    biomeDef.buildingClusterSize,
    seedBase,
  );

  // ---- Step: forest clusters (scatter on open/existing-forest).
  scatterForestClusters(terrain, W, H, biomeDef.forestClusters, seedBase);

  // ---- Step: walkability + cover bake ----
  for (let i = 0; i < N; i++) {
    const t = terrain[i];
    if (t === T.building || t === T.water) {
      walkability[i] = 0;
    } else if (t === T.forest) {
      walkability[i] = WALK_FOOT | WALK_PRONE_ONLY;
    } else if (t === T.rubble) {
      walkability[i] = WALK_FOOT | WALK_PRONE_ONLY;
    } else {
      walkability[i] = WALK_FOOT | WALK_WHEELED;
    }
    coverValue[i] = t === T.building ? 70 : t === T.forest ? 30 : t === T.rubble ? 20 : 0;
  }

  // ---- Step: deploy zones + objective anchors ----
  const { team0, team1 } = pickDeployZones(W, H);
  ensureZoneWalkable(terrain, walkability, W, H, team0);
  ensureZoneWalkable(terrain, walkability, W, H, team1);

  // ---- Step: reachability sanity — carve a corridor if team0 and team1
  //       deploy zones are not reachable via foot-walkable terrain.
  if (!zonesReachable(walkability, W, H, team0, team1)) {
    carveCorridor(terrain, walkability, W, H, team0, team1);
  }

  const objectiveAnchors: ObjectiveAnchor[] = [
    {
      kindHint: 'eliminate',
      rect: { x: 0, y: 0, w: W, h: H },
      qualityScore: 1,
    },
    {
      kindHint: 'extract',
      rect: { x: team1.x, y: team1.y, w: team1.w, h: team1.h },
      qualityScore: 0.8,
    },
    {
      kindHint: 'secure',
      rect: {
        x: Math.floor(W / 2) - 8,
        y: Math.floor(H / 2) - 8,
        w: 16,
        h: 16,
      },
      qualityScore: 0.7,
    },
    {
      kindHint: 'defend',
      rect: { x: team0.x, y: team0.y, w: team0.w, h: team0.h },
      qualityScore: 0.9,
    },
  ];

  // ---- Determinism hash ----
  const hash = hashBuffer(terrain);

  return {
    request: req,
    width: W,
    height: H,
    terrain,
    elevation,
    walkability,
    coverValue,
    structureHeight,
    deployZones: { team0, team1 },
    objectiveAnchors,
    hash,
  };
}

function removeSmallWaterIslands(terrain: Uint8Array, W: number, H: number, minSize: number): void {
  const N = W * H;
  const visited = new Uint8Array(N);
  const stack = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    if (visited[i] || terrain[i] !== T.water) continue;
    let top = 0;
    stack[top++] = i;
    const component: number[] = [];
    while (top > 0) {
      const p = stack[--top];
      if (visited[p]) continue;
      visited[p] = 1;
      if (terrain[p] !== T.water) continue;
      component.push(p);
      const x = p % W;
      const y = (p - x) / W;
      if (x > 0) stack[top++] = p - 1;
      if (x < W - 1) stack[top++] = p + 1;
      if (y > 0) stack[top++] = p - W;
      if (y < H - 1) stack[top++] = p + W;
    }
    if (component.length < minSize) {
      for (const p of component) terrain[p] = T.open;
    }
  }
}

function stampRoadSkeleton(
  terrain: Uint8Array,
  W: number,
  H: number,
  density: number,
  seed: number,
): void {
  const rng = makeRng(seed ^ 0xa5a5a5a5);
  // Always paint a cardinal cross.
  const midX = Math.floor(W / 2);
  const midY = Math.floor(H / 2);
  for (let x = 0; x < W; x++) {
    const i = midY * W + x;
    if (terrain[i] === T.open) terrain[i] = T.road;
    if (midY > 0 && terrain[i - W] === T.open) terrain[i - W] = T.road;
  }
  for (let y = 0; y < H; y++) {
    const i = y * W + midX;
    if (terrain[i] === T.open) terrain[i] = T.road;
    if (midX > 0 && terrain[i - 1] === T.open) terrain[i - 1] = T.road;
  }
  // Secondary perpendicular branches.
  const branches = Math.max(1, Math.floor(density * 8));
  for (let b = 0; b < branches; b++) {
    if (rng() < 0.5) {
      const y = Math.floor(rng() * H);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (terrain[i] === T.open) terrain[i] = T.road;
      }
    } else {
      const x = Math.floor(rng() * W);
      for (let y = 0; y < H; y++) {
        const i = y * W + x;
        if (terrain[i] === T.open) terrain[i] = T.road;
      }
    }
  }
}

function scatterBuildingClusters(
  terrain: Uint8Array,
  structureHeight: Uint8Array,
  W: number,
  H: number,
  per10k: number,
  sizeRange: readonly [number, number],
  seed: number,
): void {
  const area = W * H;
  const target = Math.floor((per10k * area) / 10000);
  const rng = makeRng(seed ^ 0x123456);
  let placed = 0;
  let tries = 0;
  const maxTries = target * 20;
  while (placed < target && tries < maxTries) {
    tries++;
    const cx = Math.floor(rng() * W);
    const cy = Math.floor(rng() * H);
    const sw = sizeRange[0] + Math.floor(rng() * (sizeRange[1] - sizeRange[0] + 1));
    const sh = sizeRange[0] + Math.floor(rng() * (sizeRange[1] - sizeRange[0] + 1));
    const x0 = cx - (sw >> 1);
    const y0 = cy - (sh >> 1);
    if (x0 < 1 || y0 < 1 || x0 + sw >= W - 1 || y0 + sh >= H - 1) continue;
    // Reject if overlaps water or existing building.
    let ok = true;
    for (let yy = y0; yy < y0 + sh && ok; yy++) {
      for (let xx = x0; xx < x0 + sw; xx++) {
        const i = yy * W + xx;
        const t = terrain[i];
        if (t === T.water || t === T.building) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) continue;
    const height = 3 + Math.floor(rng() * 4);
    for (let yy = y0; yy < y0 + sh; yy++) {
      for (let xx = x0; xx < x0 + sw; xx++) {
        const i = yy * W + xx;
        terrain[i] = T.building;
        structureHeight[i] = height;
      }
    }
    placed++;
  }
}

function scatterForestClusters(
  terrain: Uint8Array,
  W: number,
  H: number,
  per10k: number,
  seed: number,
): void {
  const area = W * H;
  const target = Math.floor((per10k * area) / 10000);
  const rng = makeRng(seed ^ 0x9abcdef);
  let placed = 0;
  let tries = 0;
  const maxTries = target * 10;
  while (placed < target && tries < maxTries) {
    tries++;
    const cx = Math.floor(rng() * W);
    const cy = Math.floor(rng() * H);
    const radius = 3 + Math.floor(rng() * 4);
    let anyPlaced = false;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = yy * W + xx;
        if (terrain[i] === T.open) {
          terrain[i] = T.forest;
          anyPlaced = true;
        }
      }
    }
    if (anyPlaced) placed++;
  }
}

function pickDeployZones(W: number, H: number): { team0: DeployZone; team1: DeployZone } {
  const zw = Math.max(8, Math.floor(W * 0.12));
  const zh = Math.max(8, Math.floor(H * 0.12));
  const team0: DeployZone = {
    x: Math.floor((W - zw) / 2),
    y: H - zh - 2,
    w: zw,
    h: zh,
  };
  const team1: DeployZone = {
    x: Math.floor((W - zw) / 2),
    y: 2,
    w: zw,
    h: zh,
  };
  return { team0, team1 };
}

function ensureZoneWalkable(
  terrain: Uint8Array,
  walkability: Uint8Array,
  W: number,
  _H: number,
  zone: DeployZone,
): void {
  for (let yy = zone.y; yy < zone.y + zone.h; yy++) {
    for (let xx = zone.x; xx < zone.x + zone.w; xx++) {
      const i = yy * W + xx;
      if (terrain[i] === T.building || terrain[i] === T.water) {
        terrain[i] = T.open;
      }
      walkability[i] = WALK_FOOT | WALK_WHEELED;
    }
  }
}

// BFS from the team0 zone center to test if the team1 zone center is
// reachable through foot-walkable terrain. Returns true if reachable.
function zonesReachable(
  walkability: Uint8Array,
  W: number,
  H: number,
  team0: DeployZone,
  team1: DeployZone,
): boolean {
  const start = {
    x: Math.floor(team0.x + team0.w / 2),
    y: Math.floor(team0.y + team0.h / 2),
  };
  const goal = {
    x: Math.floor(team1.x + team1.w / 2),
    y: Math.floor(team1.y + team1.h / 2),
  };
  const visited = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let head = 0;
  let tail = 0;
  queue[tail++] = start.y * W + start.x;
  visited[start.y * W + start.x] = 1;
  while (head < tail) {
    const p = queue[head++];
    const x = p % W;
    const y = (p - x) / W;
    if (x === goal.x && y === goal.y) return true;
    const neighbors = [
      x > 0 ? p - 1 : -1,
      x < W - 1 ? p + 1 : -1,
      y > 0 ? p - W : -1,
      y < H - 1 ? p + W : -1,
    ];
    for (const n of neighbors) {
      if (n < 0 || visited[n]) continue;
      if ((walkability[n] & WALK_FOOT) === 0) continue;
      visited[n] = 1;
      queue[tail++] = n;
    }
  }
  return false;
}

// Straight-line carve through buildings/water to guarantee a passable
// corridor between the two zones. Ugly but correct.
function carveCorridor(
  terrain: Uint8Array,
  walkability: Uint8Array,
  W: number,
  H: number,
  team0: DeployZone,
  team1: DeployZone,
): void {
  const x0 = Math.floor(team0.x + team0.w / 2);
  const y0 = Math.floor(team0.y + team0.h / 2);
  const x1 = Math.floor(team1.x + team1.w / 2);
  const y1 = Math.floor(team1.y + team1.h / 2);
  let x = x0;
  let y = y0;
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  while (x !== x1 || y !== y1) {
    if (x !== x1) x += dx;
    else if (y !== y1) y += dy;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const xx = x + ox;
        const yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = yy * W + xx;
        const t = terrain[i];
        if (t === T.building || t === T.water) {
          terrain[i] = T.road;
          walkability[i] = WALK_FOOT | WALK_WHEELED;
        }
      }
    }
  }
}

function hashBuffer(buf: Uint8Array): number {
  let h = 0x811c9dc5;
  // Sample every 17th byte — full-buffer hash at 4096² is expensive, stride
  // hash is sufficient for determinism regression catch.
  for (let i = 0; i < buf.length; i += 17) {
    h ^= buf[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
