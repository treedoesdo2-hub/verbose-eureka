import type { BodyZone } from '@schema/common';
import { ALL_BODY_ZONES } from '@schema/common';
import type { OperatorId, UnitId, WoundId } from '@shared/ids';

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
  | { kind: 'aiming'; targetId: UnitId }
  | { kind: 'firing'; targetId: UnitId; roundsRemaining: number }
  | { kind: 'reloading'; ticksRemaining: number }
  | { kind: 'stabilizing'; targetId: UnitId; ticksRemaining: number }
  | { kind: 'dragging'; targetId: UnitId; to: Vec2 }
  | { kind: 'downed' }
  | { kind: 'dead' };

export type AiState = 'advance' | 'hold' | 'retreat' | 'flank' | 'recover' | 'panic';

export type Unit = {
  readonly id: UnitId;
  readonly teamId: number;
  readonly operatorId: OperatorId | null;
  readonly position: Vec2;
  readonly facing: number;
  readonly velocity: Vec2;
  readonly bloodVolume: number;
  readonly wounds: readonly Wound[];
  readonly action: UnitAction;
  readonly aiState: AiState;
  readonly alerted: boolean;
  readonly lastAlertedTick: number;
};

export function makeUnit(params: {
  id: UnitId;
  teamId: number;
  operatorId: OperatorId | null;
  position: Vec2;
  facing: number;
}): Unit {
  return {
    id: params.id,
    teamId: params.teamId,
    operatorId: params.operatorId,
    position: params.position,
    facing: params.facing,
    velocity: { x: 0, y: 0 },
    bloodVolume: MAX_BLOOD_VOLUME,
    wounds: [],
    action: { kind: 'idle' },
    aiState: 'hold',
    alerted: false,
    lastAlertedTick: -1,
  };
}

export function isAlive(u: Unit): boolean {
  return u.action.kind !== 'dead';
}

export function isDowned(u: Unit): boolean {
  return u.action.kind === 'downed' || u.bloodVolume <= BLOODOUT_THRESHOLD;
}

export function woundsByZone(u: Unit): ReadonlyMap<BodyZone, readonly Wound[]> {
  const out = new Map<BodyZone, Wound[]>();
  for (const z of ALL_BODY_ZONES) out.set(z, []);
  for (const w of u.wounds) out.get(w.zone)!.push(w);
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
