import { describe, expect, it } from 'vitest';
import { angularOffset, castRay, normalizeAngle } from './los';
import { makeWorld, setBase, setPoint } from './world';

describe('LOS raycast', () => {
  it('returns visible across open ground', () => {
    const w = makeWorld(64, 64, 1);
    expect(castRay(w, { x: 5, y: 5 }, 1.7, { x: 30, y: 5 }, 1.0)).toBe('visible');
  });

  it('is blocked by a tall point obstacle (storage_tank / well)', () => {
    const w = makeWorld(64, 64, 1);
    // storage_tank: full LOS, full cover, height 4.5m → blocks standing-eye ray
    for (let x = 10; x <= 15; x++) setPoint(w, x, 5, 'storage_tank');
    expect(castRay(w, { x: 5, y: 5 }, 1.7, { x: 20, y: 5 }, 1.0)).toBe('blocked');
  });

  it('is concealed by a narrow thin-LOS forest patch but not blocked', () => {
    const w = makeWorld(64, 64, 1);
    // tree_forest: thin LOS, one tile → accumulates 0.18 opacity, stays concealed
    setPoint(w, 12, 5, 'tree_forest');
    const r = castRay(w, { x: 5, y: 5 }, 1.7, { x: 20, y: 5 }, 1.0);
    expect(r).toBe('concealed');
  });

  it('visible over open water_shallow', () => {
    const w = makeWorld(64, 64, 1);
    setBase(w, 12, 5, 'water_shallow');
    expect(castRay(w, { x: 5, y: 5 }, 1.7, { x: 20, y: 5 }, 1.0)).toBe('visible');
  });
});

describe('angular helpers', () => {
  it('normalizeAngle returns [0, 2π)', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2);
  });

  it('angularOffset is always <= π', () => {
    expect(angularOffset(0, 0.1)).toBeCloseTo(0.1);
    expect(angularOffset(0, -0.1)).toBeCloseTo(0.1);
    expect(angularOffset(0, Math.PI * 1.9)).toBeCloseTo(Math.PI * 0.1);
  });
});
