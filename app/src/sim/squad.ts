import type { UnitId } from '@shared/ids';
import type { Unit, Vec2 } from './unit';
import { canFight } from './unit';

// Squad-level behavior per ADR 003 (player commands at platoon/lance level)
// and ADR 011 Pillar B (cohere around the completed objective). Each squad
// has a leader; non-leader members follow the leader in formation while the
// squad's order is `advance`. When the leader goes down, the next
// combat-capable member promotes.
//
// Enemies don't carry squadId at MVP — they still get cross-team coherence
// via the objective-driven enemy waypoint regen in objectives.ts.

export type SquadFormation = 'wedge' | 'column' | 'line' | 'loose';

export type SquadOrder = 'advance' | 'hold' | 'fallback';

export type SquadRuntimeState = {
  readonly id: string;
  readonly teamId: number;
  readonly memberIds: readonly UnitId[];
  readonly leaderId: UnitId | null;
  readonly formation: SquadFormation;
  readonly order: SquadOrder;
};

export function makeSquadRuntime(
  id: string,
  teamId: number,
  memberIds: readonly UnitId[],
  leaderId: UnitId | null,
  formation: SquadFormation = 'wedge',
  order: SquadOrder = 'advance',
): SquadRuntimeState {
  return { id, teamId, memberIds, leaderId, formation, order };
}

// Pick the leader for a squad from its members + the unit map. Default
// policy: first member in the roster that can still fight. Deterministic
// given the input order.
export function pickLeader(
  memberIds: readonly UnitId[],
  units: ReadonlyMap<UnitId, Unit>,
): UnitId | null {
  for (const id of memberIds) {
    const u = units.get(id);
    if (!u) continue;
    if (canFight(u)) return id;
  }
  return null;
}

// Check each squad: if its leader can't fight, promote the next capable
// member. Returns a new map when any promotions happened; returns the
// input when nothing changed.
export function promoteLeaders(
  squads: ReadonlyMap<string, SquadRuntimeState>,
  units: ReadonlyMap<UnitId, Unit>,
): ReadonlyMap<string, SquadRuntimeState> {
  let changed = false;
  const next = new Map<string, SquadRuntimeState>();
  for (const [id, sq] of squads) {
    const leader = sq.leaderId !== null ? units.get(sq.leaderId) : null;
    const leaderOk = leader !== undefined && leader !== null && canFight(leader);
    if (leaderOk) {
      next.set(id, sq);
      continue;
    }
    const newLeader = pickLeader(sq.memberIds, units);
    if (newLeader === sq.leaderId) {
      next.set(id, sq);
      continue;
    }
    changed = true;
    next.set(id, { ...sq, leaderId: newLeader });
  }
  return changed ? next : squads;
}

// Formation offset for a non-leader member around the leader. Offsets are
// stable per-(leader, member) so members don't ping-pong between slots.
// All offsets are small (4–6m) — the squad stays tight enough to share
// fire sectors but not so tight that a single grenade kills everyone.
export function formationOffset(
  leader: Unit,
  member: Unit,
  slotIndex: number,
  formation: SquadFormation,
): Vec2 {
  // Leader's facing-relative axes. Forward = direction the leader is
  // heading; right = 90° clockwise from forward.
  const fx = Math.cos(leader.facing);
  const fy = Math.sin(leader.facing);
  const rx = -fy;
  const ry = fx;

  switch (formation) {
    case 'wedge': {
      // Wedge pattern: leader at apex, members fan out behind-left /
      // behind-right in alternating pattern. slot 0 = left rear, 1 =
      // right rear, 2 = farther left, 3 = farther right, …
      const side = slotIndex % 2 === 0 ? -1 : 1;
      const rank = Math.floor(slotIndex / 2) + 1;
      const lateral = 3 * rank * side;
      const backward = -2.5 * rank;
      return { x: rx * lateral + fx * backward, y: ry * lateral + fy * backward };
    }
    case 'column': {
      // Single-file behind the leader.
      const backward = -(2.5 * (slotIndex + 1));
      return { x: fx * backward, y: fy * backward };
    }
    case 'line': {
      // Horizontal line through the leader, members spread laterally.
      const side = slotIndex % 2 === 0 ? -1 : 1;
      const rank = Math.floor(slotIndex / 2) + 1;
      const lateral = 2.5 * rank * side;
      return { x: rx * lateral, y: ry * lateral };
    }
    case 'loose': {
      // Pseudo-random-ish but deterministic scatter; unitId seeds the angle.
      const seed = (member.id as unknown as number) * 2654435761;
      const angle = ((seed >>> 0) % 360) * (Math.PI / 180);
      const dist = 3 + (slotIndex % 3);
      return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
    }
  }
}

// The slot index is the member's rank within the squad's member list,
// excluding the leader. Stable given the input order.
export function memberSlotIndex(
  memberIds: readonly UnitId[],
  leaderId: UnitId | null,
  memberId: UnitId,
): number {
  let slot = 0;
  for (const id of memberIds) {
    if (id === leaderId) continue;
    if (id === memberId) return slot;
    slot++;
  }
  return 0;
}
