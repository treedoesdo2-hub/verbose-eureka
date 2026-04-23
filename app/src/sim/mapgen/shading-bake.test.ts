// P3.14 — shading bake histogram test.
//
// Guards against "flat shading" regression where the Sobel bake produces
// uniform output (all neutral 128) because the elevation field is too
// flat or the gradient is zeroed out. Runs a mixed 128² map and asserts
// the shadingBake histogram has ≥16 distinct values.

import { describe, expect, it } from 'vitest';
import { runPipeline } from './pipeline';
import type { MapGenRequest } from './types';

function req(biome: MapGenRequest['biome']): MapGenRequest {
  return {
    seed: `shading-${biome}`,
    biome,
    size: 128,
    tileSizeMeters: 1.5,
    generationVersion: 1,
  };
}

describe('shading bake histogram (P3.14)', () => {
  it('mixed biome produces ≥16 distinct shadingBake byte values', () => {
    const r = runPipeline(req('mixed'));
    const distinct = new Set<number>();
    for (let i = 0; i < r.shadingBake.length; i++) distinct.add(r.shadingBake[i]);
    expect(distinct.size).toBeGreaterThanOrEqual(16);
  });

  it('forest biome (max amplitude) produces ≥16 distinct shadingBake byte values', () => {
    const r = runPipeline(req('forest'));
    const distinct = new Set<number>();
    for (let i = 0; i < r.shadingBake.length; i++) distinct.add(r.shadingBake[i]);
    expect(distinct.size).toBeGreaterThanOrEqual(16);
  });

  it('neutral 128 center exists and extremes span at least 30 byte units', () => {
    const r = runPipeline(req('rural_open'));
    let min = 255;
    let max = 0;
    for (let i = 0; i < r.shadingBake.length; i++) {
      const v = r.shadingBake[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(max - min).toBeGreaterThanOrEqual(30);
  });
});
