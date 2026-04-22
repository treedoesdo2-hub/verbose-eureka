import { makeWeapon, makeZoneDr } from '@test-helpers/fixtures';
import { asUnitId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import { makeInitialState } from '../tick';
import { makeUnit, type Unit, type UnitAction } from '../unit';
import { makeWorld } from '../world';
import { decide } from './bt';
import type { PerceptionResult } from './perception';

// ADR 011 Pillar B: roles should differ in BT behavior. LMG doctrine is
// sustained fire for suppression; rifleman is controlled bursts. These
// tests pin the burst length so a future BT refactor can't silently
// flatten them back to identical.

function baseShooter(role: 'rifleman' | 'lmg'): Unit {
  return makeUnit({
    id: asUnitId(1),
    teamId: 0,
    operatorId: null,
    position: { x: 5, y: 5 },
    facing: 0,
    role,
    combat: {
      primaryWeapon: makeWeapon({ rpm: 600, rangeMeters: 100 }),
      sidearm: null,
      utilityIds: [],
      hasMedkit: false,
      zoneDr: makeZoneDr(),
      totalWeightKg: 3,
      mobilityPenalty: 0,
    },
  });
}

function targetUnit(): Unit {
  return makeUnit({
    id: asUnitId(2),
    teamId: 1,
    operatorId: null,
    position: { x: 15, y: 5 },
    facing: Math.PI,
  });
}

function perceivedAiming(targetId: ReturnType<typeof asUnitId>): PerceptionResult {
  return {
    observerId: asUnitId(1),
    spotted: [targetId],
    spottedAt: new Map([[targetId, { x: 15, y: 5 }]]),
    bestTarget: targetId,
  };
}

describe('BT role-specific firing', () => {
  it('LMG fires 8-round bursts (sustained suppression)', () => {
    const lmg = baseShooter('lmg');
    const target = targetUnit();
    const aimDone: UnitAction = {
      kind: 'aiming',
      targetId: target.id,
      ticksRemaining: 0,
    };
    const u = { ...lmg, action: aimDone };
    const state = makeInitialState(makeWorld(32, 32, 1), 1, [u, target]);
    const decision = decide(u, perceivedAiming(target.id), state);
    expect(decision.action.kind).toBe('firing');
    if (decision.action.kind !== 'firing') throw new Error('unreachable');
    expect(decision.action.roundsRemaining).toBe(8);
  });

  it('rifleman fires 3-round bursts (controlled)', () => {
    const rifle = baseShooter('rifleman');
    const target = targetUnit();
    const aimDone: UnitAction = {
      kind: 'aiming',
      targetId: target.id,
      ticksRemaining: 0,
    };
    const u = { ...rifle, action: aimDone };
    const state = makeInitialState(makeWorld(32, 32, 1), 1, [u, target]);
    const decision = decide(u, perceivedAiming(target.id), state);
    expect(decision.action.kind).toBe('firing');
    if (decision.action.kind !== 'firing') throw new Error('unreachable');
    expect(decision.action.roundsRemaining).toBe(3);
  });
});
