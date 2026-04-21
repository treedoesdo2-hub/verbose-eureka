import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng (xoshiro128**)', () => {
  it('is deterministic from seed', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    for (let i = 0; i < 1000; i++) {
      expect(a.nextU32()).toBe(b.nextU32());
    }
  });

  it('different seeds diverge within first 10 draws', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const firstA = Array.from({ length: 10 }, () => a.nextU32());
    const firstB = Array.from({ length: 10 }, () => b.nextU32());
    expect(firstA).not.toEqual(firstB);
  });

  it('produces floats in [0, 1)', () => {
    const r = new Rng(42);
    for (let i = 0; i < 10_000; i++) {
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('int(min, max) is in range', () => {
    const r = new Rng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = r.int(5, 15);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(15);
    }
  });

  it('snapshot + restore round-trips', () => {
    const r = new Rng(99);
    for (let i = 0; i < 100; i++) r.nextU32();
    const snap = r.snapshot();
    const nextA = [r.nextU32(), r.nextU32(), r.nextU32()];
    r.restore(snap);
    const nextB = [r.nextU32(), r.nextU32(), r.nextU32()];
    expect(nextA).toEqual(nextB);
  });

  it('avoids all-zero state', () => {
    const r = new Rng(0);
    const v = r.nextU32();
    expect(v).not.toBe(0);
  });
});
