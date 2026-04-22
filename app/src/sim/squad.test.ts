import { asUnitId, type UnitId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import {
  formationOffset,
  makeSquadRuntime,
  memberSlotIndex,
  pickLeader,
  promoteLeaders,
  type SquadRuntimeState,
} from './squad';
import { makeUnit, type Unit } from './unit';

function mkUnit(id: number, opts: Partial<Unit> = {}): Unit {
  const base = makeUnit({
    id: asUnitId(id),
    teamId: 0,
    operatorId: null,
    position: { x: 0, y: 0 },
    facing: 0,
  });
  return { ...base, ...opts };
}

function toMap(units: Unit[]): Map<UnitId, Unit> {
  const m = new Map<UnitId, Unit>();
  for (const u of units) m.set(u.id, u);
  return m;
}

describe('pickLeader', () => {
  it('returns the first combat-capable member', () => {
    const units = toMap([mkUnit(1), mkUnit(2), mkUnit(3)]);
    expect(pickLeader([asUnitId(1), asUnitId(2), asUnitId(3)], units)).toBe(asUnitId(1));
  });

  it('skips a dead first member and picks the next', () => {
    const dead = mkUnit(1, { action: { kind: 'dead' } });
    const units = toMap([dead, mkUnit(2)]);
    expect(pickLeader([asUnitId(1), asUnitId(2)], units)).toBe(asUnitId(2));
  });

  it('returns null when every member is down', () => {
    const a = mkUnit(1, { action: { kind: 'dead' } });
    const b = mkUnit(2, { action: { kind: 'downed' } });
    const units = toMap([a, b]);
    expect(pickLeader([asUnitId(1), asUnitId(2)], units)).toBeNull();
  });
});

describe('promoteLeaders', () => {
  it('returns the same map when every current leader is still fighting', () => {
    const units = toMap([mkUnit(1), mkUnit(2)]);
    const squads = new Map<string, SquadRuntimeState>([
      ['sq-a', makeSquadRuntime('sq-a', 0, [asUnitId(1), asUnitId(2)], asUnitId(1))],
    ]);
    const out = promoteLeaders(squads, units);
    expect(out).toBe(squads);
  });

  it('promotes the next member when the leader is dead', () => {
    const leader = mkUnit(1, { action: { kind: 'dead' } });
    const units = toMap([leader, mkUnit(2)]);
    const squads = new Map<string, SquadRuntimeState>([
      ['sq-a', makeSquadRuntime('sq-a', 0, [asUnitId(1), asUnitId(2)], asUnitId(1))],
    ]);
    const out = promoteLeaders(squads, units);
    expect(out.get('sq-a')?.leaderId).toBe(asUnitId(2));
  });

  it('sets leaderId to null when nobody is left standing', () => {
    const a = mkUnit(1, { action: { kind: 'dead' } });
    const b = mkUnit(2, { action: { kind: 'downed' } });
    const units = toMap([a, b]);
    const squads = new Map<string, SquadRuntimeState>([
      ['sq-a', makeSquadRuntime('sq-a', 0, [asUnitId(1), asUnitId(2)], asUnitId(1))],
    ]);
    const out = promoteLeaders(squads, units);
    expect(out.get('sq-a')?.leaderId).toBeNull();
  });
});

describe('formationOffset', () => {
  it('wedge puts slot 0 behind-left, slot 1 behind-right of the leader', () => {
    const leader = mkUnit(10, { position: { x: 0, y: 0 }, facing: 0 }); // facing +x
    const m = mkUnit(11);
    const off0 = formationOffset(leader, m, 0, 'wedge');
    const off1 = formationOffset(leader, m, 1, 'wedge');
    // Leader facing +x: forward=(1,0), right=(0,1). Left slot → y<0,
    // right slot → y>0. Both backward → x<0.
    expect(off0.x).toBeLessThan(0);
    expect(off0.y).toBeLessThan(0);
    expect(off1.x).toBeLessThan(0);
    expect(off1.y).toBeGreaterThan(0);
  });

  it('column stacks behind the leader along the facing axis', () => {
    const leader = mkUnit(10, { position: { x: 0, y: 0 }, facing: Math.PI / 2 }); // facing +y
    const m = mkUnit(11);
    const off = formationOffset(leader, m, 0, 'column');
    // Forward is +y → backward is -y. Lateral drift is zero.
    expect(off.y).toBeLessThan(0);
    expect(Math.abs(off.x)).toBeLessThan(0.01);
  });

  it('offsets are deterministic per (member, slot, formation)', () => {
    const leader = mkUnit(10, { facing: 1 });
    const m = mkUnit(42);
    const a = formationOffset(leader, m, 3, 'loose');
    const b = formationOffset(leader, m, 3, 'loose');
    expect(a.x).toBeCloseTo(b.x);
    expect(a.y).toBeCloseTo(b.y);
  });
});

describe('memberSlotIndex', () => {
  it('returns 0-based index skipping the leader', () => {
    const members = [asUnitId(1), asUnitId(2), asUnitId(3), asUnitId(4)];
    expect(memberSlotIndex(members, asUnitId(1), asUnitId(2))).toBe(0);
    expect(memberSlotIndex(members, asUnitId(1), asUnitId(3))).toBe(1);
    expect(memberSlotIndex(members, asUnitId(1), asUnitId(4))).toBe(2);
  });

  it('handles a leader in the middle of the list', () => {
    const members = [asUnitId(1), asUnitId(2), asUnitId(3), asUnitId(4)];
    expect(memberSlotIndex(members, asUnitId(2), asUnitId(1))).toBe(0);
    expect(memberSlotIndex(members, asUnitId(2), asUnitId(3))).toBe(1);
    expect(memberSlotIndex(members, asUnitId(2), asUnitId(4))).toBe(2);
  });
});
