// P0.9 — measureGeneratedMap helper.
//
// Produces the same Metrics shape as measure-firefight-maps.mjs does for
// Firefight hero JPGs, but reads a MapGenResult/World from our pipeline
// instead. Parity tests call this and compare against the Firefight
// fixture.
//
// Metric definitions use *priority classification* per tile so that the
// categories are mutually exclusive. This matches Firefight's HSL pixel
// classifier, which sees only the topmost visual feature on any given
// hero-JPG pixel: a pixel covered by a tree reads as "forest", not "open".
// Without priority assignment, a tree-covered tile would inflate both
// forest_pct AND open_pct (since base stays 'open' under a point-object
// tree), and our open_pct would float ~95% on every map regardless of
// content.
//
// Classification priority (highest wins):
//   water > road > building > forest > hedge-tile-equiv > open
//
// Hedge is per-edge, not per-tile. We treat a tile with at least one
// hedge/bocage edge as "hedge-classified" if no higher-priority class
// applies — same approximation as a top-down photo where a hedge runs
// along a tile boundary and visually dominates the adjacent strip.
//
// Other metrics:
//   - contour_lines_per_1000_tiles: tile-edges where elevationStep differs
//     from neighbor, normalized per 1000 tiles.
//   - elevation_stddev_normalized: stddev(elevationStep) normalized so a
//     uniform field over our 8 elevation steps reads ~1.0.

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

  // Priority classification — mutually exclusive per tile. A tile with a
  // tree on top of open base classifies as forest, not open. A building
  // tile classifies as building even if base is open. Mirrors Firefight's
  // HSL pixel classifier which sees only the topmost feature.
  let openTiles = 0;
  let roadTiles = 0;
  let waterTiles = 0;
  let forestTiles = 0;
  let buildingTiles = 0;
  let hedgeTiles = 0;
  for (let i = 0; i < total; i += 1) {
    const baseKind = byteToBase(base[i]);
    // Highest priority: water (always reads as water in any photo).
    if (baseKind === 'water_shallow' || baseKind === 'water_deep') {
      waterTiles += 1;
      continue;
    }
    // Road next — visually dominant when present.
    if (baseKind === 'road') {
      roadTiles += 1;
      continue;
    }
    // Building roofs occlude any underlying terrain.
    if (buildingId[i] > 0) {
      buildingTiles += 1;
      continue;
    }
    // Tree canopy occludes ground.
    const pointKind = byteToPoint(point[i]);
    if (pointKind && TREE_POINT_KINDS.has(pointKind)) {
      forestTiles += 1;
      continue;
    }
    // Hedge edges (N or W) make this tile read as a hedge boundary.
    if (
      HEDGE_KIND_BYTES.has(extractBarrierKind(edgeN[i])) ||
      HEDGE_KIND_BYTES.has(extractBarrierKind(edgeW[i]))
    ) {
      hedgeTiles += 1;
      continue;
    }
    // Everything else (open / mud / sand / rubble / snow) buckets into open
    // — the Firefight classifier doesn't distinguish ground variants
    // beyond water/road/forest/hedge/building, and our parity tests don't
    // either.
    openTiles += 1;
  }

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
    hedge_pct: (hedgeTiles / total) * 100,
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
