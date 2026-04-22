import type { BiomeId, PointObjectKind, TerrainBase } from '@schema/map';
import {
  BARRIER_AXES,
  BASE_AXES,
  type BuildingRecord,
  ELEVATION_STEPS,
  POINT_AXES,
  WALK_FOOT,
  WALK_INFANTRY_MASK,
  WALK_MECH,
  WALK_POWER_ARMOR,
  WALK_PRONE,
  WALK_SLOW,
  WALK_TRACKED,
  WALK_WHEELED,
  baseToByte,
  byteToBase,
  byteToPoint,
  pointToByte,
  quantizeElevationNorm,
} from '../world';
import { pickCapillaries, stampCapillary } from './capillary';
import { makeDebugSink } from './debug-sink';
import { DENSITY_PROFILES, generateCoverDensity } from './density-field';
import { extractHotspots, type Hotspot } from './density-scatter';
import type { DominantCapillary, DominantLine } from './dominant-line';
import { pickLineKind } from './dominant-line';
import { logPlacerRun } from './debug/spawn-placer-log';
import { enforceReachability } from './enforce-reachability';
import { footprintFor, pickLandmarkKind, placeLandmark, type HeroLandmark } from './hero-landmark';
import { generateLandmarkName } from './landmark-names';
import { fbm2D, hashStringToSeed, makeRng, subRng } from './noise';
import { resampleObjectiveAroundBisector } from './objective-resample';
import { pruneByThresholdTable } from './prune-by-threshold';
import { buildDominantLine, stampLine } from './route-line';
import { placeSpawns } from './spawn-placer';
import type {
  DeployZone,
  MapGenDiagnostics,
  MapGenRequest,
  MapGenResult,
  ObjectiveAnchor,
  RosterSpec,
} from './types';

const DEFAULT_ROSTER: RosterSpec = { squadCount: 2, unitCount: 8 };

// Base-kind byte shortcuts (match world.ts BASE_KINDS order).
const B = {
  open: baseToByte('open'),
  road: baseToByte('road'),
  water_shallow: baseToByte('water_shallow'),
  water_deep: baseToByte('water_deep'),
  mud: baseToByte('mud'),
  rubble_ground: baseToByte('rubble_ground'),
  snow: baseToByte('snow'),
  sand: baseToByte('sand'),
} as const;

type BiomeDef = {
  // (elevation, fertility) → base surface preference.
  paint(elev: number, fert: number, rng01: number): TerrainBase;
  // Density targets per 10k cells.
  buildingClusters: number;
  buildingClusterSize: [number, number];
  forestClusters: number;
  roadDensity: number;
};

const BIOMES: Record<BiomeId, BiomeDef> = {
  urban_sparse: {
    paint(elev, fert) {
      if (elev < 0.18) return 'water_deep';
      if (fert > 0.72) return 'open'; // forest added later via point scatter
      return 'open';
    },
    buildingClusters: 45,
    buildingClusterSize: [3, 7],
    forestClusters: 6,
    roadDensity: 0.55,
  },
  rural_open: {
    paint(elev, fert) {
      if (elev < 0.15) return 'water_deep';
      if (fert > 0.62) return 'open';
      return 'open';
    },
    buildingClusters: 8,
    buildingClusterSize: [2, 4],
    forestClusters: 18,
    roadDensity: 0.2,
  },
  mixed: {
    paint(elev, fert) {
      if (elev < 0.16) return 'water_deep';
      if (fert > 0.68) return 'open';
      return 'open';
    },
    buildingClusters: 22,
    buildingClusterSize: [2, 6],
    forestClusters: 12,
    roadDensity: 0.35,
  },
  // Deferred biomes stubbed with the mixed profile.
  urban_dense: {
    paint(elev) {
      return elev < 0.16 ? 'water_deep' : 'open';
    },
    buildingClusters: 90,
    buildingClusterSize: [3, 8],
    forestClusters: 2,
    roadDensity: 0.7,
  },
  industrial: {
    paint(elev) {
      return elev < 0.16 ? 'water_deep' : 'open';
    },
    buildingClusters: 60,
    buildingClusterSize: [5, 10],
    forestClusters: 2,
    roadDensity: 0.5,
  },
  forest: {
    paint(elev) {
      if (elev < 0.15) return 'water_deep';
      return 'open';
    },
    buildingClusters: 3,
    buildingClusterSize: [2, 3],
    forestClusters: 40,
    roadDensity: 0.1,
  },
  arid: {
    paint(elev, fert) {
      if (elev < 0.12) return 'sand';
      return fert < 0.3 ? 'sand' : 'open';
    },
    buildingClusters: 12,
    buildingClusterSize: [2, 5],
    forestClusters: 2,
    roadDensity: 0.25,
  },
  rural_village: {
    paint(elev) {
      if (elev < 0.15) return 'water_deep';
      return 'open';
    },
    buildingClusters: 18,
    buildingClusterSize: [2, 5],
    forestClusters: 14,
    roadDensity: 0.3,
  },
};

// COA-1 task #45 — retry harness. Generators that fail the sanity check
// (e.g., deploy zones unreachable without heavy carving, zero hotspots on
// a biome that requires them, fewer than N objective anchors) get a
// re-roll with a perturbed seed. Bounded at MAX_PIPELINE_RETRIES attempts
// so a pathological seed doesn't loop forever.
const MAX_PIPELINE_RETRIES = 3;

export function runPipelineWithRetry(req: MapGenRequest): MapGenResult {
  let lastFailure: string | null = null;
  for (let attempt = 0; attempt < MAX_PIPELINE_RETRIES; attempt++) {
    const attemptReq =
      attempt === 0 ? req : { ...req, seed: `${req.seed}:retry${attempt}` };
    const r = runPipelineCore(attemptReq);
    const problems = sanityCheckMap(r);
    if (problems.length === 0) {
      return {
        ...r,
        diagnostics: { ...r.diagnostics, retryCount: attempt },
      };
    }
    lastFailure = problems.join('; ');
  }
  // Out of retries — return a last-chance attempt with a note in the
  // diagnostics so callers can see it came back degraded. We still emit
  // a usable map; the sanity failures are informational.
  const last = runPipelineCore({ ...req, seed: `${req.seed}:retry-final` });
  return {
    ...last,
    diagnostics: {
      ...last.diagnostics,
      retryCount: MAX_PIPELINE_RETRIES,
      // Pack the failure summary into the existing counter so we don't need
      // a new schema field just for this. Zero is the normal value.
      hotspotsDropped: last.diagnostics.hotspotsDropped + (lastFailure ? 1 : 0),
    },
  };
}

// Sanity checks — return a list of problem strings. Empty list = map is
// good to ship. Keep the checks cheap; the pipeline already does heavy
// validation internally.
function sanityCheckMap(r: MapGenResult): string[] {
  const problems: string[] = [];
  if (r.objectiveAnchors.length < 3) {
    problems.push(`only ${r.objectiveAnchors.length} objective anchors`);
  }
  const dz = r.deployZones;
  if (dz.team0.w < 4 || dz.team0.h < 4) problems.push('team0 zone too small');
  if (dz.team1.w < 4 || dz.team1.h < 4) problems.push('team1 zone too small');
  // Excessive carving implies the pipeline struggled to produce a map
  // with organic connectivity — a re-roll is preferable. Tolerance scales
  // with map size so small maps don't spuriously retry.
  const maxCarve = Math.max(64, Math.floor((r.width * r.height) * 0.02));
  if (r.diagnostics.carvedCells > maxCarve) {
    problems.push(`carveCorridor touched ${r.diagnostics.carvedCells} cells (budget ${maxCarve})`);
  }
  return problems;
}

export function runPipeline(req: MapGenRequest): MapGenResult {
  return runPipelineCore(req);
}

function runPipelineCore(req: MapGenRequest): MapGenResult {
  const W = req.size;
  const H = req.size;
  const N = W * H;
  const seedBase = hashStringToSeed(req.seed);

  // Per-tile grids (ADR 012).
  const base = new Uint8Array(N);
  const point = new Uint8Array(N);
  const edgeN = new Uint8Array(N);
  const edgeW = new Uint8Array(N);
  const edgeOverrideN = new Uint8Array(N);
  const edgeOverrideW = new Uint8Array(N);
  const buildingId = new Uint16Array(N);
  const walkability = new Uint16Array(N);
  const coverProfile = new Uint8Array(N);
  const elevationStep = new Uint8Array(N);
  const structureHeight = new Uint8Array(N);
  const hpN = new Uint16Array(N);
  const hpW = new Uint16Array(N);
  const hpPoint = new Uint16Array(N);

  const elevation = new Float32Array(N);
  const fertility = new Float32Array(N);
  const coverDensity = new Float32Array(N);
  const buildings: BuildingRecord[] = [];

  const biomeDef = BIOMES[req.biome];

  // ---- Step: elevation fBm (continuous), quantized to step (COA-8) ----
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
    for (let i = 0; i < N; i++) {
      const norm = (elevation[i] - min) / range;
      elevation[i] = norm;
      elevationStep[i] = quantizeElevationNorm(norm);
    }
  }

  // ---- Step: fertility fBm (continuous, paint-driver) ----
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

  // ---- Step: biome paint → base surface ----
  {
    const paintRng = subRng(seedBase, 'biome-paint');
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const kind = biomeDef.paint(elevation[i], fertility[i], paintRng());
        base[i] = baseToByte(kind);
      }
    }
  }

  // ---- Step: remove small water islands ----
  const prunedClusters = removeSmallBaseIslands(
    base,
    W,
    H,
    B.water_deep,
    B.open,
    Math.max(32, Math.floor(N * 0.002)),
  );

  // ---- Step: dominant line (COA-4 task #93, replaces stampRoadSkeleton) ----
  let dominantLine: DominantLine | null = null;
  const capillaries: DominantCapillary[] = [];
  if (biomeDef.roadDensity > 0) {
    const lineRng = subRng(seedBase, 'dominant-line');
    const lineKind = pickLineKind(req.biome, lineRng);
    dominantLine = buildDominantLine(
      lineKind,
      W,
      H,
      elevationStep,
      new Float32Array(N), // density not yet computed — passed empty; highstreet falls back
      lineRng,
    );
    stampLine(dominantLine, base, W, H);
    // Capillaries — 0-3 perpendicular branches.
    const caps = pickCapillaries(dominantLine, lineRng, W, H);
    for (const c of caps) {
      stampCapillary(c, base, W, H);
      capillaries.push(c);
    }
  }

  // ---- Step: building clusters ----
  scatterBuildingClusters(
    base,
    structureHeight,
    buildingId,
    buildings,
    W,
    H,
    biomeDef.buildingClusters,
    biomeDef.buildingClusterSize,
    seedBase,
  );

  // ---- Step: forest (scatter tree_forest + bush_medium points) ----
  scatterForestClusters(
    base,
    point,
    hpPoint,
    fertility,
    W,
    H,
    biomeDef.forestClusters,
    seedBase,
  );

  // ---- Step: threshold-driven pruning sweep (COA-3) ----
  // Removes single-tile "chicken pox" scatter + elongated strips from the
  // post-scatter output, rebuilding the walkability mask afterward.
  const debugSink = makeDebugSink();
  const pruneReports = pruneByThresholdTable(
    base,
    point,
    W,
    H,
    (kind) => baseToByte(kind),
    (kind) => pointToByte(kind),
  );
  let totalPrunedClusters = 0;
  for (const k of Object.keys(pruneReports)) {
    totalPrunedClusters += pruneReports[k].clustersPruned;
  }
  if (totalPrunedClusters > 0) {
    debugSink.info('prune', 'threshold-driven sweep complete', {
      totalClustersPruned: totalPrunedClusters,
    });
  }

  // ---- Step: walkability + cover bake ----
  bakeWalkabilityAndCover(base, point, buildingId, walkability, coverProfile, N);

  // ---- Step: COA-5 spawn placer ----
  // Build provisional objective anchors from map center + quadrant seeds.
  // The placer uses these to derive the combat axis; we then resample
  // them around the team bisector (see further down).
  let objectiveAnchors: ObjectiveAnchor[] = [
    {
      kindHint: 'extract',
      rect: {
        x: Math.floor(W / 2) - 8,
        y: Math.floor(H / 4) - 4,
        w: 16,
        h: 8,
      },
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
      rect: {
        x: Math.floor(W / 2) - 8,
        y: Math.floor(H * 3 / 4) - 4,
        w: 16,
        h: 8,
      },
      qualityScore: 0.9,
    },
  ];

  const placerResult = placeSpawns({
    W,
    H,
    tileSizeMeters: req.tileSizeMeters,
    walkability,
    elevationStep,
    objectiveAnchors,
    regime: req.spawnRegime ?? 'meeting',
    rosterTeam0: req.rosterTeam0 ?? DEFAULT_ROSTER,
    rosterTeam1: req.rosterTeam1 ?? DEFAULT_ROSTER,
  });
  const team0: DeployZone = placerResult.team0;
  const team1: DeployZone = placerResult.team1;
  logPlacerRun(debugSink, {
    W,
    H,
    tileSizeMeters: req.tileSizeMeters,
    walkability,
    elevationStep,
    objectiveAnchors,
    regime: req.spawnRegime ?? 'meeting',
    rosterTeam0: req.rosterTeam0 ?? DEFAULT_ROSTER,
    rosterTeam1: req.rosterTeam1 ?? DEFAULT_ROSTER,
  }, placerResult);

  ensureZoneWalkable(base, buildingId, point, walkability, elevationStep, W, team0);
  ensureZoneWalkable(base, buildingId, point, walkability, elevationStep, W, team1);

  // Resample objective anchors around the spawn placer's bisector so
  // both teams have similar travel distance to each objective.
  objectiveAnchors = resampleObjectiveAroundBisector({
    anchors: objectiveAnchors,
    team0,
    team1,
    regime: req.spawnRegime ?? 'meeting',
    walkability,
    W,
    H,
  });

  // ---- Step: reachability sanity carve (COA-3 enforceReachability) ----
  let carvedCells = 0;
  if (!zonesReachable(walkability, W, H, team0, team1)) {
    carvedCells = carveCorridor(base, point, buildingId, walkability, W, H, team0, team1);
  }
  // Extra safety net — ensure team0 → team1 + team0 → objective centre
  // connectivity via the new reachability enforcer. On an already-reachable
  // map this is a fast BFS + no carving.
  const reachReport = enforceReachability(
    walkability,
    base,
    point,
    buildingId,
    W,
    H,
    [
      { label: 'team0', seedTileX: Math.floor(team0.x + team0.w / 2), seedTileY: Math.floor(team0.y + team0.h / 2) },
      { label: 'team1', seedTileX: Math.floor(team1.x + team1.w / 2), seedTileY: Math.floor(team1.y + team1.h / 2) },
      { label: 'objective', seedTileX: Math.floor(W / 2), seedTileY: Math.floor(H / 2) },
    ],
    B.open,
    debugSink,
  );
  carvedCells += reachReport.carvedTiles;

  // COA-1 density field generation — populate coverDensity from the biome
  // profile. Deploy zones and center objective are masked out so hotspots
  // cannot land in spawn areas or on the objective anchor (prevents
  // "cover cluster landed on top of team 0" regressions).
  const densityProfile = DENSITY_PROFILES[req.biome];
  const hotspots: Hotspot[] = [];
  let hotspotsDropped = 0;
  if (densityProfile) {
    const generated = generateCoverDensity(
      densityProfile,
      W,
      H,
      elevation,
      fertility,
      seedBase,
    );
    // Mask deploy zones (and a 2-tile buffer) + the central objective.
    maskZoneInDensity(generated, W, team0, 2);
    maskZoneInDensity(generated, W, team1, 2);
    maskZoneInDensity(
      generated,
      W,
      {
        x: Math.floor(W / 2) - 8,
        y: Math.floor(H / 2) - 8,
        w: 16,
        h: 16,
      },
      1,
    );
    coverDensity.set(generated);
    for (const h of extractHotspots(coverDensity, W, H)) hotspots.push(h);
    // Drop hotspots that still land inside deploy / objective zones (shouldn't
    // happen after masking but keeps the invariant robust under future edits).
    const keepHotspots: Hotspot[] = [];
    for (const h of hotspots) {
      if (insideZone(h, team0) || insideZone(h, team1)) {
        hotspotsDropped++;
        continue;
      }
      keepHotspots.push(h);
    }
    hotspots.length = 0;
    hotspots.push(...keepHotspots);
  }
  const clusterMembership = new Int16Array(N).fill(-1);

  // COA-4 hero landmark — pick + place + name. One landmark per map.
  let heroLandmark: HeroLandmark | null = null;
  {
    const landmarkRng = subRng(seedBase, 'landmark');
    const kind = pickLandmarkKind(req.biome, landmarkRng);
    const lineWaypoints = dominantLine?.waypoints ?? [];
    const center = placeLandmark(
      kind,
      W,
      H,
      coverDensity,
      lineWaypoints,
      [team0, team1],
      landmarkRng,
    );
    const footprint = footprintFor(kind, center).filter(
      (p) => p.x >= 0 && p.y >= 0 && p.x < W && p.y < H,
    );
    const { name, shortName } = generateLandmarkName(kind, landmarkRng);
    heroLandmark = { kind, name, shortName, footprint, center };
  }

  const diagnostics: MapGenDiagnostics = {
    retryCount: 0,
    hotspotsFound: hotspots.length,
    hotspotsDropped,
    carvedCells,
    prunedClusters,
    densityScatterChildren: 0,
    densityScatterRejected: 0,
  };

  const hash = hashBuffers(base, point, edgeN, edgeW, walkability);

  return {
    request: req,
    width: W,
    height: H,
    base,
    point,
    edgeN,
    edgeW,
    edgeOverrideN,
    edgeOverrideW,
    buildingId,
    walkability,
    coverProfile,
    elevationStep,
    structureHeight,
    hpN,
    hpW,
    hpPoint,
    buildings,
    elevation,
    coverDensity,
    hotspots,
    clusterMembership,
    dominantLine,
    capillaries,
    heroLandmark,
    deployZones: { team0, team1 },
    objectiveAnchors,
    diagnostics,
    hash,
  };
}

// ---------------------------------------------------------------------------
// Pipeline stages — simplified parity pass. COAs 1/3/4 replace most of these.

function removeSmallBaseIslands(
  base: Uint8Array,
  W: number,
  H: number,
  sourceByte: number,
  fillByte: number,
  minSize: number,
): number {
  const N = W * H;
  const visited = new Uint8Array(N);
  const stack = new Int32Array(N);
  let pruned = 0;
  for (let i = 0; i < N; i++) {
    if (visited[i] || base[i] !== sourceByte) continue;
    let top = 0;
    stack[top++] = i;
    const component: number[] = [];
    while (top > 0) {
      const p = stack[--top];
      if (visited[p]) continue;
      visited[p] = 1;
      if (base[p] !== sourceByte) continue;
      component.push(p);
      const x = p % W;
      const y = (p - x) / W;
      if (x > 0) stack[top++] = p - 1;
      if (x < W - 1) stack[top++] = p + 1;
      if (y > 0) stack[top++] = p - W;
      if (y < H - 1) stack[top++] = p + W;
    }
    if (component.length < minSize) {
      for (const p of component) base[p] = fillByte;
      pruned++;
    }
  }
  return pruned;
}

function scatterBuildingClusters(
  base: Uint8Array,
  structureHeight: Uint8Array,
  buildingId: Uint16Array,
  buildings: BuildingRecord[],
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
    let ok = true;
    for (let yy = y0; yy < y0 + sh && ok; yy++) {
      for (let xx = x0; xx < x0 + sw; xx++) {
        const i = yy * W + xx;
        if (base[i] === B.water_deep || buildingId[i] !== 0) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) continue;
    const height = 3 + Math.floor(rng() * 4);
    const floors = Math.max(1, Math.round(height / 3));
    const id = buildings.length + 1;
    const footprint: { x: number; y: number }[] = [];
    for (let yy = y0; yy < y0 + sh; yy++) {
      for (let xx = x0; xx < x0 + sw; xx++) {
        const i = yy * W + xx;
        buildingId[i] = id;
        structureHeight[i] = height;
        // Leave base as open; building is read via buildingId.
        footprint.push({ x: xx, y: yy });
      }
    }
    buildings.push({
      id,
      family: 'shed',
      floors,
      footprintTiles: footprint,
      wallHpInitial: 100,
    });
    placed++;
  }
}

// Replaces the old forest-base scatter. Stamps tree_forest / bush_medium
// points over open terrain — per the new vocabulary there's no 'forest'
// base surface; foliage is a point-object layer.
function scatterForestClusters(
  base: Uint8Array,
  point: Uint8Array,
  hpPoint: Uint16Array,
  fertility: Float32Array,
  W: number,
  H: number,
  per10k: number,
  seed: number,
): void {
  const area = W * H;
  const target = Math.floor((per10k * area) / 10000);
  const rng = makeRng(seed ^ 0x9abcdef);
  const treeByte = pointToByte('tree_forest');
  const bushByte = pointToByte('bush_medium');
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
        if (base[i] !== B.open) continue;
        if (point[i] !== 0) continue;
        // Deterministic fertility-weighted selection: trees on higher
        // fertility cells, bushes on the rest.
        const byte = fertility[i] > 0.55 ? treeByte : bushByte;
        point[i] = byte;
        // Max HP is per-kind; we track it but don't apply damage at gen time.
        hpPoint[i] = byte === treeByte ? 30 : 10;
        anyPlaced = true;
      }
    }
    if (anyPlaced) placed++;
  }
}

function bakeWalkabilityAndCover(
  base: Uint8Array,
  point: Uint8Array,
  buildingId: Uint16Array,
  walkability: Uint16Array,
  coverProfile: Uint8Array,
  N: number,
): void {
  for (let i = 0; i < N; i++) {
    const baseKind = byteToBase(base[i]);
    const baseAxes = BASE_AXES[baseKind];
    const pointKind: PointObjectKind | null = byteToPoint(point[i]);
    const pointAxes = pointKind ? POINT_AXES[pointKind] : null;
    const isBuilding = buildingId[i] !== 0;

    // Movement mask — intersection across layers. Base first.
    let mask = walkMaskFromMove(baseAxes.move);
    if (pointAxes) mask &= walkMaskFromMove(pointAxes.move);
    if (isBuilding) {
      // Building interior: infantry-only, no vehicles.
      mask &= WALK_INFANTRY_MASK;
    }
    if ((pointAxes?.moveSpeedMult ?? baseAxes.moveSpeedMult) < 1.0) mask |= WALK_SLOW;
    walkability[i] = mask;

    // Cover profile — rough pre-bake byte for fast hit.ts lookup.
    // Bits: los 0-1, cover 2-3, heightProfile 4-6, dirty 7.
    const los = pointAxes?.los ?? baseAxes.los;
    const cover = pointAxes?.cover ?? baseAxes.cover;
    const profile = pointAxes?.heightProfile ?? baseAxes.heightProfile;
    coverProfile[i] =
      losBits(los) | (coverBits(cover) << 2) | (heightBits(profile) << 4);
  }
}

function walkMaskFromMove(
  move: 'walkable-free' | 'walkable-slow' | 'blocked-foot' | 'blocked-vehicle' | 'blocked-all',
): number {
  switch (move) {
    case 'walkable-free':
      return (
        WALK_FOOT |
        WALK_PRONE |
        WALK_MECH |
        WALK_POWER_ARMOR |
        WALK_WHEELED |
        WALK_TRACKED
      );
    case 'walkable-slow':
      return (
        WALK_FOOT |
        WALK_PRONE |
        WALK_MECH |
        WALK_POWER_ARMOR |
        WALK_WHEELED |
        WALK_TRACKED |
        WALK_SLOW
      );
    case 'blocked-foot':
      // Only mech + PA pass — per user, tank traps / dragons teeth pass
      // mechs and power armor but block wheeled + tracked.
      return WALK_MECH | WALK_POWER_ARMOR;
    case 'blocked-vehicle':
      // Infantry (all leg-based locomotion) passes; wheeled + tracked blocked.
      return WALK_INFANTRY_MASK;
    case 'blocked-all':
      return 0;
  }
}

function losBits(l: 'none' | 'thin' | 'full'): number {
  return l === 'full' ? 2 : l === 'thin' ? 1 : 0;
}
function coverBits(c: 'none' | 'light' | 'heavy' | 'full'): number {
  return c === 'full' ? 3 : c === 'heavy' ? 2 : c === 'light' ? 1 : 0;
}
function heightBits(h: 'flat' | 'low' | 'chest' | 'tall' | 'full'): number {
  return h === 'full' ? 4 : h === 'tall' ? 3 : h === 'chest' ? 2 : h === 'low' ? 1 : 0;
}

function maskZoneInDensity(
  field: Float32Array,
  W: number,
  zone: DeployZone,
  buffer: number,
): void {
  const x0 = Math.max(0, zone.x - buffer);
  const y0 = Math.max(0, zone.y - buffer);
  const x1 = Math.min(W - 1, zone.x + zone.w - 1 + buffer);
  const y1 = zone.y + zone.h - 1 + buffer;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (i < 0 || i >= field.length) continue;
      field[i] = 0;
    }
  }
}

function insideZone(p: { x: number; y: number }, zone: DeployZone): boolean {
  return p.x >= zone.x && p.x < zone.x + zone.w && p.y >= zone.y && p.y < zone.y + zone.h;
}

function ensureZoneWalkable(
  base: Uint8Array,
  buildingId: Uint16Array,
  point: Uint8Array,
  walkability: Uint16Array,
  elevationStep: Uint8Array,
  W: number,
  zone: DeployZone,
): void {
  // Sample the zone-center elevation and flatten the whole rectangle to it.
  // Without this, fBm elevation plus the COA-8 cliff guard can strand spawn
  // units — they land on a 4-step step and can't cross into adjacent tiles
  // more than 2 steps away.
  const cx = Math.floor(zone.x + zone.w / 2);
  const cy = Math.floor(zone.y + zone.h / 2);
  const flatStep = elevationStep[cy * W + cx];
  for (let yy = zone.y; yy < zone.y + zone.h; yy++) {
    for (let xx = zone.x; xx < zone.x + zone.w; xx++) {
      const i = yy * W + xx;
      if (base[i] === B.water_deep) base[i] = B.open;
      if (buildingId[i] !== 0) buildingId[i] = 0;
      point[i] = 0;
      elevationStep[i] = flatStep;
      walkability[i] =
        WALK_FOOT | WALK_PRONE | WALK_MECH | WALK_POWER_ARMOR | WALK_WHEELED | WALK_TRACKED;
    }
  }
  // Feather a 1-tile ring around the deploy zone down to a delta of at most
  // MAX_STEP_ELEV_DELTA (2) so units can step out of the zone.
  for (let yy = Math.max(0, zone.y - 1); yy <= Math.min(W - 1, zone.y + zone.h); yy++) {
    for (let xx = Math.max(0, zone.x - 1); xx <= Math.min(W - 1, zone.x + zone.w); xx++) {
      if (xx >= zone.x && xx < zone.x + zone.w && yy >= zone.y && yy < zone.y + zone.h) continue;
      const i = yy * W + xx;
      const d = elevationStep[i] - flatStep;
      if (d > 2) elevationStep[i] = flatStep + 2;
      else if (d < -2) elevationStep[i] = flatStep - 2;
    }
  }
}

function zonesReachable(
  walkability: Uint16Array,
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

function carveCorridor(
  base: Uint8Array,
  point: Uint8Array,
  buildingId: Uint16Array,
  walkability: Uint16Array,
  W: number,
  H: number,
  team0: DeployZone,
  team1: DeployZone,
): number {
  const x0 = Math.floor(team0.x + team0.w / 2);
  const y0 = Math.floor(team0.y + team0.h / 2);
  const x1 = Math.floor(team1.x + team1.w / 2);
  const y1 = Math.floor(team1.y + team1.h / 2);
  let x = x0;
  let y = y0;
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  let carved = 0;
  while (x !== x1 || y !== y1) {
    if (x !== x1) x += dx;
    else if (y !== y1) y += dy;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const xx = x + ox;
        const yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = yy * W + xx;
        if (base[i] === B.water_deep || buildingId[i] !== 0 || point[i] !== 0) {
          if (base[i] === B.water_deep) base[i] = B.road;
          buildingId[i] = 0;
          point[i] = 0;
          walkability[i] =
            WALK_FOOT | WALK_PRONE | WALK_MECH | WALK_POWER_ARMOR | WALK_WHEELED | WALK_TRACKED;
          carved++;
        }
      }
    }
  }
  return carved;
}

function hashBuffers(...bufs: (Uint8Array | Uint16Array)[]): number {
  let h = 0x811c9dc5;
  // Stride every 17 entries of each buffer — full-buffer hash at 4096² is
  // expensive, stride hash is sufficient for determinism regression catch.
  for (const buf of bufs) {
    for (let i = 0; i < buf.length; i += 17) {
      h ^= buf[i];
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

// Silence unused ELEVATION_STEPS import — kept as a module-level reference
// so future scatter stages can read it without re-importing.
void ELEVATION_STEPS;
void BARRIER_AXES;
