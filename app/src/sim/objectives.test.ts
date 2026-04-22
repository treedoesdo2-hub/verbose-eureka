import { asUnitId, type UnitId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import {
  evaluateObjectives,
  focalPoint,
  regenerateEnemyWaypoints,
  regeneratePlayerWaypoints,
} from './objectives';
import type { ObjectiveRuntimeState } from './state';
import { makeUnit, type Unit } from './unit';

function mkUnit(args: {
  id: number;
  teamId: number;
  x?: number;
  y?: number;
  extra?: Partial<Unit>;
}): Unit {
  const base = makeUnit({
    id: asUnitId(args.id),
    teamId: args.teamId,
    operatorId: null,
    position: { x: args.x ?? 0, y: args.y ?? 0 },
    facing: 0,
  });
  return { ...base, ...(args.extra ?? {}) };
}

function mkUnitMap(units: Unit[]): ReadonlyMap<UnitId, Unit> {
  const m = new Map<UnitId, Unit>();
  for (const u of units) m.set(u.id, u);
  return m;
}

describe('evaluateObjectives — extract', () => {
  const obj: ObjectiveRuntimeState = {
    id: 'x',
    kind: 'extract',
    description: 'exfil',
    params: { kind: 'extract', zone: { x: 10, y: 10, w: 4, h: 4 }, minUnitsInside: 2 },
    status: 'active',
    progressTicks: 0,
  };

  it('is active when only one unit is inside', () => {
    const units = mkUnitMap([
      mkUnit({ id: 1, teamId: 0, x: 11, y: 11 }),
      mkUnit({ id: 2, teamId: 0, x: 100, y: 100 }),
    ]);
    const { objectives } = evaluateObjectives([obj], units, 1, 0);
    expect(objectives[0].status).toBe('active');
  });

  it('completes when minUnitsInside is met', () => {
    const units = mkUnitMap([
      mkUnit({ id: 1, teamId: 0, x: 11, y: 11 }),
      mkUnit({ id: 2, teamId: 0, x: 12, y: 12 }),
    ]);
    const { objectives } = evaluateObjectives([obj], units, 1, 0);
    expect(objectives[0].status).toBe('complete');
  });
});

describe('evaluateObjectives — defend', () => {
  const obj: ObjectiveRuntimeState = {
    id: 'd',
    kind: 'defend',
    description: 'hold',
    params: { kind: 'defend', zone: { x: 20, y: 20, w: 3, h: 3 }, holdTicks: 5 },
    status: 'active',
    progressTicks: 0,
  };

  it('fails when an enemy enters the zone', () => {
    const units = mkUnitMap([mkUnit({ id: 1, teamId: 1, x: 21, y: 21 })]);
    const { objectives } = evaluateObjectives([obj], units, 1, 0);
    expect(objectives[0].status).toBe('failed');
  });

  it('accumulates progress and completes after holdTicks', () => {
    const units = mkUnitMap([mkUnit({ id: 1, teamId: 0, x: 21, y: 21 })]);
    let cur: ObjectiveRuntimeState = obj;
    for (let i = 0; i < 5; i++) {
      const { objectives } = evaluateObjectives([cur], units, 1, i);
      cur = objectives[0];
    }
    expect(cur.status).toBe('complete');
    expect(cur.progressTicks).toBeGreaterThanOrEqual(5);
  });
});

describe('evaluateObjectives — secure', () => {
  const obj: ObjectiveRuntimeState = {
    id: 's',
    kind: 'secure',
    description: 'hold',
    params: { kind: 'secure', zone: { x: 30, y: 30, w: 3, h: 3 }, holdTicks: 3 },
    status: 'active',
    progressTicks: 0,
  };

  it('progresses only when team-0 holds alone', () => {
    const units = mkUnitMap([mkUnit({ id: 1, teamId: 0, x: 31, y: 31 })]);
    let cur: ObjectiveRuntimeState = obj;
    for (let i = 0; i < 3; i++) {
      const { objectives } = evaluateObjectives([cur], units, 1, i);
      cur = objectives[0];
    }
    expect(cur.status).toBe('complete');
  });

  it('resets progress when team-1 contests', () => {
    const units = mkUnitMap([
      mkUnit({ id: 1, teamId: 0, x: 31, y: 31 }),
      mkUnit({ id: 2, teamId: 1, x: 31, y: 32 }),
    ]);
    const { objectives } = evaluateObjectives([{ ...obj, progressTicks: 2 }], units, 1, 0);
    expect(objectives[0].progressTicks).toBe(0);
    expect(objectives[0].status).toBe('active');
  });
});

describe('regeneratePlayerWaypoints', () => {
  it('pushes a focal waypoint for team-0 units with empty waypoints', () => {
    const extractObj: ObjectiveRuntimeState = {
      id: 'x',
      kind: 'extract',
      description: 'exfil',
      params: { kind: 'extract', zone: { x: 10, y: 10, w: 4, h: 4 }, minUnitsInside: 1 },
      status: 'active',
      progressTicks: 0,
    };
    const units = mkUnitMap([mkUnit({ id: 1, teamId: 0, x: 0, y: 0 })]);
    const out = regeneratePlayerWaypoints(units, [extractObj], 1);
    expect(out.size).toBe(1);
    const wps = out.get(asUnitId(1));
    expect(wps?.length).toBe(1);
    // Center of zone 10,10 to 14,14 (tile size 1m) → (12, 12).
    expect(wps?.[0].x).toBeCloseTo(12);
    expect(wps?.[0].y).toBeCloseTo(12);
  });

  it('skips units whose waypoints still have remaining points', () => {
    const extractObj: ObjectiveRuntimeState = {
      id: 'x',
      kind: 'extract',
      description: 'exfil',
      params: { kind: 'extract', zone: { x: 10, y: 10, w: 4, h: 4 }, minUnitsInside: 1 },
      status: 'active',
      progressTicks: 0,
    };
    const withWps = mkUnit({
      id: 1,
      teamId: 0,
      extra: { waypoints: [{ x: 5, y: 5 }], waypointIndex: 0 },
    });
    const units = mkUnitMap([withWps]);
    const out = regeneratePlayerWaypoints(units, [extractObj], 1);
    expect(out.size).toBe(0);
  });
});

describe('focalPoint', () => {
  it('returns the zone center for any zoned objective', () => {
    const obj: ObjectiveRuntimeState = {
      id: 'e',
      kind: 'extract',
      description: 'e',
      params: { kind: 'extract', zone: { x: 10, y: 20, w: 4, h: 4 }, minUnitsInside: 1 },
      status: 'active',
      progressTicks: 0,
    };
    const p = focalPoint(obj, 1);
    expect(p.x).toBeCloseTo(12);
    expect(p.y).toBeCloseTo(22);
  });
});

describe('regenerateEnemyWaypoints', () => {
  it('pushes the objective zone as an attacker waypoint for team 1', () => {
    const obj: ObjectiveRuntimeState = {
      id: 'x',
      kind: 'secure',
      description: 'hold',
      params: { kind: 'secure', zone: { x: 10, y: 10, w: 4, h: 4 }, holdTicks: 300 },
      status: 'active',
      progressTicks: 0,
    };
    const units = mkUnitMap([mkUnit({ id: 2, teamId: 1, x: 100, y: 100 })]);
    const out = regenerateEnemyWaypoints(units, [obj], 1, { x: 0, y: 0 });
    expect(out.size).toBe(1);
    const wps = out.get(asUnitId(2));
    expect(wps?.[0].x).toBeCloseTo(12);
    expect(wps?.[0].y).toBeCloseTo(12);
  });

  it('skips team-0 units', () => {
    const obj: ObjectiveRuntimeState = {
      id: 'x',
      kind: 'secure',
      description: 'hold',
      params: { kind: 'secure', zone: { x: 10, y: 10, w: 4, h: 4 }, holdTicks: 300 },
      status: 'active',
      progressTicks: 0,
    };
    const units = mkUnitMap([mkUnit({ id: 1, teamId: 0, x: 0, y: 0 })]);
    const out = regenerateEnemyWaypoints(units, [obj], 1, { x: 0, y: 0 });
    expect(out.size).toBe(0);
  });
});
