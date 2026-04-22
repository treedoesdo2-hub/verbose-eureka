import type { UnitId } from '@shared/ids';
import { mostRecentHeard } from '../hearing';
import { HEARD_INVESTIGATE_MIN_CONFIDENCE } from '../noise';
import { findPathMeters, hasLineOfWalk, simplifyPath } from '../pathfinding';
import { formationOffset, memberSlotIndex } from '../squad';
import type { SimState } from '../state';
import { SIM_HZ } from '../state';
import type { AiState, Stance, Unit, UnitAction, Vec2 } from '../unit';
import { canFight, isDowned, MORALE_PANIC_THRESHOLD, SUPPRESSION_HEAVY_THRESHOLD } from '../unit';
import type { PerceptionResult } from './perception';

const AIM_TICKS = Math.round(SIM_HZ * 0.6);
// How recently a last-seen entry must be to draw a unit to investigate it.
// Older entries linger for hash/rendering but don't drive BT behavior.
const INVESTIGATE_TTL_TICKS = SIM_HZ * 30;
// Alerted flag decays after no fresh contact for this many ticks (spec/07:
// ~1–2 min; veterans slower, but MVP is flat).
const ALERT_DECAY_TICKS = SIM_HZ * 120;

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function hasMedkit(u: Unit): boolean {
  return u.combat.hasMedkit;
}

function nearestDownedAlly(unit: Unit, state: SimState): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const u of state.units.values()) {
    if (u.teamId !== unit.teamId) continue;
    if (u.id === unit.id) continue;
    if (!isDowned(u)) continue;
    const d = distance(unit.position.x, unit.position.y, u.position.x, u.position.y);
    if (d < bestDist) {
      best = u;
      bestDist = d;
    }
  }
  return best;
}

function nextWaypoint(unit: Unit): { x: number; y: number } | null {
  if (unit.waypointIndex >= unit.waypoints.length) return null;
  return unit.waypoints[unit.waypointIndex];
}

function mostRecentInvestigateTarget(unit: Unit, currentTick: number): Vec2 | null {
  let bestPos: Vec2 | null = null;
  let bestTick = -1;
  for (const [, seen] of unit.lastSeen) {
    if (currentTick - seen.tick > INVESTIGATE_TTL_TICKS) continue;
    if (seen.tick > bestTick) {
      bestTick = seen.tick;
      bestPos = seen.pos;
    }
  }
  return bestPos;
}

export type Decision = {
  readonly aiState: AiState;
  readonly action: UnitAction;
  readonly currentTarget: UnitId | null;
  readonly alerted: boolean;
  readonly advanceWaypoint: boolean;
  readonly extraFacing?: number;
};

/**
 * Stance policy: panic → prone; moving → standing (can't sprint while
 * prone); pinned & holding → crouched; otherwise keep the current stance
 * so deliberate choices stick instead of flipping every tick.
 */
export function pickStance(unit: Unit, action: UnitAction, aiState: AiState): Stance {
  if (aiState === 'panic') return 'prone';
  if (action.kind === 'moving') return 'standing';
  if (unit.suppression >= SUPPRESSION_HEAVY_THRESHOLD) return 'crouched';
  return unit.stance;
}

export function decide(unit: Unit, perception: PerceptionResult, state: SimState): Decision {
  if (!canFight(unit)) {
    return {
      aiState: unit.aiState,
      action: isDowned(unit) ? { kind: 'downed' } : unit.action,
      currentTarget: null,
      alerted: unit.alerted,
      advanceWaypoint: false,
    };
  }

  // Morale collapse: panicked units stop fighting and go to ground until
  // morale recovers (see processStress rally threshold in tick.ts).
  if (unit.morale <= MORALE_PANIC_THRESHOLD) {
    return {
      aiState: 'panic',
      action: { kind: 'idle' },
      currentTarget: null,
      alerted: unit.alerted,
      advanceWaypoint: false,
    };
  }

  if (hasMedkit(unit) && unit.stats.medical > 40) {
    const downed = nearestDownedAlly(unit, state);
    if (downed) {
      const d = distance(unit.position.x, unit.position.y, downed.position.x, downed.position.y);
      if (d < 1.5) {
        return {
          aiState: 'recover',
          action: {
            kind: 'stabilizing',
            targetId: downed.id,
            ticksRemaining: Math.round(SIM_HZ * 3),
          },
          currentTarget: null,
          alerted: unit.alerted,
          advanceWaypoint: false,
        };
      }
      return {
        aiState: 'recover',
        action: { kind: 'moving', target: downed.position },
        currentTarget: null,
        alerted: unit.alerted,
        advanceWaypoint: false,
      };
    }
  }

  const threatened = perception.bestTarget !== null;
  const sinceLastAlert =
    unit.lastAlertedTick >= 0 ? state.tick - unit.lastAlertedTick : Number.POSITIVE_INFINITY;
  const alerted = threatened
    ? true
    : unit.alerted && sinceLastAlert <= ALERT_DECAY_TICKS
      ? unit.alerted
      : false;

  if (threatened && perception.bestTarget !== null) {
    const target = state.units.get(perception.bestTarget);
    if (target) {
      const alreadyAiming =
        unit.action.kind === 'aiming' && unit.action.targetId === perception.bestTarget;
      const alreadyFiring =
        unit.action.kind === 'firing' && unit.action.targetId === perception.bestTarget;

      if (unit.ammo <= 0) {
        const reloadTicks = Math.round((unit.combat.primaryWeapon?.reloadSeconds ?? 2) * SIM_HZ);
        return {
          aiState: 'hold',
          action: { kind: 'reloading', ticksRemaining: reloadTicks },
          currentTarget: perception.bestTarget,
          alerted,
          advanceWaypoint: false,
        };
      }

      if (alreadyAiming && unit.action.ticksRemaining > 0) {
        return {
          aiState: 'hold',
          action: { ...unit.action, ticksRemaining: unit.action.ticksRemaining - 1 },
          currentTarget: perception.bestTarget,
          alerted,
          advanceWaypoint: false,
        };
      }
      if (alreadyAiming && unit.action.ticksRemaining <= 0) {
        const rpm = unit.combat.primaryWeapon?.rpm ?? 300;
        const tickPer = Math.max(1, Math.round((60 / rpm) * SIM_HZ));
        return {
          aiState: 'hold',
          action: {
            kind: 'firing',
            targetId: perception.bestTarget,
            roundsRemaining: 3,
            tickPer,
            cooldown: 0,
          },
          currentTarget: perception.bestTarget,
          alerted,
          advanceWaypoint: false,
        };
      }
      if (alreadyFiring) {
        return {
          aiState: 'hold',
          action: unit.action,
          currentTarget: perception.bestTarget,
          alerted,
          advanceWaypoint: false,
        };
      }

      return {
        aiState: 'hold',
        action: { kind: 'aiming', targetId: perception.bestTarget, ticksRemaining: AIM_TICKS },
        currentTarget: perception.bestTarget,
        alerted,
        advanceWaypoint: false,
      };
    }
  }

  if (unit.action.kind === 'reloading' && unit.action.ticksRemaining > 0) {
    return {
      aiState: unit.aiState,
      action: { kind: 'reloading', ticksRemaining: unit.action.ticksRemaining - 1 },
      currentTarget: unit.currentTarget,
      alerted,
      advanceWaypoint: false,
    };
  }

  // No visible threat — investigate heard noise (shooter firing from
  // concealment, etc). Skip allied noise entirely: teammates walking
  // past shouldn't override our squad orders; only hostile noise is
  // worth reacting to. And only heard *above* the investigate threshold
  // drives the branch — low-confidence heard falls through to waypoint
  // movement so the unit keeps advancing toward its objective.
  const heard = mostRecentHeard(unit, state.tick);
  if (heard) {
    const source = state.units.get(heard.sourceId);
    const isAllied = source !== undefined && source.teamId === unit.teamId;
    if (!isAllied && heard.heard.confidence >= HEARD_INVESTIGATE_MIN_CONFIDENCE) {
      const { approxPos } = heard.heard;
      const bearing =
        heard.heard.bearing ??
        Math.atan2(approxPos.y - unit.position.y, approxPos.x - unit.position.x);
      const d = distance(unit.position.x, unit.position.y, approxPos.x, approxPos.y);
      if (d > 1.5) {
        return {
          aiState: 'advance',
          action: { kind: 'moving', target: approxPos },
          currentTarget: null,
          alerted: true,
          advanceWaypoint: false,
          extraFacing: bearing,
        };
      }
      return {
        aiState: 'hold',
        action: { kind: 'idle' },
        currentTarget: null,
        alerted: true,
        advanceWaypoint: false,
        extraFacing: bearing,
      };
    }
  }

  // No active contact — investigate last-seen if recent, else advance waypoint.
  const investigateTo = mostRecentInvestigateTarget(unit, state.tick);
  if (investigateTo) {
    const d = distance(unit.position.x, unit.position.y, investigateTo.x, investigateTo.y);
    if (d > 1.5) {
      return {
        aiState: 'advance',
        action: { kind: 'moving', target: investigateTo },
        currentTarget: null,
        alerted,
        advanceWaypoint: false,
      };
    }
  }

  // ADR 003 / ADR 011 Pillar B squad coherence: non-leader members of an
  // advancing squad shadow the leader in formation rather than chasing
  // their own objective path. The leader runs the normal waypoint loop
  // below — this branch only activates for members when a live leader
  // exists and the squad is still advancing.
  if (unit.squadId !== null) {
    const squad = state.squads.get(unit.squadId);
    if (
      squad &&
      squad.leaderId !== null &&
      squad.leaderId !== unit.id &&
      squad.order === 'advance'
    ) {
      const leader = state.units.get(squad.leaderId);
      if (leader && canFight(leader)) {
        const slot = memberSlotIndex(squad.memberIds, squad.leaderId, unit.id);
        const off = formationOffset(leader, unit, slot, squad.formation);
        const anchor: Vec2 = {
          x: leader.position.x + off.x,
          y: leader.position.y + off.y,
        };
        const d = distance(unit.position.x, unit.position.y, anchor.x, anchor.y);
        // Tight threshold: members don't stop until they're really in
        // formation. Otherwise they drift behind the leader as the
        // leader moves.
        if (d < 0.8) {
          return {
            aiState: 'hold',
            action: { kind: 'idle' },
            currentTarget: null,
            alerted,
            advanceWaypoint: false,
          };
        }
        // If there's a clear walkable line from follower → anchor, steer
        // straight (cheap path). Otherwise pathfind around whatever's
        // blocking — buildings, rubble, impassable terrain — and steer
        // toward the first simplified waypoint. Previously followers just
        // bounced off walls trying to hold formation on the far side.
        let followTarget = anchor;
        if (!hasLineOfWalk(state.world, unit.position, anchor)) {
          const path = simplifyPath([...findPathMeters(state.world, unit.position, anchor)]);
          if (path.length > 0) followTarget = path[0];
        }
        return {
          aiState: 'advance',
          action: { kind: 'moving', target: followTarget },
          currentTarget: null,
          alerted,
          advanceWaypoint: false,
        };
      }
    }
  }

  const wp = nextWaypoint(unit);
  if (wp) {
    const d = distance(unit.position.x, unit.position.y, wp.x, wp.y);
    if (d < 1) {
      return {
        aiState: 'advance',
        action: { kind: 'idle' },
        currentTarget: null,
        alerted,
        advanceWaypoint: true,
      };
    }
    return {
      aiState: 'advance',
      action: { kind: 'moving', target: wp },
      currentTarget: null,
      alerted,
      advanceWaypoint: false,
    };
  }

  // Terminal fallback: no target, no waypoint, no heard noise, no last-seen.
  // Before this existed, units spawned on a procedural map with empty
  // waypoint lists and never moved. Advance toward the opposing team's
  // home centroid so the simulation always has momentum. Stops ~8m short
  // to avoid colliding stacks at the opposing spawn.
  const enemyHome = unit.teamId === 0 ? state.team1HomePos : state.team0HomePos;
  const dHome = distance(unit.position.x, unit.position.y, enemyHome.x, enemyHome.y);
  if (dHome > 8) {
    return {
      aiState: 'advance',
      action: { kind: 'moving', target: enemyHome },
      currentTarget: null,
      alerted,
      advanceWaypoint: false,
    };
  }

  return {
    aiState: 'hold',
    action: { kind: 'idle' },
    currentTarget: null,
    alerted,
    advanceWaypoint: false,
  };
}
