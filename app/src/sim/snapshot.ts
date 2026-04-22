import type { SimSnapshot, SnapshotEvent, SnapshotUnit, WorldSnapshot } from '@shared/snapshot';
import type { SimState } from './state';
import type { World } from './world';

export function snapshotState(state: SimState): SimSnapshot {
  const units: SnapshotUnit[] = [];
  for (const u of state.units.values()) {
    units.push({
      id: u.id,
      teamId: u.teamId,
      operatorId: u.operatorId,
      x: u.position.x,
      y: u.position.y,
      facing: u.facing,
      blood: u.bloodVolume,
      suppression: u.suppression,
      morale: u.morale,
      stance: u.stance,
      actionKind: u.action.kind,
      aiState: u.aiState,
      alerted: u.alerted,
      ammo: u.ammo,
      targetId: u.currentTarget,
      wounds: u.wounds.map((w) => ({
        zone: w.zone,
        severity: w.severity,
        treatment: w.treatment,
        bleedRate: w.bleedRatePerSec,
      })),
    });
  }

  const snapshotEvents: SnapshotEvent[] = [];
  for (const e of state.events) {
    if (e.kind === 'unit-spotted' || e.kind === 'unit-moved' || e.kind === 'unit-spawned') continue;
    if (e.kind === 'unit-fired') {
      snapshotEvents.push({
        kind: 'unit-fired',
        shooter: e.shooter,
        target: e.target,
        tick: e.tick,
      });
    } else if (e.kind === 'unit-hit') {
      snapshotEvents.push({
        kind: 'unit-hit',
        shooter: e.shooter,
        target: e.target,
        outcome: e.outcome,
        zone: e.zone,
        woundId: e.woundId,
        reason: e.reason,
        tick: e.tick,
      });
    } else if (e.kind === 'unit-downed') {
      snapshotEvents.push({ kind: 'unit-downed', unitId: e.unitId, cause: e.cause, tick: e.tick });
    } else if (e.kind === 'unit-died') {
      snapshotEvents.push({ kind: 'unit-died', unitId: e.unitId, tick: e.tick });
    } else if (e.kind === 'unit-stabilized') {
      snapshotEvents.push({
        kind: 'unit-stabilized',
        medicId: e.medicId,
        targetId: e.targetId,
        tick: e.tick,
      });
    } else if (e.kind === 'unit-pinned') {
      snapshotEvents.push({ kind: 'unit-pinned', unitId: e.unitId, tick: e.tick });
    } else if (e.kind === 'unit-broke') {
      snapshotEvents.push({ kind: 'unit-broke', unitId: e.unitId, tick: e.tick });
    } else if (e.kind === 'unit-rallied') {
      snapshotEvents.push({ kind: 'unit-rallied', unitId: e.unitId, tick: e.tick });
    }
  }

  return {
    tick: state.tick,
    ended: state.ended,
    endReason: state.endReason,
    units,
    events: snapshotEvents,
  };
}

export function snapshotWorld(world: World): WorldSnapshot {
  return {
    width: world.width,
    height: world.height,
    tileSizeMeters: world.tileSizeMeters,
    terrain: new Uint8Array(world.terrain),
  };
}
