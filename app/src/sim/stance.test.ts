import type { BodyZone } from '@schema/common';
import { asUnitId } from '@shared/ids';
import { makeWeapon, makeZoneDr } from '@test-helpers/fixtures';
import { describe, expect, it } from 'vitest';
import { pickStance } from './ai/bt';
import { resolveShot } from './hit';
import { Rng } from './rng';
import {
  MORALE_PANIC_THRESHOLD,
  makeUnit,
  STANCE_AIM_BONUS,
  STANCE_MOVE_MULTIPLIER,
  type Stance,
  type Unit,
} from './unit';
import { makeWorld } from './world';

function targetStanced(stance: Stance, facing = Math.PI): Unit {
  const u = makeUnit({
    id: asUnitId(2),
    teamId: 1,
    operatorId: null,
    position: { x: 25, y: 10 },
    facing,
  });
  return { ...u, stance };
}

function shootFrom(shooter: Unit, target: Unit, iterations: number, seedBase = 1_000) {
  const world = makeWorld(64, 64, 1);
  const weapon = makeWeapon({ baseAccuracy: 90 });
  const dr = makeZoneDr();
  const hits: Partial<Record<BodyZone, number>> = {};
  for (let i = 0; i < iterations; i++) {
    const rng = new Rng(seedBase + i);
    const out = resolveShot({
      world,
      shooter,
      target,
      weapon,
      shooterAim: 80,
      targetZoneDr: dr,
      rng,
      tick: 0,
      nextWoundId: 1,
    });
    if (out.kind === 'wound') hits[out.zone] = (hits[out.zone] ?? 0) + 1;
  }
  return hits;
}

const shooter: Unit = (() => {
  const u = makeUnit({
    id: asUnitId(1),
    teamId: 0,
    operatorId: null,
    position: { x: 10, y: 10 },
    facing: 0,
  });
  return { ...u, stats: { ...u.stats, aim: 80 } };
})();

describe('stance constants', () => {
  it('prone is slowest, standing is fastest', () => {
    expect(STANCE_MOVE_MULTIPLIER.standing).toBeGreaterThan(STANCE_MOVE_MULTIPLIER.crouched);
    expect(STANCE_MOVE_MULTIPLIER.crouched).toBeGreaterThan(STANCE_MOVE_MULTIPLIER.prone);
  });

  it('lower stance grants more aim bonus (rewarding a stable base)', () => {
    expect(STANCE_AIM_BONUS.prone).toBeGreaterThan(STANCE_AIM_BONUS.crouched);
    expect(STANCE_AIM_BONUS.crouched).toBeGreaterThan(STANCE_AIM_BONUS.standing);
  });
});

describe('stance affects zone weighting', () => {
  it('prone targets take fewer head/torso hits than standing', () => {
    const iters = 3000;
    const standingHits = shootFrom(shooter, targetStanced('standing'), iters);
    const proneHits = shootFrom(shooter, targetStanced('prone'), iters);
    const headTorso = (h: Partial<Record<BodyZone, number>>): number =>
      (h.head ?? 0) + (h.torso_front ?? 0) + (h.torso_back ?? 0);
    expect(headTorso(proneHits)).toBeLessThan(headTorso(standingHits));
  });

  it('prone targets take more leg hits than standing', () => {
    const iters = 3000;
    const standingHits = shootFrom(shooter, targetStanced('standing'), iters);
    const proneHits = shootFrom(shooter, targetStanced('prone'), iters);
    const legs = (h: Partial<Record<BodyZone, number>>): number =>
      (h.left_leg ?? 0) + (h.right_leg ?? 0);
    expect(legs(proneHits)).toBeGreaterThan(legs(standingHits));
  });

  it('crouched is between standing and prone on head exposure', () => {
    const iters = 4000;
    const standing = shootFrom(shooter, targetStanced('standing'), iters).head ?? 0;
    const crouched = shootFrom(shooter, targetStanced('crouched'), iters).head ?? 0;
    const prone = shootFrom(shooter, targetStanced('prone'), iters).head ?? 0;
    expect(crouched).toBeLessThan(standing);
    expect(prone).toBeLessThan(crouched);
  });
});

describe('pickStance policy', () => {
  function unitWith(overrides: Partial<Unit>): Unit {
    const u = makeUnit({
      id: asUnitId(9),
      teamId: 0,
      operatorId: null,
      position: { x: 0, y: 0 },
      facing: 0,
    });
    return { ...u, ...overrides };
  }

  it('panicked units go prone regardless of suppression', () => {
    const u = unitWith({ stance: 'standing', suppression: 0, morale: MORALE_PANIC_THRESHOLD - 1 });
    expect(pickStance(u, { kind: 'idle' }, 'panic')).toBe('prone');
  });

  it('moving units stand up (no crawling sprint)', () => {
    const u = unitWith({ stance: 'prone', suppression: 80 });
    expect(pickStance(u, { kind: 'moving', target: { x: 10, y: 0 } }, 'advance')).toBe('standing');
  });

  it('pinned + holding → crouched', () => {
    const u = unitWith({ stance: 'standing', suppression: 80 });
    expect(pickStance(u, { kind: 'idle' }, 'hold')).toBe('crouched');
  });

  it('otherwise keeps current stance (deliberate choices stick)', () => {
    const u = unitWith({ stance: 'crouched', suppression: 0 });
    expect(pickStance(u, { kind: 'idle' }, 'hold')).toBe('crouched');
  });
});
