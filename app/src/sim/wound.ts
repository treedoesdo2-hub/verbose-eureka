import type { BodyZone } from '@schema/common';
import { asWoundId } from '@shared/ids';
import type { Rng } from './rng';
import type { Wound, WoundSeverity, WoundType } from './unit';

const BASE_BLEED_BY_ZONE: Partial<Record<BodyZone, number>> = {
  head: 1.2,
  torso_front: 1.5,
  torso_back: 1.5,
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

export function severityTierFromPct(severityPct: number): WoundSeverity {
  if (severityPct < 15) return 'graze';
  if (severityPct < 35) return 'light';
  if (severityPct < 65) return 'serious';
  return 'critical';
}

// Legacy API kept for tests that assert the discrete tier directly.
export function severityFromDamage(damage: number): WoundSeverity {
  return severityTierFromPct(severityPctFromDamage(damage));
}

export function severityPctFromDamage(damage: number): number {
  // Damage arrives in 0..~50 range from hit resolution; compress to 0..100
  // continuous severity with a slight non-linearity so low damage doesn't
  // produce meaningful aggregation (a graze shouldn't tip past "light").
  const capped = Math.max(0, Math.min(damage, 50));
  const pct = Math.min(100, capped * 1.8);
  return Math.round(pct * 10) / 10;
}

export function createWound(
  nextId: number,
  zone: BodyZone,
  type: WoundType,
  damage: number,
  tick: number,
  rng: Rng,
): Wound {
  const severityPct = severityPctFromDamage(damage);
  const severity = severityTierFromPct(severityPct);
  const base = BASE_BLEED_BY_ZONE[zone] ?? 1.0;
  const jitter = 0.8 + rng.next() * 0.4;
  const bleedRatePerSec = base * SEVERITY_MULT[severity] * jitter;
  return {
    id: asWoundId(nextId),
    zone,
    type,
    severity,
    severityPct,
    bleedRatePerSec,
    treatment: 'untreated',
    tickInflicted: tick,
  };
}
