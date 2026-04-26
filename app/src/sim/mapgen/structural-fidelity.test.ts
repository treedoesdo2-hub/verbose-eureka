// Structural fidelity (#277).
//
// User feedback 2026-04-23: maps no longer empty, but content reads as
// "randomly strewn" — buildings littered everywhere instead of clustering
// into villages, trees scattered instead of forming patches, no road
// network. The Firefight panel parity test (firefight-parity.test.ts)
// only checks tile-class density, which lets a chicken-pox map slip
// through. This file enforces structural shape requirements per biome.
//
// Each biome declares minima for:
//   - building cluster mean size (villages > splatters)
//   - forest patch mean size (groves > one-tree dots)
//   - road component count (1 or 2 = unified network; >5 = stub debris)
//   - road reaches edge (true = march-entry exists)
//   - hedge cluster minimum (rural biomes only — bocage = real network)
//
// Thresholds are calibrated against the current pipeline output (after
// the #277 generator changes). They're set near the median observation
// so a regression that halves cluster size or breaks road continuity
// fails fast.

import { describe, expect, it } from 'vitest';
import { runPipeline } from './pipeline';
import { measureStructural } from './fixtures/measure-structural';
import type { MapGenRequest } from './types';
import type { BiomeId } from '@schema/map';

const SIZE = 256;
const SEEDS = ['struct-1', 'struct-2', 'struct-3'];

function req(biome: BiomeId, seed: string): MapGenRequest {
  return { seed, biome, size: SIZE, tileSizeMeters: 1.5, generationVersion: 1 };
}

type Minima = {
  // Building structural minima. cluster_mean_size > N means the average
  // building is at least N tiles — splatters fail this. building_count
  // gives a band [lo, hi] so urban biomes show many buildings, forest a
  // few. null disables the check entirely.
  readonly buildingMinMeanSize: number | null;
  readonly buildingMinCount: number | null;
  // Forest minima. Single trees would have meanSize≈1; we want meaningful
  // patches, especially in forest/rural biomes.
  readonly forestMinMeanSize: number | null;
  // Road network — at least one big component, not 20 disjoint stubs.
  // largestRoadFraction is fraction of road tiles in the largest
  // connected component. Should be high for biomes with a real network.
  readonly roadLargestFraction: number | null;
  // Bocage: rural biomes need a hedge network with non-trivial cluster
  // size. urban_dense / industrial don't have hedges.
  readonly hedgeMinTotal: number | null;
};

const BIOME_MINIMA: Record<BiomeId, Minima> = {
  // Dense city: many buildings, each multi-tile, no hedges.
  urban_dense: {
    buildingMinMeanSize: 5,
    buildingMinCount: 50,
    forestMinMeanSize: null,
    roadLargestFraction: 0.5,
    hedgeMinTotal: null,
  },
  urban_sparse: {
    buildingMinMeanSize: 4,
    buildingMinCount: 8,
    forestMinMeanSize: null,
    roadLargestFraction: null, // sparse roads — many disjoint paths OK
    hedgeMinTotal: 200,
  },
  // Rural village: clustered houses + bocage fields.
  rural_village: {
    buildingMinMeanSize: 4,
    buildingMinCount: 5,
    forestMinMeanSize: 8,
    roadLargestFraction: null,
    hedgeMinTotal: 500,
  },
  // Open bocage: sparse buildings, dense hedge network is the *defining*
  // feature.
  rural_open: {
    buildingMinMeanSize: null, // hotspot ring may be only structures
    buildingMinCount: null,
    forestMinMeanSize: 6,
    roadLargestFraction: null,
    hedgeMinTotal: 5000,
  },
  // Forest: patches dominate, hedges and roads minimal but present.
  forest: {
    buildingMinMeanSize: null,
    buildingMinCount: null,
    forestMinMeanSize: 10,
    roadLargestFraction: null,
    hedgeMinTotal: 1000,
  },
  industrial: {
    buildingMinMeanSize: 6,
    buildingMinCount: 20,
    forestMinMeanSize: null,
    roadLargestFraction: 0.5,
    hedgeMinTotal: null,
  },
  mixed: {
    buildingMinMeanSize: 4,
    buildingMinCount: 5,
    forestMinMeanSize: 5,
    roadLargestFraction: null,
    hedgeMinTotal: 2000,
  },
  // Arid is parked pre-MVP; loose checks only.
  arid: {
    buildingMinMeanSize: null,
    buildingMinCount: null,
    forestMinMeanSize: null,
    roadLargestFraction: null,
    hedgeMinTotal: null,
  },
};

const BIOMES: BiomeId[] = [
  'urban_dense',
  'urban_sparse',
  'rural_village',
  'rural_open',
  'forest',
  'industrial',
  'mixed',
];

describe('structural fidelity (#277)', () => {
  for (const biome of BIOMES) {
    const m = BIOME_MINIMA[biome];

    it(`${biome}: building clusters meet minima`, () => {
      const samples = SEEDS.map((s) => measureStructural(runPipeline(req(biome, s))));
      const meanBuildingSize =
        samples.reduce((a, s) => a + s.buildings.meanSize, 0) / samples.length;
      const meanBuildingCount =
        samples.reduce((a, s) => a + s.buildings.count, 0) / samples.length;
      if (m.buildingMinMeanSize !== null) {
        expect(meanBuildingSize, `${biome} mean building cluster size`).toBeGreaterThanOrEqual(
          m.buildingMinMeanSize,
        );
      }
      if (m.buildingMinCount !== null) {
        expect(meanBuildingCount, `${biome} building cluster count`).toBeGreaterThanOrEqual(
          m.buildingMinCount,
        );
      }
    });

    it(`${biome}: forest patches meet minima`, () => {
      const samples = SEEDS.map((s) => measureStructural(runPipeline(req(biome, s))));
      const meanForestSize =
        samples.reduce((a, s) => a + s.forests.meanSize, 0) / samples.length;
      if (m.forestMinMeanSize !== null) {
        expect(meanForestSize, `${biome} mean forest patch size`).toBeGreaterThanOrEqual(
          m.forestMinMeanSize,
        );
      }
    });

    it(`${biome}: hedge network meets minima`, () => {
      const samples = SEEDS.map((s) => measureStructural(runPipeline(req(biome, s))));
      const meanHedgeTotal =
        samples.reduce((a, s) => a + s.hedges.totalTiles, 0) / samples.length;
      if (m.hedgeMinTotal !== null) {
        expect(meanHedgeTotal, `${biome} total hedge tiles`).toBeGreaterThanOrEqual(
          m.hedgeMinTotal,
        );
      }
    });

    it(`${biome}: road network is connected enough`, () => {
      const samples = SEEDS.map((s) => measureStructural(runPipeline(req(biome, s))));
      // At least one of three seeds must have a road that touches the map
      // edge — without that, the spawn placer's road-march entry has no
      // anchor.
      const anyEdge = samples.some((s) => s.roadReachesEdge);
      expect(anyEdge, `${biome} road reaches edge (any seed)`).toBe(true);
      if (m.roadLargestFraction !== null) {
        const meanFraction =
          samples.reduce(
            (a, s) =>
              a + (s.roads.totalTiles === 0 ? 0 : s.roads.largestSize / s.roads.totalTiles),
            0,
          ) / samples.length;
        expect(
          meanFraction,
          `${biome} largest road component fraction`,
        ).toBeGreaterThanOrEqual(m.roadLargestFraction);
      }
    });
  }
});
