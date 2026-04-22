// COA-4 task #79/#80/#81 — hero-landmark types, kind picker, placement.
//
// A hero landmark is one named, visually-distinct feature per map that
// the briefing can reference (e.g., "extract at Refinery Delta-7"). The
// landmark has a footprint stamped into the base/point/building grids
// + a picked name from landmark-names.ts.

import type { BiomeId } from '@schema/map';
import type { Rng } from './noise';

export type LandmarkKind =
  | 'refinery'
  | 'grain_silo'
  | 'clock_tower'
  | 'water_tower'
  | 'lighthouse'
  | 'chapel'
  | 'windmill'
  | 'train_depot'
  | 'market_square'
  | 'tank_bunker'
  | 'radio_mast'
  | 'ruined_keep'
  | 'old_mill'
  | 'pumping_station'
  | 'orchard_cluster'
  | 'quarry_pit'
  | 'graveyard'
  | 'checkpoint'
  | 'barn_complex'
  | 'bridge_head'
  | 'observation_post'
  | 'shrine'
  | 'monument';

export type HeroLandmark = {
  readonly kind: LandmarkKind;
  readonly name: string; // e.g., "Refinery Delta-7"
  readonly shortName: string; // e.g., "Delta-7"
  readonly footprint: readonly { x: number; y: number }[];
  readonly center: { x: number; y: number };
};

// Biome × landmark-kind weights. Empty = illegal combo.
const BIOME_LANDMARK_WEIGHTS: Record<BiomeId, Partial<Record<LandmarkKind, number>>> = {
  urban_sparse: {
    clock_tower: 3,
    market_square: 4,
    chapel: 2,
    water_tower: 2,
    train_depot: 3,
    tank_bunker: 1,
    radio_mast: 2,
    checkpoint: 4,
    monument: 2,
    observation_post: 2,
  },
  rural_open: {
    grain_silo: 5,
    windmill: 4,
    old_mill: 4,
    orchard_cluster: 4,
    barn_complex: 5,
    shrine: 2,
    chapel: 2,
    graveyard: 2,
    quarry_pit: 2,
  },
  mixed: {
    refinery: 2,
    grain_silo: 3,
    clock_tower: 2,
    water_tower: 3,
    chapel: 2,
    windmill: 2,
    train_depot: 2,
    checkpoint: 3,
    barn_complex: 3,
    bridge_head: 3,
    monument: 2,
  },
  urban_dense: { clock_tower: 4, market_square: 5, checkpoint: 3, monument: 3 },
  industrial: { refinery: 6, train_depot: 4, radio_mast: 3, pumping_station: 4 },
  forest: { lighthouse: 1, chapel: 3, shrine: 4, ruined_keep: 4 },
  arid: { quarry_pit: 5, observation_post: 4, radio_mast: 2, ruined_keep: 3 },
  rural_village: { chapel: 5, market_square: 4, windmill: 3, shrine: 3, graveyard: 2 },
};

export function pickLandmarkKind(biome: BiomeId, rng: Rng): LandmarkKind {
  const weights = BIOME_LANDMARK_WEIGHTS[biome] ?? BIOME_LANDMARK_WEIGHTS.mixed;
  const entries = Object.entries(weights) as [LandmarkKind, number][];
  let total = 0;
  for (const [, w] of entries) total += w;
  if (total <= 0) return 'checkpoint';
  const roll = rng() * total;
  let acc = 0;
  for (const [kind, w] of entries) {
    acc += w;
    if (roll < acc) return kind;
  }
  return entries[entries.length - 1][0];
}

// #82 — landmark footprint stamper. Each kind has a canonical
// multi-tile footprint; placeLandmark positions it and records the
// tile list. Stamping into actual base/point/buildingId grids is the
// caller's job — HeroLandmark.footprint is the authoritative tile list.
export function footprintFor(kind: LandmarkKind, center: { x: number; y: number }): { x: number; y: number }[] {
  const c = center;
  const tiles: { x: number; y: number }[] = [];
  // Helper: square footprint.
  const square = (r: number) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        tiles.push({ x: c.x + dx, y: c.y + dy });
      }
    }
  };
  // Helper: cross / plus shape (chapel, shrine).
  const cross = (arm: number) => {
    for (let d = -arm; d <= arm; d++) {
      tiles.push({ x: c.x + d, y: c.y });
      tiles.push({ x: c.x, y: c.y + d });
    }
  };
  // Helper: L shape (barn complex).
  const lShape = (w: number, h: number) => {
    for (let i = 0; i < w; i++) tiles.push({ x: c.x + i, y: c.y });
    for (let i = 1; i < h; i++) tiles.push({ x: c.x, y: c.y + i });
  };
  // Helper: ring (tank_bunker, graveyard).
  const ring = (r: number) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) === r || Math.abs(dy) === r) tiles.push({ x: c.x + dx, y: c.y + dy });
      }
    }
  };

  switch (kind) {
    case 'refinery':
      // Wide 5x4 industrial complex.
      for (let dy = -2; dy <= 1; dy++) {
        for (let dx = -2; dx <= 2; dx++) tiles.push({ x: c.x + dx, y: c.y + dy });
      }
      break;
    case 'grain_silo':
    case 'water_tower':
    case 'lighthouse':
    case 'clock_tower':
    case 'windmill':
    case 'radio_mast':
      // Single-tile tall feature.
      tiles.push({ ...c });
      break;
    case 'chapel':
    case 'shrine':
      cross(1);
      break;
    case 'monument':
    case 'checkpoint':
      square(0);
      break;
    case 'train_depot':
      // 4x2 horizontal.
      for (let dy = 0; dy <= 1; dy++) for (let dx = -1; dx <= 2; dx++) tiles.push({ x: c.x + dx, y: c.y + dy });
      break;
    case 'market_square':
      square(2); // 5x5 open square
      break;
    case 'tank_bunker':
      ring(1);
      break;
    case 'ruined_keep':
      ring(2);
      break;
    case 'old_mill':
    case 'pumping_station':
      square(1);
      break;
    case 'orchard_cluster':
      // Grid of 4x4.
      for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) {
        if ((dx + dy) % 2 === 0) tiles.push({ x: c.x + dx, y: c.y + dy });
      }
      break;
    case 'quarry_pit':
      square(2);
      break;
    case 'graveyard':
      // 3x4 rows of rows.
      for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push({ x: c.x + dx, y: c.y + dy });
      break;
    case 'barn_complex':
      lShape(4, 3);
      break;
    case 'bridge_head':
      // 3x2 horizontal bridge footprint.
      for (let dy = 0; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push({ x: c.x + dx, y: c.y + dy });
      break;
    case 'observation_post':
      tiles.push({ ...c });
      break;
  }
  return tiles;
}

// #81 placeLandmark — scoring picks a tile maximizing:
//   - landmark-specific density affinity (market wants high density)
//   - distance from line (off-centre placement prevents overlap with
//     the dominant line's footprint)
//   - distance from deploy zones (landmarks shouldn't live in spawn areas)
export function placeLandmark(
  kind: LandmarkKind,
  W: number,
  H: number,
  coverDensity: Float32Array,
  lineWaypoints: readonly { x: number; y: number }[],
  deployZones: readonly { x: number; y: number; w: number; h: number }[],
  rng: Rng,
): { x: number; y: number } {
  // Sample 64 candidate tiles, score each, pick the winner.
  let best: { x: number; y: number } | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 64; i++) {
    const x = 4 + Math.floor(rng() * (W - 8));
    const y = 4 + Math.floor(rng() * (H - 8));
    // Distance to nearest deploy zone (negative score if inside).
    let inDeploy = false;
    let minDzDist = Infinity;
    for (const dz of deployZones) {
      if (x >= dz.x && x < dz.x + dz.w && y >= dz.y && y < dz.y + dz.h) {
        inDeploy = true;
        break;
      }
      const cxZ = Math.max(dz.x, Math.min(x, dz.x + dz.w - 1));
      const cyZ = Math.max(dz.y, Math.min(y, dz.y + dz.h - 1));
      const d = Math.hypot(cxZ - x, cyZ - y);
      if (d < minDzDist) minDzDist = d;
    }
    if (inDeploy) continue;
    let minLineDist = Infinity;
    for (const p of lineWaypoints) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minLineDist) minLineDist = d;
    }
    // Score: density × 20 + deployDist × 0.5 - lineDistCap.
    const density = coverDensity[y * W + x] ?? 0;
    const affinity = landmarkDensityAffinity(kind);
    const score =
      density * affinity +
      Math.min(minDzDist, 30) * 0.5 -
      Math.abs(minLineDist - 8) * 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }
  return best ?? { x: Math.floor(W / 2), y: Math.floor(H / 2) };
}

// Per-kind affinity for coverDensity — market_square wants density,
// lighthouse wants isolation.
function landmarkDensityAffinity(kind: LandmarkKind): number {
  switch (kind) {
    case 'market_square':
    case 'checkpoint':
    case 'clock_tower':
    case 'chapel':
    case 'train_depot':
      return 40;
    case 'grain_silo':
    case 'barn_complex':
    case 'windmill':
    case 'orchard_cluster':
      return 20;
    case 'lighthouse':
    case 'radio_mast':
    case 'observation_post':
    case 'shrine':
      return -20; // prefer isolation
    default:
      return 10;
  }
}
