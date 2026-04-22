import type {
  SimSnapshot,
  SnapshotEvent,
  SnapshotLastHeard,
  SnapshotObjective,
  SnapshotUnit,
  WorldSnapshot,
} from '@shared/snapshot';
import { HEARD_MAX_ENTRIES } from './noise';
import type { SimState } from './state';
import type { World } from './world';

export function snapshotState(state: SimState): SimSnapshot {
  const units: SnapshotUnit[] = [];
  for (const u of state.units.values()) {
    const lastHeard: SnapshotLastHeard[] = [];
    for (const [sourceId, h] of u.lastHeard) {
      lastHeard.push({
        sourceUnitId: sourceId,
        approxX: h.approxPos.x,
        approxY: h.approxPos.y,
        bearing: h.bearing,
        confidence: h.confidence,
        tick: h.tick,
        kind: h.kind,
      });
    }
    lastHeard.sort((a, b) => b.tick - a.tick);
    if (lastHeard.length > HEARD_MAX_ENTRIES) lastHeard.length = HEARD_MAX_ENTRIES;

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
      lastHeard,
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
        woundType: e.woundType,
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
    } else if (e.kind === 'noise-emitted') {
      snapshotEvents.push({
        kind: 'noise-emitted',
        sourceUnitId: e.sourceUnitId,
        x: e.pos.x,
        y: e.pos.y,
        noiseKind: e.noiseKind,
        tick: e.tick,
      });
    } else if (e.kind === 'objective-status-changed') {
      snapshotEvents.push({
        kind: 'objective-status-changed',
        objectiveId: e.objectiveId,
        from: e.from,
        to: e.to,
        tick: e.tick,
      });
    }
  }

  const objectives: SnapshotObjective[] = state.objectives.map((o) => {
    const holdTicks =
      o.params.kind === 'defend' || o.params.kind === 'secure' ? o.params.holdTicks : null;
    return {
      id: o.id,
      kind: o.kind,
      description: o.description,
      status: o.status,
      progressTicks: o.progressTicks,
      holdTicks,
      zone: o.params.zone,
    };
  });

  return {
    tick: state.tick,
    ended: state.ended,
    endReason: state.endReason,
    units,
    events: snapshotEvents,
    objectives,
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
