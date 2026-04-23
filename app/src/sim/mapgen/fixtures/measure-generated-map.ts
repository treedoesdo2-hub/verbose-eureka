// P0.9 — measureGeneratedMap helper.
//
// Produces the same Metrics shape as measure-firefight-maps.mjs does for
// Firefight hero JPGs, but reads a MapGenResult/World from our pipeline
// instead. Parity tests call this and compare against the Firefight
// fixture.
//
// Metric definitions are chosen to be comparable across the two sources:
//   - forest_pct: tiles whose point is a tree_* family
//   - building_pct: tiles with buildingId > 0
//   - hedge_pct: edges (N + W) with hedge or bocage kind, converted to
//     percentage of tile-edges (normalized 2 edges per tile).
//   - road_pct: base == road
//   - water_pct: base == water_shallow | water_deep
//   - open_pct: base == open
//   - contour_lines_per_1000_tiles: tile-edges where elevationStep differs
//     from neighbor, normalized per 1000 tiles.
//   - elevation_stddev_normalized: stddev(elevationStep) / 73.6
//     (73.6 = theoretical stddev of uniform over [0,255]).

import { byteToBase, byteToPoint, BARRIER_KINDS } from '../../world';
import type { MapGenResult } from '../types';
import type { Metrics } from './metric-schema';

const TREE_POINT_KINDS = new Set([
  'tree_forest',
  'tree_fruit',
  'tree_jungle',
  'tree_oak',
  'tree_poplar',
  'tree_snow',
]);

// Barrier byte layout: kind occupies low 4 bits; state + material skin the
// high 4. Mask before lookup.
const HEDGE_KIND_BYTES = new Set(
  BARRIER_KINDS.map((k, i) => (k === 'hedge' || k === 'bocage' ? i + 1 : -1)).filter((v) => v > 0),
);

function extractBarrierKind(edgeByte: number): number {
  return edgeByte & 0x0f;
}

export function measureGeneratedMap(result: MapGenResult): Metrics {
  const { width, height, base, point, buildingId, elevationStep, edgeN, edgeW } = result;
  const total = width * height;
  if (total === 0) return zeroMetrics();

  // Base surface counts.
  let openTiles = 0;
  let roadTiles = 0;
  let waterTiles = 0;
  for (let i = 0; i < total; i += 1) {
    const kind = byteToBase(base[i]);
    if (kind === 'open') openTiles += 1;
    else if (kind === 'road') roadTiles += 1;
    else if (kind === 'water_shallow' || kind === 'water_deep') waterTiles += 1;
  }

  // Point-object forest counts.
  let forestTiles = 0;
  for (let i = 0; i < total; i += 1) {
    const kind = byteToPoint(point[i]);
    if (kind && TREE_POINT_KINDS.has(kind)) forestTiles += 1;
  }

  // Building-footprint tile count.
  let buildingTiles = 0;
  for (let i = 0; i < total; i += 1) {
    if (buildingId[i] > 0) buildingTiles += 1;
  }

  // Hedge/bocage edge count. Normalize to percent-of-tiles: each tile has 2
  // authored edges (N, W), so dividing hedgeEdges/2/total gives tile-
  // equivalent coverage.
  let hedgeEdges = 0;
  for (let i = 0; i < total; i += 1) {
    if (HEDGE_KIND_BYTES.has(extractBarrierKind(edgeN[i]))) hedgeEdges += 1;
    if (HEDGE_KIND_BYTES.has(extractBarrierKind(edgeW[i]))) hedgeEdges += 1;
  }
  const hedgeTileEquivalent = hedgeEdges / 2;

  // Contour density — count tile-boundaries where the elevationStep differs
  // from its N or W neighbor.
  let contourTiles = 0;
  for (let y = 1; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const i = y * width + x;
      if (elevationStep[i] !== elevationStep[i - width]) contourTiles += 1;
      else if (elevationStep[i] !== elevationStep[i - 1]) contourTiles += 1;
    }
  }
  const contoursPer1000 = (contourTiles / total) * 1000;

  // Elevation stddev.
  let sum = 0;
  for (let i = 0; i < total; i += 1) sum += elevationStep[i];
  const mean = sum / total;
  let varSum = 0;
  for (let i = 0; i < total; i += 1) {
    const d = elevationStep[i] - mean;
    varSum += d * d;
  }
  const stddev = Math.sqrt(varSum / total);
  // Our elevationStep is Uint8Array but the value range is the number of
  // discrete elevation steps (world.ts ELEVATION_STEPS=8), not the full
  // byte range. Stddev of uniform over [0, 7] is ~2.29. Normalize by that
  // so a maximally varied 8-step field reads ~1.0.
  const MAX_STDDEV = 8 / Math.sqrt(12); // ≈ 2.309
  const elevStddevNormalized = Math.min(1, stddev / MAX_STDDEV);

  return {
    forest_pct: (forestTiles / total) * 100,
    building_pct: (buildingTiles / total) * 100,
    hedge_pct: (hedgeTileEquivalent / total) * 100,
    road_pct: (roadTiles / total) * 100,
    water_pct: (waterTiles / total) * 100,
    open_pct: (openTiles / total) * 100,
    contour_lines_per_1000_tiles: contoursPer1000,
    elevation_stddev_normalized: elevStddevNormalized,
  };
}

function zeroMetrics(): Metrics {
  return {
    forest_pct: 0,
    building_pct: 0,
    hedge_pct: 0,
    road_pct: 0,
    water_pct: 0,
    open_pct: 0,
    contour_lines_per_1000_tiles: 0,
    elevation_stddev_normalized: 0,
  };
}

// Median across seeds. Parity tests run 5 seeds per biome and compare the
// per-metric median against the Firefight target, which cancels single-
// seed outliers.
export function medianMetrics(samples: readonly Metrics[]): Metrics {
  if (samples.length === 0) return zeroMetrics();
  const keys = Object.keys(samples[0]) as (keyof Metrics)[];
  const out = zeroMetrics();
  for (const k of keys) {
    const sorted = samples.map((m) => m[k]).sort((a, b) => a - b);
    out[k] = sorted[Math.floor(sorted.length / 2)];
  }
  return out;
}
