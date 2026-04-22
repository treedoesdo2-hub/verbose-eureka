import { describe, expect, it } from 'vitest';
import { runPipeline } from './pipeline';
import type { MapGenRequest } from './types';

function req(overrides: Partial<MapGenRequest> = {}): MapGenRequest {
  return {
    seed: 'test-seed-1',
    biome: 'mixed',
    size: 128,
    tileSizeMeters: 1.5,
    generationVersion: 1,
    ...overrides,
  };
}

describe('mapgen pipeline', () => {
  it('produces byte-identical terrain for the same seed + biome + version', () => {
    const a = runPipeline(req({ seed: 'determinism-1' }));
    const b = runPipeline(req({ seed: 'determinism-1' }));
    expect(a.hash).toBe(b.hash);
    expect(a.terrain.length).toBe(b.terrain.length);
    for (let i = 0; i < a.terrain.length; i++) {
      expect(a.terrain[i]).toBe(b.terrain[i]);
    }
  });

  it('produces different terrain for different seeds', () => {
    const a = runPipeline(req({ seed: 'seed-a' }));
    const b = runPipeline(req({ seed: 'seed-b' }));
    expect(a.hash).not.toBe(b.hash);
  });

  it('produces different terrain across biomes', () => {
    const shared = { seed: 'same-seed', size: 128 };
    const a = runPipeline(req({ ...shared, biome: 'urban_sparse' }));
    const b = runPipeline(req({ ...shared, biome: 'rural_open' }));
    expect(a.hash).not.toBe(b.hash);
  });

  it('clears deploy zones of water and buildings so units can spawn', () => {
    const r = runPipeline(req());
    for (const zone of [r.deployZones.team0, r.deployZones.team1]) {
      for (let yy = zone.y; yy < zone.y + zone.h; yy++) {
        for (let xx = zone.x; xx < zone.x + zone.w; xx++) {
          const t = r.terrain[yy * r.width + xx];
          // Building=2, Water=4 — both impassable.
          expect(t).not.toBe(2);
          expect(t).not.toBe(4);
        }
      }
    }
  });

  it('bakes walkability to match terrain (buildings/water non-walkable)', () => {
    const r = runPipeline(req());
    for (let i = 0; i < r.terrain.length; i++) {
      const t = r.terrain[i];
      if (t === 2 || t === 4) {
        expect(r.walkability[i]).toBe(0);
      }
    }
  });

  it('bakes cover values consistent with terrain kind', () => {
    const r = runPipeline(req());
    for (let i = 0; i < r.terrain.length; i++) {
      const t = r.terrain[i];
      if (t === 2) expect(r.coverValue[i]).toBe(70);
      if (t === 3) expect(r.coverValue[i]).toBe(30);
      if (t === 5) expect(r.coverValue[i]).toBe(20);
    }
  });

  it('emits objective anchors covering eliminate, extract, defend, secure', () => {
    const r = runPipeline(req());
    const hints = new Set(r.objectiveAnchors.map((a) => a.kindHint));
    expect(hints.has('eliminate')).toBe(true);
    expect(hints.has('extract')).toBe(true);
    expect(hints.has('defend')).toBe(true);
    expect(hints.has('secure')).toBe(true);
  });

  it('scales to 512 without throwing', () => {
    const r = runPipeline(req({ size: 512 }));
    expect(r.width).toBe(512);
    expect(r.height).toBe(512);
    expect(r.terrain.length).toBe(512 * 512);
  });
});
