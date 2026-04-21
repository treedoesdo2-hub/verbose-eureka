import type { BodyZone } from '@schema/common';
import { ALL_BODY_ZONES } from '@schema/common';
import type { OperatorId, UnitId, WoundId } from '@shared/ids';
import type { CombatProfile } from './loadout';
import { emptyCombatProfile } from './loadout';

export const MAX_BLOOD_VOLUME = 100;
export const BLOODOUT_THRESHOLD = 30;

export type WoundType = 'gunshot' | 'fragmentation' | 'blunt' | 'burn' | 'cut';
export type WoundSeverity = 'graze' | 'light' | 'serious' | 'critical';
export type TreatmentState = 'untreated' | 'bandaged' | 'tourniquet' | 'stabilized';

export type Wound = {
  readonly id: WoundId;
  readonly zone: BodyZone;
  readonly type: WoundType;
  readonly severity: WoundSeverity;
  readonly bleedRatePerSec: number;
  readonly treatment: TreatmentState;
  readonly tickInflicted: number;
};

export type Vec2 = { readonly x: number; readonly y: number };

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
