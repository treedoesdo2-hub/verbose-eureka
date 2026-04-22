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

  it('emits objective anchors covering extract, defend, secure', () => {
    const r = runPipeline(req());
    const hints = new Set(r.objectiveAnchors.map((a) => a.kindHint));
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

  it('scales to 1024 within a generous per-gen budget', () => {
    const t0 = performance.now();
    const r = runPipeline(req({ size: 1024 }));
    const elapsed = performance.now() - t0;
    expect(r.width).toBe(1024);
    expect(r.terrain.length).toBe(1024 * 1024);
    // Generous ceiling — one-shot pre-match cost, not per-frame. Bail loud
    // if something regresses into seconds-per-tile territory.
    expect(elapsed).toBeLessThan(10000);
  });

  it('guarantees reachability between team0 and team1 deploy zones for 20 seeds', () => {
    const seeds = Array.from({ length: 20 }, (_, i) => `reach-seed-${i}`);
    const biomes: Array<'urban_sparse' | 'rural_open' | 'mixed'> = [
      'urban_sparse',
      'rural_open',
      'mixed',
    ];
    for (const seed of seeds) {
      for (const biome of biomes) {
        const r = runPipeline(req({ seed, biome, size: 96 }));
        const { team0, team1 } = r.deployZones;
        const W = r.width;
        const start = {
          x: Math.floor(team0.x + team0.w / 2),
          y: Math.floor(team0.y + team0.h / 2),
        };
        const goal = {
          x: Math.floor(team1.x + team1.w / 2),
          y: Math.floor(team1.y + team1.h / 2),
        };
        const visited = new Uint8Array(r.width * r.height);
        const queue: number[] = [start.y * W + start.x];
        visited[start.y * W + start.x] = 1;
        let reached = false;
        while (queue.length > 0) {
          const p = queue.shift() as number;
          const x = p % W;
          const y = (p - x) / W;
          if (x === goal.x && y === goal.y) {
            reached = true;
            break;
          }
          const candidates = [
            x > 0 ? p - 1 : -1,
            x < W - 1 ? p + 1 : -1,
            y > 0 ? p - W : -1,
            y < r.height - 1 ? p + W : -1,
          ];
          for (const n of candidates) {
            if (n < 0 || visited[n]) continue;
            if ((r.walkability[n] & 1) === 0) continue;
            visited[n] = 1;
            queue.push(n);
          }
        }
        expect(reached, `seed=${seed} biome=${biome} unreachable`).toBe(true);
      }
    }
  });
});
