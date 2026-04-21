import type { BodyZone } from '@schema/common';
import { asWoundId } from '@shared/ids';
import type { Rng } from './rng';
import type { Wound, WoundSeverity, WoundType } from './unit';

const BASE_BLEED_BY_ZONE: Record<BodyZone, number> = {
  head: 1.2,
  torso_front: 1.5,
  torso_back: 1.5,
  pelvis: 1.3,
  left_arm: 0.7,
  right_arm: 0.7,
  left_leg: 1.0,
  right_leg: 1.0,
};

const SEVERITY_MULT: Record<WoundSeverity, number> = {
  graze: 0.3,
  light: 0.7,
  serious: 1.3,
  critical: 2.0,
};

export function severityFromDamage(damage: number): WoundSeverity {
  if (damage < 5) return 'graze';
  if (damage < 15) return 'light';
  if (damage < 30) return 'serious';
  return 'critical';
}

export function createWound(
  nextId: number,
  zone: BodyZone,
  type: WoundType,
  damage: number,
  tick: number,
  rng: Rng,
): Wound {
  const severity = severityFromDamage(damage);
  const base = BASE_BLEED_BY_ZONE[zone];
  const jitter = 0.8 + rng.next() * 0.4;
  const bleedRatePerSec = base * SEVERITY_MULT[severity] * jitter;
  return {
    id: asWoundId(nextId),
    zone,
    type,
    severity,
    bleedRatePerSec,
    treatment: 'untreated',
    tickInflicted: tick,
  };
}
