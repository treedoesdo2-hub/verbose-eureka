import type { UnitId } from '@shared/ids';
import type { ObjectiveRect, ObjectiveRuntimeState, ObjectiveStatus, SimEvent } from './state';
import type { Unit, Vec2 } from './unit';
import { canFight } from './unit';

function rectContainsUnit(zone: ObjectiveRect, unit: Unit, tileSizeMeters: number): boolean {
  const tx = Math.floor(unit.position.x / tileSizeMeters);
  const ty = Math.floor(unit.position.y / tileSizeMeters);
  return tx >= zone.x && tx < zone.x + zone.w && ty >= zone.y && ty < zone.y + zone.h;
}

function zoneCenterMeters(zone: ObjectiveRect, tileSizeMeters: number): Vec2 {
  return {
    x: (zone.x + zone.w / 2) * tileSizeMeters,
    y: (zone.y + zone.h / 2) * tileSizeMeters,
  };
}

function evalEliminate(
  obj: ObjectiveRuntimeState,
  units: ReadonlyMap<UnitId, Unit>,
): { status: ObjectiveStatus; progressTicks: number } {
  if (obj.params.kind !== 'eliminate')
    return { status: obj.status, progressTicks: obj.progressTicks };
  let anyAlive = false;
  for (const u of units.values()) {
    if (u.teamId === obj.params.targetTeamId && canFight(u)) {
      anyAlive = true;
      break;
    }
  }
  return { status: anyAlive ? 'active' : 'complete', progressTicks: obj.progressTicks };
}

function evalExtract(
  obj: ObjectiveRuntimeState,
  units: ReadonlyMap<UnitId, Unit>,
  tileSizeMeters: number,
): { status: ObjectiveStatus; progressTicks: number } {
  if (obj.params.kind !== 'extract')
    return { status: obj.status, progressTicks: obj.progressTicks };
  let inside = 0;
  for (const u of units.values()) {
    if (u.teamId !== 0 || !canFight(u)) continue;
    if (rectContainsUnit(obj.params.zone, u, tileSizeMeters)) inside++;
  }
  return {
    status: inside >= obj.params.minUnitsInside ? 'complete' : 'active',
    progressTicks: obj.progressTicks,
  };
}

function evalDefend(
  obj: ObjectiveRuntimeState,
  units: ReadonlyMap<UnitId, Unit>,
  tileSizeMeters: number,
): { status: ObjectiveStatus; progressTicks: number } {
  if (obj.params.kind !== 'defend') return { status: obj.status, progressTicks: obj.progressTicks };
  for (const u of units.values()) {
    if (u.teamId === 1 && canFight(u) && rectContainsUnit(obj.params.zone, u, tileSizeMeters)) {
      return { status: 'failed', progressTicks: obj.progressTicks };
    }
  }
  const next = obj.progressTicks + 1;
  if (next >= obj.params.holdTicks) return { status: 'complete', progressTicks: next };
  return { status: 'active', progressTicks: next };
}

function evalSecure(
  obj: ObjectiveRuntimeState,
  units: ReadonlyMap<UnitId, Unit>,
  tileSizeMeters: number,
): { status: ObjectiveStatus; progressTicks: number } {
  if (obj.params.kind !== 'secure') return { status: obj.status, progressTicks: obj.progressTicks };
  let team0Inside = false;
  let team1Inside = false;
  for (const u of units.values()) {
    if (!canFight(u)) continue;
    if (!rectContainsUnit(obj.params.zone, u, tileSizeMeters)) continue;
    if (u.teamId === 0) team0Inside = true;
    else if (u.teamId === 1) team1Inside = true;
  }
  if (team0Inside && !team1Inside) {
    const next = obj.progressTicks + 1;
    if (next >= obj.params.holdTicks) return { status: 'complete', progressTicks: next };
    return { status: 'active', progressTicks: next };
  }
  return { status: 'active', progressTicks: 0 };
}

export function evaluateObjectives(
  objectives: readonly ObjectiveRuntimeState[],
  units: ReadonlyMap<UnitId, Unit>,
  tileSizeMeters: number,
  tick: number,
): { objectives: ObjectiveRuntimeState[]; events: SimEvent[] } {
  const next: ObjectiveRuntimeState[] = [];
  const events: SimEvent[] = [];
  for (const obj of objectives) {
    if (obj.status !== 'active') {
      next.push(obj);
      continue;
    }
    let result: { status: ObjectiveStatus; progressTicks: number };
    switch (obj.params.kind) {
      case 'eliminate':
        result = evalEliminate(obj, units);
        break;
      case 'extract':
        result = evalExtract(obj, units, tileSizeMeters);
        break;
      case 'defend':
        result = evalDefend(obj, units, tileSizeMeters);
        break;
      case 'secure':
        result = evalSecure(obj, units, tileSizeMeters);
        break;
    }
    if (result.status !== obj.status) {
      events.push({
        kind: 'objective-status-changed',
        objectiveId: obj.id,
        from: obj.status,
        to: result.status,
        tick,
      });
    }
    next.push({
      ...obj,
      status: result.status,
      progressTicks: result.progressTicks,
    });
  }
  return { objectives: next, events };
}

export function focalPoint(obj: ObjectiveRuntimeState, tileSizeMeters: number): Vec2 | null {
  if (obj.params.kind === 'eliminate') return null;
  return zoneCenterMeters(obj.params.zone, tileSizeMeters);
}

/**
 * For player-side units (team 0) with no remaining waypoints, push a single
 * waypoint toward the primary objective's focal point so the AI doesn't
 * stand idle after combat finishes or waypoints are consumed.
 */
export function regeneratePlayerWaypoints(
  units: ReadonlyMap<UnitId, Unit>,
  objectives: readonly ObjectiveRuntimeState[],
  tileSizeMeters: number,
): Map<UnitId, Vec2[]> {
  const out = new Map<UnitId, Vec2[]>();
  const primary = objectives[0];
  if (!primary || primary.status !== 'active') return out;
  const focal = focalPoint(primary, tileSizeMeters);
  if (!focal) return out;
  for (const u of units.values()) {
    if (u.teamId !== 0 || !canFight(u)) continue;
    if (u.waypointIndex < u.waypoints.length) continue;
    out.set(u.id, [focal]);
  }
  return out;
}
