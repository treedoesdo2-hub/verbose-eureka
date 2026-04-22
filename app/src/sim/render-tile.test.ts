import { describe, expect, it } from 'vitest';
import {
  applyPointDamage,
  getRenderTile,
  makeWorld,
  POINT_MAX_HP,
  setBarrier,
  setBase,
  setPoint,
} from './world';

describe('getRenderTile', () => {
  it('returns null out of bounds', () => {
    const w = makeWorld(8, 8, 1);
    expect(getRenderTile(w, -1, 0)).toBeNull();
    expect(getRenderTile(w, 8, 0)).toBeNull();
    expect(getRenderTile(w, 0, -1)).toBeNull();
    expect(getRenderTile(w, 0, 8)).toBeNull();
  });

  it('reads the default open tile', () => {
    const w = makeWorld(8, 8, 1);
    const t = getRenderTile(w, 3, 3);
    expect(t).not.toBeNull();
    expect(t!.base).toBe('open');
    expect(t!.point).toBeNull();
    expect(t!.buildingId).toBe(0);
    expect(t!.elevationStep).toBe(0);
    expect(t!.edgeN.kind).toBeNull();
    expect(t!.edgeW.kind).toBeNull();
    expect(t!.strongestAxes.move).toBe('walkable-free');
  });

  it('combines base + point into strongestAxes', () => {
    const w = makeWorld(8, 8, 1);
    setBase(w, 2, 2, 'road');
    setPoint(w, 2, 2, 'storage_tank');
    const t = getRenderTile(w, 2, 2)!;
    expect(t.base).toBe('road');
    expect(t.point).toBe('storage_tank');
    // storage_tank dominates: full LOS + full cover + 4.5m
    expect(t.strongestAxes.los).toBe('full');
    expect(t.strongestAxes.cover).toBe('full');
    expect(t.strongestAxes.heightProfile).toBe('full');
  });

  it('reflects damaged point state', () => {
    const w = makeWorld(8, 8, 1);
    setPoint(w, 1, 1, 'car');
    const maxHp = POINT_MAX_HP['car']!;
    applyPointDamage(w, 1, 1, Math.ceil(maxHp * 0.6));
    const t = getRenderTile(w, 1, 1)!;
    expect(t.pointDamaged).toBe(true);
  });

  it('reports edgeN barrier with door-open override', () => {
    const w = makeWorld(8, 8, 1);
    setBarrier(w, 4, 4, 'N', 'wood_fence');
    const t = getRenderTile(w, 4, 4)!;
    expect(t.edgeN.kind).toBe('wood_fence');
    expect(t.edgeN.damaged).toBe(false);
    expect(t.edgeN.doorOpen).toBe(false);
  });

  it('elevationMeters = elevationStep × 1.5', () => {
    const w = makeWorld(8, 8, 1);
    w.elevationStep[2 * 8 + 3] = 4;
    const t = getRenderTile(w, 3, 2)!;
    expect(t.elevationStep).toBe(4);
    expect(t.elevationMeters).toBeCloseTo(6);
  });

  it('resolves buildingId to the matching BuildingRecord', () => {
    const w = makeWorld(8, 8, 1);
    // Manually splice a building record — buildings registry is treated as
    // append-only by the pipeline so direct mutation here is fine for tests.
    const footprint = [{ x: 5, y: 5 }];
    (w as { -readonly [K in keyof typeof w]: (typeof w)[K] }).buildings = [
      { id: 1, family: 'house_red_tiles', floors: 2, footprintTiles: footprint, wallHpInitial: 120 },
    ];
    w.buildingId[5 * 8 + 5] = 1;
    const t = getRenderTile(w, 5, 5)!;
    expect(t.buildingId).toBe(1);
    expect(t.building?.family).toBe('house_red_tiles');
    expect(t.building?.floors).toBe(2);
  });
});
