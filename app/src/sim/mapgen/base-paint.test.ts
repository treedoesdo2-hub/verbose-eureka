// P5.10 — unit tests for per-biome base paint functions.
//
// Grid-scan each biome's paint function across the (elev, fert, rng)
// cube and assert ≥3 distinct TerrainBase outputs. Guards against the
// "all-open" regression that prompted the rewrite.

import { describe, expect, it } from 'vitest';
import type { BiomeId, TerrainBase } from '@schema/map';
import { paintForBiome } from './base-paint';

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

// Minimum distinct kinds per biome. Arid is pre-MVP parked; we allow 2.
const MIN_DISTINCT: Record<BiomeId, number> = {
  urban_dense: 3,
  urban_sparse: 3,
  rural_village: 3,
  rural_open: 3,
  forest: 2, // mostly open, punctuated by trees (point layer), minimal base variety
  industrial: 3,
  mixed: 3,
  arid: 2, // parked
};

describe('base paint (P5.10)', () => {
  for (const biome of BIOMES) {
    it(`${biome} paint produces ≥${MIN_DISTINCT[biome]} distinct base kinds over sample grid`, () => {
      const fn = paintForBiome(biome);
      const kinds = new Set<TerrainBase>();
      const N = 16;
      for (let e = 0; e <= N; e++) {
        for (let f = 0; f <= N; f++) {
          for (let r = 0; r <= N; r++) {
            kinds.add(fn(e / N, f / N, r / N));
          }
        }
      }
      expect(kinds.size).toBeGreaterThanOrEqual(MIN_DISTINCT[biome]);
    });
  }
});
