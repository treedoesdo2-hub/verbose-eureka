import type { Operator } from '@schema/operator';
import type { SnapshotEvent, SnapshotUnit } from '@shared/snapshot';
import type { HudEventEntry } from './hud-types';

function callsignOf(
  unitId: number | null,
  unitsById: ReadonlyMap<number, SnapshotUnit>,
  ops: ReadonlyMap<string, Operator>,
): string {
  if (unitId === null) return '—';
  const u = unitsById.get(unitId);
  if (!u) return `unit-${unitId}`;
  if (u.operatorId) {
    const op = ops.get(u.operatorId);
    if (op) return op.callsign;
    return u.operatorId;
  }
  return `unit-${unitId}`;
}

export function formatEvent(
  ev: SnapshotEvent,
  unitsById: ReadonlyMap<number, SnapshotUnit>,
  ops: ReadonlyMap<string, Operator>,
): HudEventEntry | null {
  if (ev.kind === 'unit-fired') return null;

  if (ev.kind === 'unit-hit') {
    if (ev.outcome !== 'wound') return null;
    const shooter = callsignOf(ev.shooter, unitsById, ops);
    const target = callsignOf(ev.target, unitsById, ops);
    return {
      id: `unit-hit-${ev.tick}-${ev.shooter}-${ev.target}`,
      tick: ev.tick,
      severity: 'wound',
      text: `${shooter} hit ${target}${ev.zone ? ` (${ev.zone})` : ''}`,
    };
  }

  if (ev.kind === 'unit-downed') {
    const target = callsignOf(ev.unitId, unitsById, ops);
    return {
      id: `unit-downed-${ev.tick}-${ev.unitId}`,
      tick: ev.tick,
      severity: 'down',
      text: `${target} DOWN (${ev.cause})`,
    };
  }

  if (ev.kind === 'unit-died') {
    const target = callsignOf(ev.unitId, unitsById, ops);
    return {
      id: `unit-died-${ev.tick}-${ev.unitId}`,
      tick: ev.tick,
      severity: 'kill',
      text: `${target} KIA`,
    };
  }

  if (ev.kind === 'unit-stabilized') {
    const medic = callsignOf(ev.medicId, unitsById, ops);
    const target = callsignOf(ev.targetId, unitsById, ops);
    return {
      id: `unit-stabilized-${ev.tick}-${ev.medicId}-${ev.targetId}`,
      tick: ev.tick,
      severity: 'stabilize',
      text: `${medic} stabilized ${target}`,
    };
  }

  if (ev.kind === 'unit-pinned') {
    return {
      id: `unit-pinned-${ev.tick}-${ev.unitId}`,
      tick: ev.tick,
      severity: 'morale',
      text: `${callsignOf(ev.unitId, unitsById, ops)} pinned`,
    };
  }

  if (ev.kind === 'unit-broke') {
    return {
      id: `unit-broke-${ev.tick}-${ev.unitId}`,
      tick: ev.tick,
      severity: 'morale',
      text: `${callsignOf(ev.unitId, unitsById, ops)} BROKE`,
    };
  }

  if (ev.kind === 'unit-rallied') {
    return {
      id: `unit-rallied-${ev.tick}-${ev.unitId}`,
      tick: ev.tick,
      severity: 'morale',
      text: `${callsignOf(ev.unitId, unitsById, ops)} rallied`,
    };
  }

  return null;
}

export function appendEvents(
  current: readonly HudEventEntry[],
  incoming: readonly HudEventEntry[],
  cap = 60,
): HudEventEntry[] {
  if (incoming.length === 0) return current as HudEventEntry[];
  const seen = new Set<string>();
  for (const e of current) seen.add(e.id);
  const next: HudEventEntry[] = current.slice();
  for (const e of incoming) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    next.push(e);
  }
  if (next.length <= cap) return next;
  return next.slice(next.length - cap);
}
