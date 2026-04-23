// P0.8 — Structural minima tests (all 7 biomes including arid).
//
// Per biome at seed=42, size=256: assert the pipeline produces a map with:
//   - ≥3 hotspots (so scatter actually anchors things)
//   - ≥3 distinct base-byte kinds (so the surface isn't a single color)
//   - ≥200 point-object tiles (so the map isn't barren)
//   - elevation stddev > 0.05 (so the map has some relief)
//
// These tests catch the "empty map" failure modes that prompted the
// rework. They're deliberately undemanding — they don't enforce Firefight
// parity, they just enforce "there's something on this map".

import { describe, it, expect } from 'vitest';
import { runPipeline } from './pipeline';
import type { MapGenRequest } from './types';
import type { BiomeId } from '@schema/map';
import { measureGeneratedMap } from './fixtures/measure-generated-map';

const BIOMES: BiomeId[] = [
  'urban_dense',
  'urban_sparse',
  'rural_village',
  'rural_open',
  'forest',
  'industrial',
  'mixed',
  'arid',
];

// Arid is pre-MVP parked (see firefight-classification.json). Use
// relaxed thresholds for arid only — everywhere else, the rigorous
// minima apply.
const ARID_MIN_POINT_TILES = 50;

const SEED = 'seed-42';
const SIZE = 256;
const MIN_HOTSPOTS = 3;
const MIN_DISTINCT_BASE_KINDS = 3;
const MIN_POINT_TILES = 200;
const MIN_ELEV_STDDEV_NORM = 0.05;

function req(biome: BiomeId): MapGenRequest {
  return {
    seed: SEED,
    biome,
    size: SIZE,
    tileSizeMeters: 1.5,
    generationVersion: 1,
  };
}

describe('structural minima (P0.8)', () => {
  for (const biome of BIOMES) {
    it(`${biome} meets structural minima`, () => {
      const result = runPipeline(req(biome));

      // Hotspots.
      expect(result.hotspots.length, `hotspots (${biome})`).toBeGreaterThanOrEqual(MIN_HOTSPOTS);

      // Distinct base-byte kinds.
      const kinds = new Set<number>();
      for (let i = 0; i < result.base.length; i += 1) kinds.add(result.base[i]);
      expect(kinds.size, `distinct base kinds (${biome})`).toBeGreaterThanOrEqual(
        MIN_DISTINCT_BASE_KINDS,
      );

      // Point-object tile count (trees + scatter). Arid is parked at a
      // reduced threshold.
      let pointTiles = 0;
      for (let i = 0; i < result.point.length; i += 1) if (result.point[i] > 0) pointTiles += 1;
      const pointFloor = biome === 'arid' ? ARID_MIN_POINT_TILES : MIN_POINT_TILES;
      expect(pointTiles, `point tiles (${biome})`).toBeGreaterThanOrEqual(pointFloor);

      // Elevation stddev.
      const metrics = measureGeneratedMap(result);
      expect(
        metrics.elevation_stddev_normalized,
        `elevation stddev (${biome})`,
      ).toBeGreaterThan(MIN_ELEV_STDDEV_NORM);
    });
  }
});
