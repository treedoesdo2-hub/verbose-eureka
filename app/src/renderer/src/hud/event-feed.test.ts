import type { Operator } from '@schema/operator';
import type { SnapshotEvent, SnapshotUnit } from '@shared/snapshot';
import { describe, expect, it } from 'vitest';
import { appendEvents, formatEvent } from './event-feed';
import type { HudEventEntry } from './hud-types';

function u(id: number, operatorId: string | null = null): SnapshotUnit {
  return {
    id,
    teamId: 0,
    operatorId,
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
  };
}

function op(id: string, callsign: string): Operator {
  return {
    id,
    name: 'Name',
    callsign,
    tier: 'green',
    stats: { aim: 50, move: 50, grit: 50, awareness: 50, medical: 50 },
    defaultTemplateId: 'tmpl',
    origin: '',
    bio: '',
    cost: 0,
  };
}

describe('formatEvent', () => {
  const unitsById = new Map<number, SnapshotUnit>([
    [1, u(1, 'alpha')],
    [2, u(2, null)],
  ]);
  const ops = new Map<string, Operator>([['alpha', op('alpha', 'ALPHA')]]);

  it('suppresses unit-fired', () => {
    const ev: SnapshotEvent = { kind: 'unit-fired', shooter: 1, target: 2, tick: 5 };
    expect(formatEvent(ev, unitsById, ops)).toBeNull();
  });

  it('suppresses miss and block outcomes', () => {
    const miss: SnapshotEvent = {
      kind: 'unit-hit',
      shooter: 1,
      target: 2,
      outcome: 'miss',
      zone: null,
      woundId: null,
      reason: 'cover',
      tick: 6,
    };
    const block: SnapshotEvent = {
      kind: 'unit-hit',
      shooter: 1,
      target: 2,
      outcome: 'block',
      zone: 'torso_front',
      woundId: null,
      reason: null,
      tick: 7,
    };
    expect(formatEvent(miss, unitsById, ops)).toBeNull();
    expect(formatEvent(block, unitsById, ops)).toBeNull();
  });

  it('emits wound with zone and shooter callsign', () => {
    const ev: SnapshotEvent = {
      kind: 'unit-hit',
      shooter: 1,
      target: 2,
      outcome: 'wound',
      zone: 'torso_front',
      woundId: 10,
      reason: null,
      tick: 8,
    };
    const entry = formatEvent(ev, unitsById, ops);
    expect(entry?.severity).toBe('wound');
    expect(entry?.text).toContain('ALPHA');
    expect(entry?.text).toContain('torso_front');
  });

  it('emits DOWN and cause on downed', () => {
    const ev: SnapshotEvent = { kind: 'unit-downed', unitId: 2, cause: 'combat', tick: 9 };
    const entry = formatEvent(ev, unitsById, ops);
    expect(entry?.severity).toBe('down');
    expect(entry?.text).toContain('DOWN');
    expect(entry?.text).toContain('combat');
  });

  it('emits kill severity for unit-died', () => {
    const ev: SnapshotEvent = { kind: 'unit-died', unitId: 2, tick: 10 };
    const entry = formatEvent(ev, unitsById, ops);
    expect(entry?.severity).toBe('kill');
    expect(entry?.text).toContain('KIA');
  });

  it('falls back to unit-N when operator id is null', () => {
    const ev: SnapshotEvent = { kind: 'unit-died', unitId: 2, tick: 11 };
    const entry = formatEvent(ev, unitsById, ops);
    expect(entry?.text).toContain('unit-2');
  });

  it('produces a deterministic id per event', () => {
    const ev: SnapshotEvent = { kind: 'unit-downed', unitId: 2, cause: 'bleedout', tick: 12 };
    const a = formatEvent(ev, unitsById, ops);
    const b = formatEvent(ev, unitsById, ops);
    expect(a?.id).toBe(b?.id);
  });

  it('maps pinned/broke/rallied to morale severity', () => {
    const pinned: SnapshotEvent = { kind: 'unit-pinned', unitId: 1, tick: 13 };
    const broke: SnapshotEvent = { kind: 'unit-broke', unitId: 1, tick: 14 };
    const rally: SnapshotEvent = { kind: 'unit-rallied', unitId: 1, tick: 15 };
    expect(formatEvent(pinned, unitsById, ops)?.severity).toBe('morale');
    expect(formatEvent(broke, unitsById, ops)?.severity).toBe('morale');
    expect(formatEvent(rally, unitsById, ops)?.severity).toBe('morale');
  });
});

describe('appendEvents', () => {
  function entry(id: string, tick = 1): HudEventEntry {
    return { id, tick, severity: 'wound', text: id };
  }

  it('appends new entries to the end', () => {
    const out = appendEvents([entry('a')], [entry('b'), entry('c')], 10);
    expect(out.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('caps length by dropping oldest', () => {
    const out = appendEvents([entry('a'), entry('b')], [entry('c')], 2);
    expect(out.map((e) => e.id)).toEqual(['b', 'c']);
  });

  it('deduplicates by id', () => {
    const out = appendEvents([entry('a')], [entry('a'), entry('b')], 10);
    expect(out.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('returns current reference when incoming is empty', () => {
    const cur = [entry('a')];
    const out = appendEvents(cur, [], 5);
    expect(out).toBe(cur);
  });
});
