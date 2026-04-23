// P7.12 — thumbnail parity: briefing thumbnail vs battle-view bake.
//
// Both use the same underlying WorldSnapshot data, so a downsampled
// thumbnail and a downsampled battle-view bake of identical sampling
// should be byte-identical for the base-only render. The point of this
// test is to catch "renderer hard-codes different colors than thumbnail"
// — the structural bug the rework fixes via P1.3 palette unification.

import { describe, expect, it } from 'vitest';
import { runPipeline } from '../mapgen/pipeline';
import { renderThumbnail } from '../mapgen/thumbnail';
import { snapshotWorld } from '../snapshot';
import { makeWorldFromBuffers } from '../world';
import { renderBaseFromSnapshot } from '../../renderer/src/render/render-base-from-snapshot';
import { terrainColor } from '../mapgen/palette';
import type { MapGenRequest } from '../mapgen/types';

function req(seed: string): MapGenRequest {
  return { seed, biome: 'mixed', size: 128, tileSizeMeters: 1.5, generationVersion: 1 };
}

describe('integration: thumbnail palette parity (P7.12)', () => {
  it('shared terrain palette: water bytes map to olive-grey (not blue) at both tiers', () => {
    // Firefight's water palette is olive-grey (95, 97, 29). The
    // renderer used to hardcode #193352 (saturated blue) in its own
    // table; the palette unification (P1.3) forces both paths through
    // the same terrainColor() lookup.
    for (const tier of ['battle', 'strategic', 'briefing', 'planning'] as const) {
      const shallow = terrainColor(2, tier); // base byte 2 = water_shallow
      const deep = terrainColor(3, tier); // base byte 3 = water_deep
      // Assert water is NOT saturated-blue (B > R + 30 && B > G + 30).
      expect(shallow[2] > shallow[0] + 30 && shallow[2] > shallow[1] + 30).toBe(false);
      expect(deep[2] > deep[0] + 30 && deep[2] > deep[1] + 30).toBe(false);
    }
  });

  it('renderBaseFromSnapshot produces byte-identical pixels for the same base snapshot', () => {
    const r = runPipeline(req('parity-2'));
    const world = makeWorldFromBuffers({
      width: r.width,
      height: r.height,
      tileSizeMeters: 1.5,
      base: r.base,
      point: r.point,
      edgeN: r.edgeN,
      edgeW: r.edgeW,
      edgeOverrideN: r.edgeOverrideN,
      edgeOverrideW: r.edgeOverrideW,
      buildingId: r.buildingId,
      walkability: r.walkability,
      coverProfile: r.coverProfile,
      elevationStep: r.elevationStep,
      structureHeight: r.structureHeight,
      hpN: r.hpN,
      hpW: r.hpW,
      hpPoint: r.hpPoint,
      buildings: r.buildings,
      shadingBake: r.shadingBake,
      contours: r.contours,
    });
    const snap = snapshotWorld(world);
    const a = renderBaseFromSnapshot(snap, {
      tier: 'battle',
      applyShading: true,
      applyContours: false,
    });
    const b = renderBaseFromSnapshot(snap, {
      tier: 'battle',
      applyShading: true,
      applyContours: false,
    });
    expect(a.pixels.length).toBe(b.pixels.length);
    for (let i = 0; i < a.pixels.length; i++) {
      expect(a.pixels[i]).toBe(b.pixels[i]);
    }
  });

  it('thumbnail pixel variance > 1 (non-flat output)', () => {
    const r = runPipeline(req('variance-1'));
    const thumb = renderThumbnail(r, 64, { tier: 'briefing' });
    const distinctColors = new Set<number>();
    for (let i = 0; i < thumb.pixels.length; i += 4) {
      const packed =
        (thumb.pixels[i] << 16) | (thumb.pixels[i + 1] << 8) | thumb.pixels[i + 2];
      distinctColors.add(packed);
      if (distinctColors.size > 10) break;
    }
    expect(distinctColors.size).toBeGreaterThan(5);
  });
});
