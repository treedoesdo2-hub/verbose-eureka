import { describe, expect, it } from 'vitest';
import { angularOffset, castRay, normalizeAngle } from './los';
import { makeWorld, setTerrain } from './world';

describe('LOS raycast', () => {
  it('returns visible across open ground', () => {
    const w = makeWorld(64, 64, 1);
    expect(castRay(w, { x: 5, y: 5 }, 1.7, { x: 30, y: 5 }, 1.0)).toBe('visible');
  });

  it('is blocked by building', () => {
    const w = makeWorld(64, 64, 1);
    for (let x = 10; x <= 15; x++) setTerrain(w, x, 5, 'building');
    expect(castRay(w, { x: 5, y: 5 }, 1.7, { x: 20, y: 5 }, 1.0)).toBe('blocked');
  });

  it('is concealed by forest but not blocked', () => {
    const w = makeWorld(64, 64, 1);
    for (let x = 10; x <= 15; x++) setTerrain(w, x, 5, 'forest');
    const r = castRay(w, { x: 5, y: 5 }, 1.7, { x: 20, y: 5 }, 1.0);
    expect(r).toBe('concealed');
  });

  it('visible over open water-open sequence', () => {
    const w = makeWorld(64, 64, 1);
    setTerrain(w, 12, 5, 'water');
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
