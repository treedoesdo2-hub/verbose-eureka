import type { SimSnapshot, SnapshotUnit, WorldSnapshot } from '@shared/snapshot';
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

  const snapshotEvents = state.events
    .filter(
      (e) => e.kind !== 'unit-spotted' && e.kind !== 'unit-moved' && e.kind !== 'unit-spawned',
    )
    .map((e) => {
      if (e.kind === 'unit-fired')
        return { kind: 'unit-fired', shooter: e.shooter, target: e.target, tick: e.tick } as const;
      if (e.kind === 'unit-hit')
        return { kind: 'unit-hit', shooter: e.shooter, target: e.target, tick: e.tick } as const;
      if (e.kind === 'unit-downed')
        return { kind: 'unit-downed', unitId: e.unitId, tick: e.tick } as const;
      if (e.kind === 'unit-died')
        return { kind: 'unit-died', unitId: e.unitId, tick: e.tick } as const;
      if (e.kind === 'unit-stabilized')
        return {
          kind: 'unit-stabilized',
          medicId: e.medicId,
          targetId: e.targetId,
          tick: e.tick,
        } as const;
      throw new Error(`unexpected event: ${JSON.stringify(e)}`);
    });

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
