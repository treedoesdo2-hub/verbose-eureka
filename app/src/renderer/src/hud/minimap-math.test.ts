import type { WorldSnapshot } from '@shared/snapshot';
import { describe, expect, it } from 'vitest';
import {
  computeMinimapProjection,
  projectUnit,
  terrainIndex,
  unprojectPoint,
} from './minimap-math';

function mkWorld(w: number, h: number, tileSize = 1): WorldSnapshot {
  const n = w * h;
  const shading = new Uint8ClampedArray(n);
  shading.fill(128);
  return {
    width: w,
    height: h,
    tileSizeMeters: tileSize,
    base: new Uint8Array(n),
    point: new Uint8Array(n),
    buildingId: new Uint16Array(n),
    edgeN: new Uint8Array(n),
    edgeW: new Uint8Array(n),
    elevationStep: new Uint8Array(n),
    structureHeight: new Uint8Array(n),
    buildings: [],
    shadingBake: shading,
    contours: new Uint8Array(n),
  };
}

describe('computeMinimapProjection', () => {
  it('fits a square world into a square box with no letterboxing', () => {
    const proj = computeMinimapProjection(mkWorld(100, 100), 200);
    expect(proj.scale).toBeCloseTo(2);
    expect(proj.offsetX).toBeCloseTo(0);
    expect(proj.offsetY).toBeCloseTo(0);
    expect(proj.width).toBeCloseTo(200);
    expect(proj.height).toBeCloseTo(200);
  });

  it('letterboxes vertically for a wide world', () => {
    const proj = computeMinimapProjection(mkWorld(200, 100), 200);
    expect(proj.offsetY).toBeGreaterThan(0);
    expect(proj.offsetX).toBeCloseTo(0);
  });

  it('letterboxes horizontally for a tall world', () => {
    const proj = computeMinimapProjection(mkWorld(50, 200), 200);
    expect(proj.offsetX).toBeGreaterThan(0);
    expect(proj.offsetY).toBeCloseTo(0);
  });
});

describe('projectUnit', () => {
  it('maps the origin to the projection offset', () => {
    const proj = computeMinimapProjection(mkWorld(200, 100), 200);
    const p = projectUnit({ x: 0, y: 0 }, proj);
    expect(p.px).toBeCloseTo(proj.offsetX);
    expect(p.py).toBeCloseTo(proj.offsetY);
  });

  it('maps the far corner within the target size', () => {
    const proj = computeMinimapProjection(mkWorld(100, 100), 200);
    const p = projectUnit({ x: 100, y: 100 }, proj);
    expect(p.px).toBeCloseTo(200);
    expect(p.py).toBeCloseTo(200);
  });
});

describe('unprojectPoint', () => {
  it('inverts projectUnit', () => {
    const proj = computeMinimapProjection(mkWorld(100, 100), 200);
    const p = projectUnit({ x: 42.5, y: 17.25 }, proj);
    const back = unprojectPoint(p.px, p.py, proj);
    expect(back?.wx).toBeCloseTo(42.5);
    expect(back?.wy).toBeCloseTo(17.25);
  });
});

describe('terrainIndex', () => {
  it('returns 0 for out-of-bounds', () => {
    const w = mkWorld(4, 4);
    w.base[0] = 3;
    expect(terrainIndex(w, -1, 0)).toBe(0);
    expect(terrainIndex(w, 0, -1)).toBe(0);
    expect(terrainIndex(w, 4, 0)).toBe(0);
    expect(terrainIndex(w, 0, 4)).toBe(0);
  });

  it('returns the stored value for in-bounds', () => {
    const w = mkWorld(4, 4);
    w.base[5] = 2; // y=1, x=1
    expect(terrainIndex(w, 1, 1)).toBe(2);
  });
});
