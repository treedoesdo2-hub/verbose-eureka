import type { Operator } from '@schema/operator';
import type { SnapshotAiState, SnapshotStance, SnapshotUnit } from '@shared/snapshot';

export type UnitCardData = {
  readonly unitId: number;
  readonly callsign: string;
  readonly name: string | null;
  readonly teamId: number;
  readonly stance: SnapshotStance;
  readonly actionKind: string;
  readonly aiState: SnapshotAiState;
  readonly alerted: boolean;
  readonly bloodPct: number;
  readonly moralePct: number;
  readonly suppressionPct: number;
  readonly ammo: number;
  readonly woundCount: number;
  readonly worstWoundSeverity: string | null;
  readonly target: { id: number; callsign: string } | null;
  readonly dead: boolean;
  readonly downed: boolean;
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 3,
  serious: 2,
  light: 1,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function worstSeverity(wounds: SnapshotUnit['wounds']): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const w of wounds) {
    const s = SEVERITY_ORDER[w.severity] ?? 0;
    if (s > bestScore) {
      bestScore = s;
      best = w.severity;
    }
  }
  return best;
}

function resolveCallsign(
  u: SnapshotUnit | undefined,
  ops: ReadonlyMap<string, Operator>,
): { callsign: string; name: string | null } {
  if (!u) return { callsign: '—', name: null };
  if (u.operatorId) {
    const op = ops.get(u.operatorId);
    if (op) return { callsign: op.callsign, name: op.name };
    return { callsign: u.operatorId, name: null };
  }
  return { callsign: `unit-${u.id}`, name: null };
}

export function deriveUnitCard(
  u: SnapshotUnit,
  unitsById: ReadonlyMap<number, SnapshotUnit>,
  ops: ReadonlyMap<string, Operator>,
): UnitCardData {
  const { callsign, name } = resolveCallsign(u, ops);
  let target: UnitCardData['target'] = null;
  if (u.targetId != null) {
    const t = unitsById.get(u.targetId);
    if (t) {
      const resolved = resolveCallsign(t, ops);
      target = { id: u.targetId, callsign: resolved.callsign };
    }
  }
  return {
    unitId: u.id,
    callsign,
    name,
    teamId: u.teamId,
    stance: u.stance,
    actionKind: u.actionKind,
    aiState: u.aiState,
    alerted: u.alerted,
    bloodPct: clamp01(u.blood / 100),
    moralePct: clamp01(u.morale),
    suppressionPct: clamp01(u.suppression),
    ammo: u.ammo,
    woundCount: u.wounds.length,
    worstWoundSeverity: worstSeverity(u.wounds),
    target,
    dead: u.actionKind === 'dead',
    downed: u.actionKind === 'downed',
  };
}
