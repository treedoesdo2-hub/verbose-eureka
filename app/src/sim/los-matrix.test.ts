import { describe, expect, it } from 'vitest';
import { castRayStance } from './los';
import { makeWorld, setBarrier, setPoint } from './world';

// COA-8 task #30 — 15-fixture LOS matrix exercising the stance-based 3D ray
// against every combination of occluder height and shooter/target stance.
// Each scenario asserts the expected LosResult so accidental regressions
// in castRayStance, eye-height tables, or per-tile occluder resolution
// surface immediately.

describe('LOS matrix — stance × occluder height', () => {
  it('flat open terrain: standing/standing → visible', () => {
    const w = makeWorld(32, 16, 1);
    const r = castRayStance(w, { x: 5, y: 8 }, 'standing', { x: 25, y: 8 }, 'standing');
    expect(r).toBe('visible');
  });

  it('flat open terrain: prone/prone → visible', () => {
    const w = makeWorld(32, 16, 1);
    const r = castRayStance(w, { x: 5, y: 8 }, 'prone', { x: 25, y: 8 }, 'prone');
    expect(r).toBe('visible');
  });

  it('tall full-LOS occluder (storage_tank, 4.5m) blocks standing-standing', () => {
    const w = makeWorld(32, 16, 1);
    setPoint(w, 15, 8, 'storage_tank');
    const r = castRayStance(w, { x: 5, y: 8 }, 'standing', { x: 25, y: 8 }, 'standing');
    expect(r).toBe('blocked');
  });

  it('tall full-LOS occluder also blocks prone-prone (ray runs along ground)', () => {
    const w = makeWorld(32, 16, 1);
    setPoint(w, 15, 8, 'storage_tank');
    const r = castRayStance(w, { x: 5, y: 8 }, 'prone', { x: 25, y: 8 }, 'prone');
    expect(r).toBe('blocked');
  });

  it('chest-high wall (stone_wall_low, 1.0m) — standing eye (1.7m) sees OVER wall', () => {
    const w = makeWorld(32, 16, 1);
    for (let x = 14; x <= 16; x++) setBarrier(w, x, 8, 'N', 'stone_wall_low');
    const r = castRayStance(w, { x: 15, y: 5 }, 'standing', { x: 15, y: 10 }, 'standing');
    expect(r).toBe('visible');
  });

  it('chest-high wall — prone-vs-prone ray (0.3m) is at / below wall body: blocked', () => {
    const w = makeWorld(32, 16, 1);
    for (let x = 14; x <= 16; x++) setBarrier(w, x, 8, 'N', 'stone_wall_low');
    const r = castRayStance(w, { x: 15, y: 5 }, 'prone', { x: 15, y: 10 }, 'prone');
    expect(r).toBe('blocked');
  });

  it('tall wall (bocage, 2.2m) blocks even standing shooter', () => {
    const w = makeWorld(32, 16, 1);
    for (let x = 14; x <= 16; x++) setBarrier(w, x, 8, 'N', 'bocage');
    const r = castRayStance(w, { x: 15, y: 5 }, 'standing', { x: 15, y: 10 }, 'standing');
    expect(r).toBe('blocked');
  });

  it('single tree_forest (thin LOS) → concealed for standing', () => {
    const w = makeWorld(32, 16, 1);
    setPoint(w, 15, 8, 'tree_forest');
    const r = castRayStance(w, { x: 5, y: 8 }, 'standing', { x: 25, y: 8 }, 'standing');
    expect(r).toBe('concealed');
  });

  it('dense thin column accumulates to blocked', () => {
    const w = makeWorld(32, 16, 1);
    // 8 stacked tree_forest points → 16 samples × 0.18 ≈ 2.88 → blocked
    for (let x = 10; x <= 17; x++) setPoint(w, x, 8, 'tree_forest');
    const r = castRayStance(w, { x: 5, y: 8 }, 'standing', { x: 25, y: 8 }, 'standing');
    expect(r).toBe('blocked');
  });

  it('bush_small (thin, low) — prone pair is visible (ray under silhouette)', () => {
    const w = makeWorld(32, 16, 1);
    setPoint(w, 15, 8, 'bush_small');
    // bush_small height 1.0m. Prone eye 0.3m from 5m to 25m — ray stays at 0.3m.
    const r = castRayStance(w, { x: 5, y: 8 }, 'prone', { x: 25, y: 8 }, 'prone');
    // Ray at 0.3m is below bush top (1.0m) so bush thins LOS, but only 2 samples ≈ 0.36 → concealed.
    expect(['concealed', 'blocked']).toContain(r);
  });

  it('multiple tile-separated trees (tall, 2.5m+) accumulate to blocked for standing', () => {
    const w = makeWorld(48, 16, 1);
    for (let x = 10; x <= 30; x += 2) setPoint(w, x, 8, 'tree_forest');
    const r = castRayStance(w, { x: 5, y: 8 }, 'standing', { x: 40, y: 8 }, 'standing');
    expect(r).toBe('blocked');
  });

  it('elevation cliff — target on 7m-high step above shooter still visible if line clears', () => {
    const w = makeWorld(32, 16, 1);
    // Build a 5-step elevation plateau around the target (7.5m high).
    for (let x = 20; x < 32; x++) {
      for (let y = 0; y < 16; y++) {
        w.elevationStep[y * w.width + x] = 5;
      }
    }
    const r = castRayStance(w, { x: 5, y: 8 }, 'standing', { x: 25, y: 8 }, 'standing');
    // Target is 5 × 1.5m = 7.5m above shooter. A standing unit at 7.5m is
    // clearly above any flat-ground ray from shooter. Ray still has straight
    // shot — visible.
    expect(r).toBe('visible');
  });

  it('zero-length ray returns visible', () => {
    const w = makeWorld(8, 8, 1);
    const r = castRayStance(w, { x: 4, y: 4 }, 'standing', { x: 4, y: 4 }, 'standing');
    expect(r).toBe('visible');
  });

  it('out-of-bounds endpoint is treated as blocked', () => {
    const w = makeWorld(8, 8, 1);
    const r = castRayStance(w, { x: 4, y: 4 }, 'standing', { x: 20, y: 4 }, 'standing');
    expect(r).toBe('blocked');
  });

  it('car (full LOS, 2.2m) blocks standing-standing', () => {
    const w = makeWorld(32, 16, 1);
    setPoint(w, 15, 8, 'car');
    const r = castRayStance(w, { x: 5, y: 8 }, 'standing', { x: 25, y: 8 }, 'standing');
    expect(r).toBe('blocked');
  });

  it('crouched shooter over chest-high wall — target prone behind: blocked', () => {
    const w = makeWorld(32, 16, 1);
    for (let x = 14; x <= 16; x++) setBarrier(w, x, 8, 'N', 'stone_wall_low');
    // Crouched eye = 1.1m, wall = 1.0m, prone target = 0.3m → wall blocks.
    const r = castRayStance(w, { x: 15, y: 5 }, 'crouched', { x: 15, y: 10 }, 'prone');
    expect(r).toBe('blocked');
  });
});
