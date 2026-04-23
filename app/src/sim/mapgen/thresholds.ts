// COA-3 task #54 — per-terrain-kind pruning thresholds.
//
// Every TerrainBase + PointObjectKind + LinearBarrierKind that can be
// scattered has a minimum cluster size (in tiles) below which clusters
// are merged into the dominant neighbor or dropped. This table is the
// single source of truth — adding a new kind requires registering a
// threshold here, caught at type-check time via exhaustive Record type.
//
// Tuning knobs live here too: elongation cap (how stringy a cluster can
// be before pruning) + hole cap (small open pockets inside a cluster
// that we fill in vs keep as play-space).
//
// Values calibrated against Firefight v9.0.2 by direct visual inspection
// of representative maps (BFRM bocage, KMPV jungle, LAUN rural, MLKS
// forest, ASTM villages, TFAC urban industrial, VBOC residential).
// See THRESHOLDS_TUNING.md for per-knob rationale and sample data.

import type { LinearBarrierKind, PointObjectKind, TerrainBase } from '@schema/map';

export type ClusterThresholds = {
  readonly minSize: number;
  readonly maxElongation: number;
  readonly maxHoleSize: number; // holes below this get filled
};

// Default thresholds — sensible starting values. Biome-specific overrides
// live in density-field.ts profiles via clusterThresholdsFor(biome, kind).
const DEFAULT_THRESHOLDS: ClusterThresholds = {
  minSize: 4,
  maxElongation: 8,
  maxHoleSize: 2,
};

// Base terrain — water + rubble get cluster pruning (forest bleeds are
// now expressed as point-scatter, so tree_forest lives in POINT_THRESHOLDS).
//
// Line-like surfaces (road / water_shallow=rivers / water_deep=canals or
// coastlines) are authored via stampLine which produces deliberately
// elongated clusters spanning the whole map. Capping elongation low
// would delete them on every run; we set maxElongation = Infinity for
// these kinds so pruning only drops tiny stubs, not the dominant line.
export const BASE_THRESHOLDS: Record<TerrainBase, ClusterThresholds> = {
  open: DEFAULT_THRESHOLDS,
  road: { minSize: 4, maxElongation: Infinity, maxHoleSize: 2 },
  water_shallow: { minSize: 6, maxElongation: Infinity, maxHoleSize: 3 },
  water_deep: { minSize: 32, maxElongation: Infinity, maxHoleSize: 6 },
  mud: { minSize: 8, maxElongation: 8, maxHoleSize: 3 },
  rubble_ground: { minSize: 4, maxElongation: 6, maxHoleSize: 2 },
  // Firefight winter maps absent from v9.0.2 — keep defaults, revisit
  // when winter reference available.
  snow: { minSize: 16, maxElongation: 10, maxHoleSize: 4 },
  // TFAC/VBOC show sand lots as rectangular construction plots, not
  // linear strips — tightened maxElongation 10→7 (COA-3 #66).
  sand: { minSize: 16, maxElongation: 7, maxHoleSize: 4 },
};

// Point-object clusters — scattered as groves / clumps / compounds. Trees
// form forests; barrels and oil drums form supply stacks; carts form
// caravan lines. Tighter thresholds keep clusters readable at minimap
// scale and prevent "chicken pox" single-tree splatter.
export const POINT_THRESHOLDS: Record<PointObjectKind, ClusterThresholds> = {
  barrel: { minSize: 2, maxElongation: 6, maxHoleSize: 1 },
  bush_small: { minSize: 3, maxElongation: 10, maxHoleSize: 1 },
  bush_medium: { minSize: 3, maxElongation: 8, maxHoleSize: 2 },
  bush_large: { minSize: 2, maxElongation: 5, maxHoleSize: 1 },
  car: { minSize: 1, maxElongation: 4, maxHoleSize: 1 },
  cart_empty: { minSize: 2, maxElongation: 6, maxHoleSize: 1 },
  cart_full: { minSize: 2, maxElongation: 6, maxHoleSize: 1 },
  dragons_teeth: { minSize: 4, maxElongation: 12, maxHoleSize: 1 }, // defensive lines stretch long
  garden_shed: { minSize: 1, maxElongation: 2, maxHoleSize: 0 },
  grave: { minSize: 4, maxElongation: 4, maxHoleSize: 2 }, // graveyards are clustered
  gravestone: { minSize: 4, maxElongation: 6, maxHoleSize: 2 },
  haystack: { minSize: 2, maxElongation: 6, maxHoleSize: 1 },
  oil_drums: { minSize: 2, maxElongation: 5, maxHoleSize: 1 },
  rubble_pile: { minSize: 1, maxElongation: 4, maxHoleSize: 1 },
  signpost: { minSize: 1, maxElongation: 1, maxHoleSize: 0 },
  storage_tank: { minSize: 1, maxElongation: 3, maxHoleSize: 0 },
  tank_trap: { minSize: 4, maxElongation: 12, maxHoleSize: 1 },
  telegraph_pole: { minSize: 1, maxElongation: 12, maxHoleSize: 0 }, // strung along a line
  trough: { minSize: 1, maxElongation: 2, maxHoleSize: 0 },
  tyres: { minSize: 2, maxElongation: 4, maxHoleSize: 1 },
  well: { minSize: 1, maxElongation: 1, maxHoleSize: 0 },
  // Firefight forest pockets (MLKS/BFRM) are 40-150 tile blobs — never
  // 4-tile specks. Raised minSize 4→10; holes 2→4 so clearings survive
  // pruning rather than getting filled in (COA-3 #66).
  tree_forest: { minSize: 10, maxElongation: 8, maxHoleSize: 4 },
  // ASTM orchards are 20-40 tile grid-shaped rectangles. Raised minSize
  // 4→8 to kill speck orchards (COA-3 #66).
  tree_fruit: { minSize: 8, maxElongation: 6, maxHoleSize: 2 },
  // KMPV jungle = continuous carpet 300-600+ tiles with real clearings.
  // Raised minSize 6→20 and holes 3→6 so jungle reads as a hero biome
  // rather than a scatter field (COA-3 #66).
  tree_jungle: { minSize: 20, maxElongation: 8, maxHoleSize: 6 },
  tree_oak: { minSize: 2, maxElongation: 4, maxHoleSize: 1 }, // isolated oak = landmark
  tree_poplar: { minSize: 3, maxElongation: 12, maxHoleSize: 1 }, // wind-rows
  tree_snow: { minSize: 4, maxElongation: 8, maxHoleSize: 2 },
};

// Linear barriers — edge-placed, so "size" means tile-length of a run.
// Min size rejects single-tile barrier stubs that look like dropped-in
// debris rather than deliberate structure.
export const BARRIER_THRESHOLDS: Record<LinearBarrierKind, ClusterThresholds> = {
  // BFRM bocage hedges are ALWAYS full field borders (20-40 tiles). A
  // 4-tile hedge stub reads as debris, not bocage. Raised minSize 4→8
  // and maxElongation 20→30 so dominant hedgerow spines survive the
  // pruner even when they span most of the map (COA-3 #66).
  hedge: { minSize: 8, maxElongation: 30, maxHoleSize: 1 },
  bocage: { minSize: 8, maxElongation: 30, maxHoleSize: 1 },
  stone_wall_low: { minSize: 3, maxElongation: 20, maxHoleSize: 1 },
  wood_fence: { minSize: 4, maxElongation: 20, maxHoleSize: 1 },
  bamboo_fence: { minSize: 4, maxElongation: 20, maxHoleSize: 1 },
  rail_fence: { minSize: 5, maxElongation: 30, maxHoleSize: 1 },
  berm: { minSize: 3, maxElongation: 15, maxHoleSize: 1 },
  wire_light: { minSize: 3, maxElongation: 25, maxHoleSize: 1 },
  wire_dense: { minSize: 4, maxElongation: 20, maxHoleSize: 1 },
  wire_razor: { minSize: 5, maxElongation: 15, maxHoleSize: 1 },
  rubble_strip: { minSize: 2, maxElongation: 12, maxHoleSize: 1 },
};

export type KindKey =
  | { kind: 'base'; value: TerrainBase }
  | { kind: 'point'; value: PointObjectKind }
  | { kind: 'barrier'; value: LinearBarrierKind };

export function thresholdsFor(key: KindKey): ClusterThresholds {
  if (key.kind === 'base') return BASE_THRESHOLDS[key.value];
  if (key.kind === 'point') return POINT_THRESHOLDS[key.value];
  return BARRIER_THRESHOLDS[key.value];
}
