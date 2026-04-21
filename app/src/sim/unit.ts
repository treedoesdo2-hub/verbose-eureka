import type { BodyZone } from '@schema/common';
import { ALL_BODY_ZONES } from '@schema/common';
import type { OperatorId, UnitId, WoundId } from '@shared/ids';
import type { CombatProfile } from './loadout';
import { emptyCombatProfile } from './loadout';

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
  readonly stats: UnitStats;
  readonly combat: CombatProfile;
  readonly position: Vec2;
  readonly facing: number;
  readonly velocity: Vec2;
  readonly bloodVolume: number;
  readonly wounds: readonly Wound[];
  readonly ammo: number;
  readonly action: UnitAction;
  readonly aiState: AiState;
  readonly alerted: boolean;
  readonly lastAlertedTick: number;
  readonly lastSeen: ReadonlyMap<UnitId, LastSeen>;
  readonly currentTarget: UnitId | null;
  readonly waypointIndex: number;
  readonly waypoints: readonly Vec2[];
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
}): Unit {
  const combat = params.combat ?? emptyCombatProfile();
  return {
    id: params.id,
    teamId: params.teamId,
    operatorId: params.operatorId,
    stats: params.stats ?? DEFAULT_STATS,
    combat,
    position: params.position,
    facing: params.facing,
    velocity: { x: 0, y: 0 },
    bloodVolume: MAX_BLOOD_VOLUME,
    wounds: [],
    ammo: combat.primaryWeapon?.magazineSize ?? 0,
    action: { kind: 'idle' },
    aiState: 'hold',
    alerted: false,
    lastAlertedTick: -1,
    lastSeen: new Map(),
    currentTarget: null,
    waypointIndex: 0,
    waypoints: params.waypoints ?? [],
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

export function totalBleedRate(u: Unit): number {
  let sum = 0;
  for (const w of u.wounds) {
    if (w.treatment === 'stabilized' || w.treatment === 'tourniquet') continue;
    const factor = w.treatment === 'bandaged' ? 0.3 : 1;
    sum += w.bleedRatePerSec * factor;
  }
  return sum;
}
