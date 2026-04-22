import type { SimState } from './state';
import type { Unit } from './unit';

// Per-tick per-unit decision trace. This exists so I (the agent) can inspect
// why units did or didn't do things — the user won't read this; it's a
// diagnostic dump consumed by tests and debug flows.

export type UnitTraceRow = {
  tick: number;
  unitId: number;
  teamId: number;
  aiState: string;
  actionKind: string;
  posX: number;
  posY: number;
  waypointIdx: number;
  waypointCount: number;
  targetId: number | null;
  hp: number;
  morale: number;
  suppression: number;
};

export type SimTrace = {
  readonly rows: UnitTraceRow[];
  readonly startTick: number;
  readonly endTick: number;
};

export function snapshotUnitRow(u: Unit, tick: number): UnitTraceRow {
  return {
    tick,
    unitId: u.id as unknown as number,
    teamId: u.teamId,
    aiState: u.aiState,
    actionKind: u.action.kind,
    posX: u.position.x,
    posY: u.position.y,
    waypointIdx: u.waypointIndex,
    waypointCount: u.waypoints.length,
    targetId: (u.currentTarget as unknown as number | null) ?? null,
    hp: u.bloodVolume,
    morale: u.morale,
    suppression: u.suppression,
  };
}

export function captureTrace(state: SimState): UnitTraceRow[] {
  const out: UnitTraceRow[] = [];
  for (const u of state.units.values()) out.push(snapshotUnitRow(u, state.tick));
  return out;
}

// Summarize a trace into a compact activity report per unit. Useful for
// debugging "did units actually move?" questions in a test.
export type UnitActivity = {
  unitId: number;
  teamId: number;
  ticksMoving: number;
  ticksFiring: number;
  ticksIdle: number;
  distanceTraveled: number;
  finalPos: { x: number; y: number };
  aiStatesSeen: string[];
};

export function summarizeActivity(trace: readonly UnitTraceRow[]): UnitActivity[] {
  const byId = new Map<number, UnitTraceRow[]>();
  for (const row of trace) {
    let arr = byId.get(row.unitId);
    if (!arr) {
      arr = [];
      byId.set(row.unitId, arr);
    }
    arr.push(row);
  }
  const out: UnitActivity[] = [];
  for (const [id, rows] of byId) {
    rows.sort((a, b) => a.tick - b.tick);
    let ticksMoving = 0;
    let ticksFiring = 0;
    let ticksIdle = 0;
    let distance = 0;
    const statesSeen = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      statesSeen.add(r.aiState);
      if (r.actionKind === 'moving') ticksMoving++;
      else if (r.actionKind === 'firing') ticksFiring++;
      else if (r.actionKind === 'idle') ticksIdle++;
      if (i > 0) {
        const prev = rows[i - 1];
        distance += Math.hypot(r.posX - prev.posX, r.posY - prev.posY);
      }
    }
    const last = rows[rows.length - 1];
    out.push({
      unitId: id,
      teamId: rows[0].teamId,
      ticksMoving,
      ticksFiring,
      ticksIdle,
      distanceTraveled: distance,
      finalPos: { x: last.posX, y: last.posY },
      aiStatesSeen: [...statesSeen].sort(),
    });
  }
  return out;
}

// Pretty-print activity summary as a table. Lines under ~120 cols so the
// dump reads well when an agent greps it out of test output.
export function formatActivityTable(summary: readonly UnitActivity[]): string {
  const lines: string[] = [];
  lines.push('unit  team  moving  firing  idle  dist(m)  final(x,y)         states');
  for (const s of summary) {
    const pad = (n: number | string, w: number): string => String(n).padEnd(w, ' ');
    lines.push(
      `${pad(s.unitId, 5)} ${pad(s.teamId, 5)} ${pad(s.ticksMoving, 7)} ${pad(s.ticksFiring, 7)} ${pad(s.ticksIdle, 5)} ${pad(s.distanceTraveled.toFixed(1), 8)} (${s.finalPos.x.toFixed(0)}, ${s.finalPos.y.toFixed(0)})  ${s.aiStatesSeen.join(',')}`,
    );
  }
  return lines.join('\n');
}
