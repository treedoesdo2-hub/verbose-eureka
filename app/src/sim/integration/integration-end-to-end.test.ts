// P7.11 — end-to-end integration test.
//
// Runs mapGenRequestFromContract → runPipeline → makeWorldFromBuffers →
// snapshotWorld, and asserts the feature inventory at each handoff
// stage is non-zero and carries forward consistently.
//
// This is the test that catches "features disappeared between stage N
// and stage N+1" regressions — the structural bug that motivated the
// rework.

import { describe, expect, it } from 'vitest';
import { runPipelineWithRetry } from '../mapgen/pipeline';
import { snapshotWorld } from '../snapshot';
import { makeWorldFromBuffers } from '../world';
import type { MapGenRequest } from '../mapgen/types';
import type { BiomeId } from '@schema/map';
import { inventoryFromMapGenResult, inventoryFromSnapshot } from './handoff-inventory';

const BIOMES: BiomeId[] = ['mixed', 'urban_dense', 'forest'];
const SEEDS = ['e2e-1', 'e2e-2', 'e2e-3', 'e2e-4', 'e2e-5', 'e2e-6', 'e2e-7', 'e2e-8', 'e2e-9', 'e2e-10'];
const SIZE = 192;

function req(biome: BiomeId, seed: string): MapGenRequest {
  return { seed, biome, size: SIZE, tileSizeMeters: 1.5, generationVersion: 1 };
}

describe('integration: end-to-end pipeline handoff (P7.11)', () => {
  for (const biome of BIOMES) {
    for (const seed of SEEDS) {
      it(`${biome} seed=${seed}: every stage preserves non-zero features`, () => {
        const result = runPipelineWithRetry(req(biome, seed));
        const resultInv = inventoryFromMapGenResult(result);

        // Every feature should be non-zero after mapgen.
        expect(resultInv.elevationNonZero, 'elevationNonZero').toBeGreaterThan(0);
        expect(resultInv.hotspots, 'hotspots').toBeGreaterThan(0);
        expect(resultInv.buildingCount, 'buildingCount').toBeGreaterThan(0);
        expect(resultInv.pointTiles, 'pointTiles').toBeGreaterThan(0);
        expect(resultInv.shadingDistinctBytes, 'shadingDistinctBytes').toBeGreaterThan(1);

        // World construction.
        const world = makeWorldFromBuffers({
          width: result.width,
          height: result.height,
          tileSizeMeters: 1.5,
          base: result.base,
          point: result.point,
          edgeN: result.edgeN,
          edgeW: result.edgeW,
          edgeOverrideN: result.edgeOverrideN,
          edgeOverrideW: result.edgeOverrideW,
          buildingId: result.buildingId,
          walkability: result.walkability,
          coverProfile: result.coverProfile,
          elevationStep: result.elevationStep,
          structureHeight: result.structureHeight,
          hpN: result.hpN,
          hpW: result.hpW,
          hpPoint: result.hpPoint,
          buildings: result.buildings,
          shadingBake: result.shadingBake,
          contours: result.contours,
        });

        // Snapshot.
        const snap = snapshotWorld(world);
        const snapInv = inventoryFromSnapshot(snap);

        // Preservation: every mapgen-stage feature must match the snapshot
        // stage. Tolerances allow no divergence.
        expect(snapInv.elevationNonZero).toBe(resultInv.elevationNonZero);
        expect(snapInv.buildingCount).toBe(resultInv.buildingCount);
        expect(snapInv.buildingTiles).toBe(resultInv.buildingTiles);
        expect(snapInv.pointTiles).toBe(resultInv.pointTiles);
        expect(snapInv.hedgeEdges).toBe(resultInv.hedgeEdges);
        expect(snapInv.shadingDistinctBytes).toBe(resultInv.shadingDistinctBytes);
      });
    }
  }
});
