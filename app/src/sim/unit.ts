import type { BodyZone } from '@schema/common';
import { ALL_BODY_ZONES } from '@schema/common';
import type { OperatorId, UnitId, WoundId } from '@shared/ids';
import type { CombatProfile } from './loadout';
import { emptyCombatProfile } from './loadout';
import type { Heard } from './noise';

export const MAX_BLOOD_VOLUME = 100;
// Spec/07: five blood tiers with mechanical effects. Downed transition
// happens at the BLEEDOUT floor; above it, progressive penalties apply.
export const BLOOD_TIER_THRESHOLDS = {
  healthy: 70,
  wounded: 40,
  heavy: 20,
  critical: 10,
} as const;
export const BLOODOUT_THRESHOLD = BLOOD_TIER_THRESHOLDS.critical;

// Menace DNA: suppression accumulates from incoming fire and decays when
// the unit isn't under threat. Morale collapses when allies fall or when
// the unit is pinned for too long. Panic triggers at the morale floor.
export const MAX_SUPPRESSION = 100;
export const MAX_MORALE = 100;
export const SUPPRESSION_PER_SHOT = 15;
export const SUPPRESSION_DECAY_PER_SEC = 8;
export const SUPPRESSION_HEAVY_THRESHOLD = 60;
export const MORALE_ALLY_DOWN_RADIUS_M = 8;
export const MORALE_ALLY_DOWN_LOSS = 25;
export const MORALE_ALLY_DIED_LOSS = 35;
export const MORALE_HEAVY_SUP_LOSS_PER_SEC = 0.5;
export const MORALE_RECOVERY_PER_SEC = 2;
export const MORALE_PANIC_THRESHOLD = 30;
export const MORALE_RECOVER_THRESHOLD = 55;

export type BloodTier = 'healthy' | 'wounded' | 'heavy' | 'critical' | 'bleedout';

export type WoundType = 'gunshot' | 'fragmentation' | 'blunt' | 'burn' | 'cut';
export type WoundSeverity = 'graze' | 'light' | 'serious' | 'critical';
export type TreatmentState = 'untreated' | 'bandaged' | 'tourniquet' | 'stabilized';

export type Wound = {
  readonly id: WoundId;
  readonly zone: BodyZone;
  readonly type: WoundType;
  readonly severity: WoundSeverity;
  // Continuous 0–100 severity. Wounds in the same zone aggregate toward 100
  // (spec/07: two zone-30 wounds ≈ one zone-60 wound for downstream effects).
  readonly severityPct: number;
  readonly bleedRatePerSec: number;
  readonly treatment: TreatmentState;
  readonly tickInflicted: number;
};

export type Vec2 = { readonly x: number; readonly y: number };

export type LastSeen = {
  readonly pos: Vec2;
  readonly tick: number;
};

export type UnitAction =
  | { kind: 'idle' }
  | { kind: 'moving'; target: Vec2 }
  | { kind: 'aiming'; targetId: UnitId; ticksRemaining: number }
  | { kind: 'firing'; targetId: UnitId; roundsRemaining: number; tickPer: number; cooldown: number }
  | { kind: 'reloading'; ticksRemaining: number }
  | { kind: 'stabilizing'; targetId: UnitId; ticksRemaining: number }
  | { kind: 'dragging'; targetId: UnitId; to: Vec2 }
  | { kind: 'downed' }
  | { kind: 'dead' };

export type AiState = 'advance' | 'hold' | 'retreat' | 'flank' | 'recover' | 'panic';

// Role drives BT branching per ADR 011 Pillar B. LMG engages further and
// fires longer suppressive bursts; medic already has its own heal branch
// via hasMedkit + stabilizing; rifleman is the baseline; lead is currently
// behaviorally identical to rifleman — squad-leader duty is handled via
// SquadRuntimeState, not the unit's role field.
export type UnitRole = 'rifleman' | 'lmg' | 'medic' | 'lead';

export type Stance = 'standing' | 'crouched' | 'prone';

// Stance modifiers — stance changes how easy it is to hit the unit (zone
// weighting shifts away from torso/head and toward legs the lower you get),
// how fast it can move, and how steady its aim is.
export const STANCE_AIM_BONUS: Record<Stance, number> = {
  standing: 1.0,
  crouched: 1.1,
  prone: 1.2,
};
export const STANCE_MOVE_MULTIPLIER: Record<Stance, number> = {
  standing: 1.0,
  crouched: 0.6,
  prone: 0.25,
};

export type UnitStats = {
  readonly aim: number;
  readonly move: number;
  readonly grit: number;
  readonly awareness: number;
  readonly medical: number;
};

export const DEFAULT_STATS: UnitStats = {
  aim: 50,
  move: 50,
  grit: 50,
  awareness: 50,
  medical: 30,
};

export type Unit = {
  readonly id: UnitId;
  readonly teamId: number;
  readonly operatorId: OperatorId | null;
  // ADR 003 hierarchy: player commands at squad level. Null for enemies
  // and for hand-authored fixtures that spawn units directly.
  readonly squadId: string | null;
  readonly stats: UnitStats;
  readonly combat: CombatProfile;
  readonly position: Vec2;
  readonly facing: number;
  readonly velocity: Vec2;
  readonly bloodVolume: number;
  readonly suppression: number;
  readonly morale: number;
  readonly wounds: readonly Wound[];
  readonly ammo: number;
  readonly action: UnitAction;
  readonly aiState: AiState;
  readonly stance: Stance;
  readonly alerted: boolean;
  readonly lastAlertedTick: number;
  readonly lastSeen: ReadonlyMap<UnitId, LastSeen>;
  readonly lastHeard: ReadonlyMap<UnitId, Heard>;
  readonly currentTarget: UnitId | null;
  readonly waypointIndex: number;
  readonly waypoints: readonly Vec2[];
  readonly role: UnitRole;
};

export function makeUnit(params: {
  id: UnitId;
  teamId: number;
  operatorId: OperatorId | null;
  position: Vec2;
  facing: number;
  combat?: CombatProfile;
  stats?: UnitStats;
  waypoints?: readonly Vec2[];
  squadId?: string | null;
  role?: UnitRole;
}): Unit {
  const combat = params.combat ?? emptyCombatProfile();
  return {
    id: params.id,
    teamId: params.teamId,
    operatorId: params.operatorId,
    squadId: params.squadId ?? null,
    stats: params.stats ?? DEFAULT_STATS,
    combat,
    position: params.position,
    facing: params.facing,
    velocity: { x: 0, y: 0 },
    bloodVolume: MAX_BLOOD_VOLUME,
    suppression: 0,
    morale: MAX_MORALE,
    wounds: [],
    ammo: combat.primaryWeapon?.magazineSize ?? 0,
    action: { kind: 'idle' },
    aiState: 'hold',
    stance: 'standing',
    alerted: false,
    lastAlertedTick: -1,
    lastSeen: new Map(),
    lastHeard: new Map(),
    currentTarget: null,
    waypointIndex: 0,
    waypoints: params.waypoints ?? [],
    role: params.role ?? 'rifleman',
  };
}

export function isAlive(u: Unit): boolean {
  return u.action.kind !== 'dead';
}

export function isDowned(u: Unit): boolean {
  return (
    u.action.kind === 'downed' || (u.bloodVolume <= BLOODOUT_THRESHOLD && u.action.kind !== 'dead')
  );
}

export function canFight(u: Unit): boolean {
  return isAlive(u) && !isDowned(u);
}

export function bloodTier(u: Unit): BloodTier {
  const b = u.bloodVolume;
  if (b >= BLOOD_TIER_THRESHOLDS.healthy) return 'healthy';
  if (b >= BLOOD_TIER_THRESHOLDS.wounded) return 'wounded';
  if (b >= BLOOD_TIER_THRESHOLDS.heavy) return 'heavy';
  if (b >= BLOOD_TIER_THRESHOLDS.critical) return 'critical';
  return 'bleedout';
}

/**
 * Progressive accuracy + movement penalties from blood loss. Multiplies with
 * the loadout weight mobility penalty, so a heavy-armored wounded unit moves
 * slower than a heavy-armored healthy one AND slower than a light-armored
 * wounded one.
 */
export function bloodTierModifiers(tier: BloodTier): {
  aimMultiplier: number;
  moveMultiplier: number;
} {
  switch (tier) {
    case 'healthy':
      return { aimMultiplier: 1.0, moveMultiplier: 1.0 };
    case 'wounded':
      return { aimMultiplier: 0.9, moveMultiplier: 0.85 };
    case 'heavy':
      return { aimMultiplier: 0.7, moveMultiplier: 0.6 };
    case 'critical':
      return { aimMultiplier: 0.5, moveMultiplier: 0.4 };
    case 'bleedout':
      return { aimMultiplier: 0.0, moveMultiplier: 0.0 };
  }
}

/**
 * Aggregate severityPct for a given zone. Caps at 100 — two zone-60 wounds
 * in the same zone is "this zone is fully compromised," not 120%.
 */
export function zoneSeverityPct(u: Unit, zone: BodyZone): number {
  let sum = 0;
  for (const w of u.wounds) {
    if (w.zone !== zone) continue;
    sum += w.severityPct;
    if (sum >= 100) return 100;
  }
  return sum;
}

export function woundsByZone(u: Unit): ReadonlyMap<BodyZone, readonly Wound[]> {
  const out = new Map<BodyZone, Wound[]>();
  for (const z of ALL_BODY_ZONES) out.set(z, []);
  for (const w of u.wounds) out.get(w.zone)?.push(w);
  return out;
}

/**
 * Aim penalty from suppression. Stacks multiplicatively with blood tier.
 * 100 suppression → 0.5x aim contribution; 0 suppression → 1.0x.
 */
export function suppressionAimMultiplier(suppression: number): number {
  const s = Math.max(0, Math.min(MAX_SUPPRESSION, suppression));
  return 1 - s / 200;
}

export function totalBleedRate(u: Unit): number {
  let sum = 0;
  for (const w of u.wounds) {
    if (w.treatment === 'stabilized' || w.treatment === 'tourniquet') continue;
    const factor = w.treatment === 'bandaged' ? 0.3 : 1;
    sum += w.bleedRatePerSec * factor;
  }
  return sum;
}
