// P0.3 — Shared metric schema for Firefight parity fixtures.
//
// Two consumers:
//   1. scripts/measure-firefight-maps.mjs — reads the 27 Firefight hero JPGs,
//      produces per-map metric values by RGB/cluster analysis (plus any
//      -contours.png + -world.dat signals we can cheaply extract).
//   2. src/sim/mapgen/fixtures/measure-generated-map.ts — reads a
//      MapGenResult/World from our pipeline, produces the same metric shape
//      for direct comparison against the Firefight fixture.
//
// Keeping both consumers on ONE schema guarantees parity tests compare like
// with like. Never fork this list.

export const METRICS = [
  'forest_pct',
  'building_pct',
  'hedge_pct',
  'road_pct',
  'water_pct',
  'open_pct',
  'contour_lines_per_1000_tiles',
  'elevation_stddev_normalized',
] as const;

export type MetricKey = (typeof METRICS)[number];

export type Metrics = Record<MetricKey, number>;

// Normalization constants. Raw tile-counts → percentage of total playable
// tiles. Elevation stddev → normalized to [0, 1] by dividing by the
// theoretical max (255 for Uint8Array elevationStep). Contour density →
// normalized per 1000 tiles so smaller/larger maps compare directly.
export const NORMALIZE = {
  pct: (count: number, total: number): number => (total === 0 ? 0 : (count / total) * 100),
  contoursPer1000: (lineTiles: number, totalTiles: number): number =>
    totalTiles === 0 ? 0 : (lineTiles / totalTiles) * 1000,
  elevStddevNormalized: (stddev: number): number => {
    // Our elevationStep is Uint8Array (0..255). Stddev of a uniform
    // distribution over that range is ~73.6 (256/sqrt(12)); real maps
    // rarely exceed 30-40. Normalize by 73.6 so a perfectly uniform field
    // reads 1.0, and flat reads 0.0.
    const MAX_STDDEV = 73.6;
    return Math.min(1, stddev / MAX_STDDEV);
  },
} as const;

// Default tolerance applied to per-metric parity comparisons. Fixture
// entries may override with a wider band for biomes lacking real Firefight
// ground truth (e.g., arid — see firefight-classification.json).
export const DEFAULT_METRIC_TOLERANCE = 0.5; // ±50% relative

export type MetricFixture = {
  readonly biome: string;
  readonly panel: readonly string[]; // map codes from firefight-classification.json
  readonly targets: Metrics; // panel mean
  readonly stddev: Metrics; // panel stddev (for computing z-score tolerances)
  readonly sampleCount: number;
  readonly toleranceMultiplier: number; // 1.0 normally, 3.0 for arid (no ground truth)
};

export type MetricFixtureFile = {
  readonly schema_version: number;
  readonly maps_root: string;
  readonly per_biome: Record<string, MetricFixture>;
  readonly per_map: Record<string, Metrics>;
};

// Pretty-print helper for test failure output.
export function formatMetricDelta(actual: number, expected: number, tolerance: number): string {
  const delta = actual - expected;
  const pct = expected === 0 ? Infinity : (Math.abs(delta) / expected) * 100;
  const within = Math.abs(delta) <= expected * tolerance;
  return `${actual.toFixed(2)} vs ${expected.toFixed(2)} (Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}, ${pct.toFixed(0)}%) ${within ? 'PASS' : 'FAIL'}`;
}
