import { asUnitId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import type { Stance } from './los';
import { makeUnit, type Unit } from './unit';
import { checkSight } from './vision';
import { makeWorld, setBarrier, type World } from './world';

describe('three-tier vision', () => {
  it('detects target in focused cone directly ahead', () => {
    const w = makeWorld(64, 64, 1);
    const observer = {
      ...makeUnit({
        id: asUnitId(1),
        teamId: 0,
        operatorId: null,
        position: { x: 10, y: 10 },
        facing: 0,
      }),
    };
    const target = makeUnit({
      id: asUnitId(2),
      teamId: 1,
      operatorId: null,
      position: { x: 30, y: 10 },
      facing: Math.PI,
    });
    const r = checkSight(w, observer, target);
    expect(r.tier).toBe('focused');
    expect(r.detected).toBe(true);
  });

  it('misses target far outside cone and peripheral range', () => {
    const w = makeWorld(256, 256, 1);
    const observer = makeUnit({
      id: asUnitId(1),
      teamId: 0,
      operatorId: null,
      position: { x: 10, y: 10 },
      facing: 0,
    });
    const target = makeUnit({
      id: asUnitId(2),
      teamId: 1,
      operatorId: null,
      position: { x: 10, y: 200 },
      facing: 0,
    });
    const r = checkSight(w, observer, target);
    expect(r.tier).toBe('none');
    expect(r.detected).toBe(false);
  });

  it('peripheral bubble catches close targets even behind', () => {
    const w = makeWorld(64, 64, 1);
    const observer = makeUnit({
      id: asUnitId(1),
      teamId: 0,
      operatorId: null,
      position: { x: 20, y: 20 },
      facing: 0,
    });
    const target = makeUnit({
      id: asUnitId(2),
      teamId: 1,
      operatorId: null,
      position: { x: 15, y: 20 },
      facing: 0,
    });
    const r = checkSight(w, observer, target);
    expect(r.tier).toBe('peripheral');
  });

  it('alerted state extends range to 360°', () => {
    const w = makeWorld(256, 256, 1);
    const observer = {
      ...makeUnit({
        id: asUnitId(1),
        teamId: 0,
        operatorId: null,
        position: { x: 100, y: 100 },
        facing: 0,
      }),
      alerted: true,
    };
    const target = makeUnit({
      id: asUnitId(2),
      teamId: 1,
      operatorId: null,
      position: { x: 100, y: 200 },
      facing: 0,
    });
    const r = checkSight(w, observer, target);
    expect(r.tier).toBe('alerted');
  });
});

// COA-8 task #33 — stance + elevation regression tests.

function unitStance(
  id: number,
  team: number,
  pos: { x: number; y: number },
  facing: number,
  stance: Stance,
): Unit {
  const u = makeUnit({
    id: asUnitId(id),
    teamId: team,
    operatorId: null,
    position: pos,
    facing,
  });
  return { ...u, stance };
}

function setStep(world: World, x: number, y: number, step: number): void {
  world.elevationStep[y * world.width + x] = step;
}

describe('vision — stance passthrough to LOS', () => {
  it('prone observer behind chest-high wall cannot see prone target', () => {
    const w = makeWorld(32, 16, 1);
    for (let x = 14; x <= 16; x++) setBarrier(w, x, 8, 'N', 'stone_wall_low');
    const observer = unitStance(1, 0, { x: 15, y: 5 }, Math.PI / 2, 'prone');
    const target = unitStance(2, 1, { x: 15, y: 10 }, 0, 'prone');
    const r = checkSight(w, observer, target);
    expect(r.los).toBe('blocked');
    expect(r.detected).toBe(false);
  });

  it('standing observer sees OVER the same chest-high wall', () => {
    const w = makeWorld(32, 16, 1);
    for (let x = 14; x <= 16; x++) setBarrier(w, x, 8, 'N', 'stone_wall_low');
    const observer = unitStance(1, 0, { x: 15, y: 5 }, Math.PI / 2, 'standing');
    const target = unitStance(2, 1, { x: 15, y: 10 }, 0, 'standing');
    const r = checkSight(w, observer, target);
    expect(r.los).toBe('visible');
  });
});

describe('vision — high-ground elevation range bonus', () => {
  it('observer with 6m elevation advantage detects a focused-cone target at normal-range distance', () => {
    const w = makeWorld(64, 64, 1);
    // Observer on a plateau 4 steps up (6m).
    setStep(w, 10, 10, 4);
    const observer = unitStance(1, 0, { x: 10, y: 10 }, Math.PI / 2, 'standing');
    const target = unitStance(2, 1, { x: 10, y: 40 }, 0, 'standing');
    const r = checkSight(w, observer, target);
    expect(r.tier).toBe('focused');
    expect(r.detected).toBe(true);
  });

  it('observer LOOKING UP (target higher) gets no bonus — tier still derived from base range', () => {
    const w = makeWorld(64, 64, 1);
    setStep(w, 10, 40, 4);
    const observer = unitStance(1, 0, { x: 10, y: 10 }, Math.PI / 2, 'standing');
    const target = unitStance(2, 1, { x: 10, y: 40 }, 0, 'standing');
    const r = checkSight(w, observer, target);
    // No bonus — but at 30m, target is still well inside base 250m range.
    expect(r.tier).toBe('focused');
  });

  it('flat-ground observer matches high-ground observer when both are close in', () => {
    const wFlat = makeWorld(64, 64, 1);
    const wHigh = makeWorld(64, 64, 1);
    setStep(wHigh, 10, 10, 4);
    const obsFlat = unitStance(1, 0, { x: 10, y: 10 }, Math.PI / 2, 'standing');
    const obsHigh = unitStance(1, 0, { x: 10, y: 10 }, Math.PI / 2, 'standing');
    const tgt = unitStance(2, 1, { x: 10, y: 20 }, 0, 'standing');
    expect(checkSight(wFlat, obsFlat, tgt).detected).toBe(true);
    expect(checkSight(wHigh, obsHigh, tgt).detected).toBe(true);
  });
});
