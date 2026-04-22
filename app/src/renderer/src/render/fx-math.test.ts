import { describe, expect, it } from 'vitest';
import {
  direction,
  jitter,
  missDustColors,
  muzzleOffset,
  perp,
  pickMissColor,
  stanceFootprint,
  woundPaletteForZone,
} from './fx-math';

describe('direction', () => {
  it('returns length-0 zero vector for identical points', () => {
    const d = direction({ x: 5, y: 5 }, { x: 5, y: 5 });
    expect(d.len).toBe(0);
    expect(d.nx).toBe(0);
    expect(d.ny).toBe(0);
  });

  it('returns unit vector and length for 3-4-5 triangle', () => {
    const d = direction({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(d.len).toBe(5);
    expect(d.nx).toBeCloseTo(0.6);
    expect(d.ny).toBeCloseTo(0.8);
  });
});

describe('perp', () => {
  it('rotates x-axis 90 degrees to y-axis', () => {
    const { px, py } = perp(1, 0);
    expect(px).toBeCloseTo(0);
    expect(py).toBeCloseTo(1);
  });
});

describe('muzzleOffset', () => {
  it('projects along facing for standing unit', () => {
    const out = muzzleOffset(
      { x: 0, y: 0, facing: 0, stance: 'standing', actionKind: 'firing' },
      1.5,
    );
    // baseRadius 1.5 * 2.2 * scale 1.0 = 3.3.
    expect(out.x).toBeCloseTo(3.3);
    expect(out.y).toBeCloseTo(0);
  });

  it('pulls reach in for crouched unit', () => {
    const standing = muzzleOffset(
      { x: 0, y: 0, facing: 0, stance: 'standing', actionKind: 'firing' },
      1.5,
    );
    const crouched = muzzleOffset(
      { x: 0, y: 0, facing: 0, stance: 'crouched', actionKind: 'firing' },
      1.5,
    );
    expect(crouched.x).toBeLessThan(standing.x);
  });

  it('extends reach for prone unit along facing', () => {
    const standing = muzzleOffset(
      { x: 0, y: 0, facing: 0, stance: 'standing', actionKind: 'firing' },
      1.5,
    );
    const prone = muzzleOffset(
      { x: 0, y: 0, facing: 0, stance: 'prone', actionKind: 'firing' },
      1.5,
    );
    expect(prone.x).toBeGreaterThan(standing.x);
  });
});

describe('jitter', () => {
  it('is deterministic for the same seed and index', () => {
    const a = jitter({ tick: 5, a: 3, b: 7 }, 2);
    const b = jitter({ tick: 5, a: 3, b: 7 }, 2);
    expect(a).toBe(b);
  });

  it('produces distinct values for distinct indices', () => {
    const v0 = jitter({ tick: 5, a: 3, b: 7 }, 0);
    const v1 = jitter({ tick: 5, a: 3, b: 7 }, 1);
    const v2 = jitter({ tick: 5, a: 3, b: 7 }, 2);
    expect(v0).not.toBe(v1);
    expect(v1).not.toBe(v2);
  });

  it('stays within [-1, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const v = jitter({ tick: 12, a: i, b: 99 }, i);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('pickMissColor', () => {
  it('returns distinct colors per miss reason', () => {
    const acc = pickMissColor('accuracy');
    const cov = pickMissColor('cover');
    const rng = pickMissColor('range');
    expect(acc).not.toBe(cov);
    expect(cov).not.toBe(rng);
    expect(acc).not.toBe(rng);
  });

  it('returns a default color for null reason', () => {
    const c = pickMissColor(null);
    expect(typeof c).toBe('number');
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(0xffffff);
  });
});

describe('woundPaletteForZone', () => {
  it('returns heavier palette for torso/head', () => {
    const head = woundPaletteForZone('head');
    const torso = woundPaletteForZone('torso_front');
    expect(head.weight).toBeGreaterThan(1);
    expect(torso.weight).toBeGreaterThan(1);
  });

  it('returns lighter weight for limbs', () => {
    const arm = woundPaletteForZone('left_arm');
    expect(arm.weight).toBeLessThan(1);
  });

  it('returns generic palette for null zone', () => {
    const p = woundPaletteForZone(null);
    expect(p.weight).toBeCloseTo(1.0);
  });
});

describe('stanceFootprint', () => {
  it('prone has largest scale and flattest squash', () => {
    const prone = stanceFootprint('prone');
    const standing = stanceFootprint('standing');
    expect(prone.scale).toBeGreaterThan(standing.scale);
    expect(prone.squash).toBeLessThan(standing.squash);
  });

  it('crouched is smaller than standing', () => {
    const crouched = stanceFootprint('crouched');
    const standing = stanceFootprint('standing');
    expect(crouched.scale).toBeLessThan(standing.scale);
  });
});

describe('missDustColors', () => {
  it('returns a { light, dark } pair for any reason', () => {
    const a = missDustColors('accuracy');
    const c = missDustColors('cover');
    const r = missDustColors('range');
    for (const pair of [a, c, r, missDustColors(null)]) {
      expect(typeof pair.light).toBe('number');
      expect(typeof pair.dark).toBe('number');
    }
  });
});
