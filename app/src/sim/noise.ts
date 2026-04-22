import type { TerrainKind } from '@schema/map';
import type { UnitId } from '@shared/ids';
import { Fnv1a } from './hash';
import { SIM_HZ } from './state';
import type { Vec2 } from './unit';

export type NoiseKind =
  | 'weapon-fire'
  | 'explosion'
  | 'reload'
  | 'downed-cry'
  | 'footstep-standing'
  | 'footstep-crouched'
  | 'footstep-prone';

export const NOISE_LOUDNESS: Record<NoiseKind, { noiseDb: number; jitterMeters: number }> = {
  'weapon-fire': { noiseDb: 120, jitterMeters: 2 },
  explosion: { noiseDb: 200, jitterMeters: 1 },
  reload: { noiseDb: 15, jitterMeters: 1 },
  'downed-cry': { noiseDb: 40, jitterMeters: 3 },
  'footstep-standing': { noiseDb: 20, jitterMeters: 2 },
  'footstep-crouched': { noiseDb: 8, jitterMeters: 3 },
  'footstep-prone': { noiseDb: 3, jitterMeters: 4 },
};

export const HEARD_TTL_TICKS = SIM_HZ * 20;
export const FOOTSTEP_EMIT_EVERY_TICKS = Math.max(1, Math.round(SIM_HZ / 3));
export const HEARD_MAX_ENTRIES = 4;
export const HEARD_BEARING_MIN_CONFIDENCE = 0.3;
export const HEARD_INVESTIGATE_MIN_CONFIDENCE = 0.5;
export const SUPPRESSED_HEARING_MULTIPLIER = 0.6;

export type Heard = {
  readonly sourcePos: Vec2;
  readonly approxPos: Vec2;
  readonly bearing: number | null;
  readonly confidence: number;
  readonly tick: number;
  readonly kind: NoiseKind;
};

function terrainMultiplier(kind: TerrainKind): number {
  switch (kind) {
    case 'forest':
      return 0.6;
    case 'building':
      return 0.4;
    case 'rubble':
      return 0.85;
    default:
      return 1.0;
  }
}

export function effectiveHearingRange(
  kind: NoiseKind,
  awareness: number,
  listenerTerrainKind: TerrainKind,
  suppressed: boolean,
): number {
  const { noiseDb } = NOISE_LOUDNESS[kind];
  const aw = Math.max(0, Math.min(100, awareness));
  const awarenessMult = 0.5 + aw / 200;
  const terrainMult = terrainMultiplier(listenerTerrainKind);
  const suppressionMult = suppressed ? SUPPRESSED_HEARING_MULTIPLIER : 1;
  return noiseDb * awarenessMult * terrainMult * suppressionMult;
}

export function hearingConfidence(distance: number, effectiveRange: number): number {
  if (effectiveRange <= 0) return 0;
  if (distance <= 0) return 1;
  if (distance >= effectiveRange) return 0;
  const c = 1 - distance / effectiveRange;
  return c < 0 ? 0 : c > 1 ? 1 : c;
}

function kindSeed(kind: NoiseKind): number {
  let h = 0;
  for (let i = 0; i < kind.length; i++) h = (h * 31 + kind.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function approxPosJitter(
  tick: number,
  listenerId: UnitId,
  sourceId: UnitId,
  kind: NoiseKind,
  jitterMeters: number,
): Vec2 {
  const hx = new Fnv1a()
    .u32(tick)
    .u32(listenerId)
    .u32(sourceId)
    .u32(kindSeed(kind))
    .u32(0xa5a5a5a5);
  const hy = new Fnv1a()
    .u32(tick)
    .u32(listenerId)
    .u32(sourceId)
    .u32(kindSeed(kind))
    .u32(0x5a5a5a5a);
  const dxRaw = Number.parseInt(hx.digest(), 16);
  const dyRaw = Number.parseInt(hy.digest(), 16);
  const dx = ((dxRaw & 0xffff) / 0xffff) * 2 - 1;
  const dy = ((dyRaw & 0xffff) / 0xffff) * 2 - 1;
  return { x: dx * jitterMeters, y: dy * jitterMeters };
}
