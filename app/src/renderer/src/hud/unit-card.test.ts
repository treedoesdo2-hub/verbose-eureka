import type { Operator } from '@schema/operator';
import type { SnapshotUnit } from '@shared/snapshot';
import { describe, expect, it } from 'vitest';
import { deriveUnitCard } from './unit-card';

function u(overrides: Partial<SnapshotUnit> = {}): SnapshotUnit {
  return {
    id: 1,
    teamId: 0,
    operatorId: null,
    x: 0,
    y: 0,
    facing: 0,
    blood: 100,
    suppression: 0,
    morale: 1,
    stance: 'standing',
    actionKind: 'idle',
    aiState: 'hold',
    alerted: false,
    ammo: 30,
    targetId: null,
    wounds: [],
    lastHeard: [],
    ...overrides,
  };
}

function op(id: string, callsign: string, name = 'Name'): Operator {
  return {
    id,
    name,
    callsign,
    tier: 'green',
    stats: { aim: 50, move: 50, grit: 50, awareness: 50, medical: 50 },
    defaultTemplateId: 'tmpl',
    origin: '',
    bio: '',
    cost: 0,
    dailyWage: 0,
    insurancePremium: 0,
  };
}

describe('deriveUnitCard', () => {
  const empty = new Map<number, SnapshotUnit>();
  const ops = new Map<string, Operator>([['alpha', op('alpha', 'ALPHA', 'Alice')]]);

  it('resolves callsign from operator when present', () => {
    const card = deriveUnitCard(u({ id: 5, operatorId: 'alpha' }), empty, ops);
    expect(card.callsign).toBe('ALPHA');
    expect(card.name).toBe('Alice');
  });

  it('falls back to unit-{id} when operatorId is null', () => {
    const card = deriveUnitCard(u({ id: 7, operatorId: null }), empty, ops);
    expect(card.callsign).toBe('unit-7');
    expect(card.name).toBeNull();
  });

  it('clamps blood and morale to [0, 1]', () => {
    expect(deriveUnitCard(u({ blood: 50 }), empty, ops).bloodPct).toBe(0.5);
    expect(deriveUnitCard(u({ blood: 150 }), empty, ops).bloodPct).toBe(1);
    expect(deriveUnitCard(u({ blood: -10 }), empty, ops).bloodPct).toBe(0);
    expect(deriveUnitCard(u({ morale: 1.5 }), empty, ops).moralePct).toBe(1);
    expect(deriveUnitCard(u({ morale: -0.2 }), empty, ops).moralePct).toBe(0);
  });

  it('resolves target when in unitsById', () => {
    const unitsById = new Map<number, SnapshotUnit>([[10, u({ id: 10, operatorId: 'alpha' })]]);
    const card = deriveUnitCard(u({ targetId: 10 }), unitsById, ops);
    expect(card.target?.id).toBe(10);
    expect(card.target?.callsign).toBe('ALPHA');
  });

  it('nulls target when not in unitsById', () => {
    const card = deriveUnitCard(u({ targetId: 999 }), empty, ops);
    expect(card.target).toBeNull();
  });

  it('picks worst wound severity', () => {
    const wounds = [
      { zone: 'left_arm' as const, severity: 'light', treatment: 'none', bleedRate: 0.1 },
      { zone: 'torso_front' as const, severity: 'critical', treatment: 'none', bleedRate: 0.8 },
      { zone: 'head' as const, severity: 'serious', treatment: 'none', bleedRate: 0.3 },
    ];
    const card = deriveUnitCard(u({ wounds }), empty, ops);
    expect(card.worstWoundSeverity).toBe('critical');
    expect(card.woundCount).toBe(3);
  });

  it('flags dead and downed action kinds', () => {
    expect(deriveUnitCard(u({ actionKind: 'dead' }), empty, ops).dead).toBe(true);
    expect(deriveUnitCard(u({ actionKind: 'downed' }), empty, ops).downed).toBe(true);
  });
});
