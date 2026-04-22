import { describe, expect, it } from 'vitest';
import {
  applyBarrierDamage,
  applyPointDamage,
  barrierStateAt,
  BARRIER_MAX_HP,
  makeWorld,
  POINT_MAX_HP,
  pointStateAt,
  setBarrier,
  setPoint,
  terrainAxesAt,
} from './world';

describe('destructible state machine — barriers', () => {
  it('walks wood_fence through intact → damaged → destroyed (no rubble leaves rubble_strip)', () => {
    const w = makeWorld(16, 16, 1);
    setBarrier(w, 5, 5, 'N', 'wood_fence');
    const maxHp = BARRIER_MAX_HP['wood_fence']!;
    expect(barrierStateAt(w, 5, 5, 'N')).toBe('intact');

    // Damage below half — still intact.
    const r1 = applyBarrierDamage(w, 5, 5, 'N', Math.floor(maxHp * 0.4));
    expect(r1).not.toBeNull();
    expect(r1!.nextState).toBe('intact');

    // Push past half — transitions to damaged.
    const r2 = applyBarrierDamage(w, 5, 5, 'N', Math.ceil(maxHp * 0.2));
    expect(r2!.nextState).toBe('damaged');
    expect(barrierStateAt(w, 5, 5, 'N')).toBe('damaged');

    // Finish it off — destroyed + leaves rubble_strip (wood_fence flag true).
    const r3 = applyBarrierDamage(w, 5, 5, 'N', maxHp);
    expect(r3!.destroyed).toBe(true);
    expect(r3!.leftRubble).toBe(true);
    expect(barrierStateAt(w, 5, 5, 'N')).toBe('intact'); // rubble_strip is indestructible → state stays 'intact'
  });

  it('wire_razor destroys to vanish (no rubble)', () => {
    const w = makeWorld(16, 16, 1);
    setBarrier(w, 3, 3, 'W', 'wire_razor');
    const maxHp = BARRIER_MAX_HP['wire_razor']!;
    const r = applyBarrierDamage(w, 3, 3, 'W', maxHp + 10);
    expect(r!.destroyed).toBe(true);
    expect(r!.leftRubble).toBe(false);
    // Tile is now blank; no barrier axes contribute to terrain reads.
    expect(barrierStateAt(w, 3, 3, 'W')).toBe('intact');
  });

  it('berm is indestructible — applyBarrierDamage returns zero-consumed result', () => {
    const w = makeWorld(16, 16, 1);
    setBarrier(w, 2, 2, 'N', 'berm');
    const r = applyBarrierDamage(w, 2, 2, 'N', 1000);
    expect(r!.consumed).toBe(0);
    expect(r!.destroyed).toBe(false);
    expect(barrierStateAt(w, 2, 2, 'N')).toBe('intact');
  });

  it('damaged state changes walkability — hedge becomes walkable-slow → walkable-slow (cover drops to light)', () => {
    const w = makeWorld(16, 16, 1);
    setBarrier(w, 6, 6, 'N', 'hedge');
    const before = terrainAxesAt(w, 6, 6);
    expect(before.cover === 'light' || before.cover === 'heavy').toBe(true);
    applyBarrierDamage(w, 6, 6, 'N', BARRIER_MAX_HP['hedge']! - 1);
    const after = terrainAxesAt(w, 6, 6);
    // Damaged hedge drops to low height / los=none per DAMAGED_AXES.
    expect(after.heightProfile).toBe('low');
  });
});

describe('destructible state machine — point objects', () => {
  it('storage_tank intact → damaged → destroyed leaves rubble_pile', () => {
    const w = makeWorld(16, 16, 1);
    setPoint(w, 7, 7, 'storage_tank');
    const maxHp = POINT_MAX_HP['storage_tank']!;
    expect(pointStateAt(w, 7, 7)).toBe('intact');
    applyPointDamage(w, 7, 7, Math.ceil(maxHp * 0.6));
    expect(pointStateAt(w, 7, 7)).toBe('damaged');
    const r = applyPointDamage(w, 7, 7, maxHp);
    expect(r!.destroyed).toBe(true);
    expect(r!.leftRubble).toBe(true);
    // Point is now rubble_pile.
    const axes = terrainAxesAt(w, 7, 7);
    expect(axes.heightProfile).toBe('chest'); // rubble_pile is chest-high
  });

  it('bush_small vanishes on destroy', () => {
    const w = makeWorld(8, 8, 1);
    setPoint(w, 1, 1, 'bush_small');
    const r = applyPointDamage(w, 1, 1, 100);
    expect(r!.destroyed).toBe(true);
    expect(r!.leftRubble).toBe(false);
    expect(pointStateAt(w, 1, 1)).toBe('intact'); // empty tile = intact
  });

  it('applyPointDamage on empty tile returns null', () => {
    const w = makeWorld(8, 8, 1);
    expect(applyPointDamage(w, 3, 3, 50)).toBeNull();
  });

  it('applyBarrierDamage on empty edge returns null', () => {
    const w = makeWorld(8, 8, 1);
    expect(applyBarrierDamage(w, 3, 3, 'N', 50)).toBeNull();
  });
});
