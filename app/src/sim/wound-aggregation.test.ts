import { asUnitId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import {
  BLOOD_TIER_THRESHOLDS,
  BLOODOUT_THRESHOLD,
  bloodTier,
  bloodTierModifiers,
  makeUnit,
  zoneSeverityPct,
} from './unit';
import { createWound, severityPctFromDamage, severityTierFromPct } from './wound';

function unit(bloodVolume = 100) {
  const u = makeUnit({
    id: asUnitId(1),
    teamId: 0,
    operatorId: null,
    position: { x: 0, y: 0 },
    facing: 0,
  });
  return { ...u, bloodVolume };
}

describe('severityPctFromDamage', () => {
  it('clamps negative input to 0', () => {
    expect(severityPctFromDamage(-5)).toBe(0);
    expect(severityPctFromDamage(0)).toBe(0);
  });

  it('saturates at a ceiling (damage capped at 50 before scaling)', () => {
    // hit resolution produces 0..~50 damage; anything beyond that pegs the top.
    const ceiling = severityPctFromDamage(50);
    expect(severityPctFromDamage(1000)).toBe(ceiling);
    expect(ceiling).toBeLessThanOrEqual(100);
  });

  it('is monotonic', () => {
    const a = severityPctFromDamage(5);
    const b = severityPctFromDamage(15);
    const c = severityPctFromDamage(30);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });
});

describe('severityTierFromPct', () => {
  it('maps pct bands to discrete tiers', () => {
    expect(severityTierFromPct(0)).toBe('graze');
    expect(severityTierFromPct(14.9)).toBe('graze');
    expect(severityTierFromPct(15)).toBe('light');
    expect(severityTierFromPct(34.9)).toBe('light');
    expect(severityTierFromPct(35)).toBe('serious');
    expect(severityTierFromPct(64.9)).toBe('serious');
    expect(severityTierFromPct(65)).toBe('critical');
    expect(severityTierFromPct(100)).toBe('critical');
  });
});

describe('zoneSeverityPct aggregation', () => {
  it('sums same-zone severities', () => {
    const rng = new Rng(1);
    const base = unit();
    const w1 = createWound(1, 'torso_front', 'gunshot', 15, 0, rng);
    const w2 = createWound(2, 'torso_front', 'gunshot', 15, 0, rng);
    const u = { ...base, wounds: [w1, w2] };
    const combined = w1.severityPct + w2.severityPct;
    expect(zoneSeverityPct(u, 'torso_front')).toBeCloseTo(combined, 5);
  });

  it('caps aggregate at 100 regardless of count', () => {
    const rng = new Rng(2);
    const wounds = Array.from({ length: 5 }, (_, i) =>
      createWound(i + 1, 'torso_front', 'gunshot', 40, 0, rng),
    );
    const u = { ...unit(), wounds };
    expect(zoneSeverityPct(u, 'torso_front')).toBe(100);
  });

  it('does not bleed across zones', () => {
    const rng = new Rng(3);
    const torso = createWound(1, 'torso_front', 'gunshot', 30, 0, rng);
    const leg = createWound(2, 'left_leg', 'gunshot', 30, 0, rng);
    const u = { ...unit(), wounds: [torso, leg] };
    expect(zoneSeverityPct(u, 'torso_front')).toBeCloseTo(torso.severityPct, 5);
    expect(zoneSeverityPct(u, 'left_leg')).toBeCloseTo(leg.severityPct, 5);
    expect(zoneSeverityPct(u, 'right_leg')).toBe(0);
  });
});

describe('bloodTier thresholds', () => {
  it('bins blood volume into five tiers', () => {
    expect(bloodTier(unit(100))).toBe('healthy');
    expect(bloodTier(unit(BLOOD_TIER_THRESHOLDS.healthy))).toBe('healthy');
    expect(bloodTier(unit(BLOOD_TIER_THRESHOLDS.healthy - 0.1))).toBe('wounded');
    expect(bloodTier(unit(BLOOD_TIER_THRESHOLDS.wounded))).toBe('wounded');
    expect(bloodTier(unit(BLOOD_TIER_THRESHOLDS.wounded - 0.1))).toBe('heavy');
    expect(bloodTier(unit(BLOOD_TIER_THRESHOLDS.heavy))).toBe('heavy');
    expect(bloodTier(unit(BLOOD_TIER_THRESHOLDS.heavy - 0.1))).toBe('critical');
    expect(bloodTier(unit(BLOOD_TIER_THRESHOLDS.critical))).toBe('critical');
    expect(bloodTier(unit(BLOOD_TIER_THRESHOLDS.critical - 0.1))).toBe('bleedout');
    expect(bloodTier(unit(0))).toBe('bleedout');
  });

  it('BLOODOUT_THRESHOLD matches the critical tier floor', () => {
    expect(BLOODOUT_THRESHOLD).toBe(BLOOD_TIER_THRESHOLDS.critical);
  });
});

describe('bloodTierModifiers progressive penalty', () => {
  it('aim multiplier decreases monotonically toward bleedout', () => {
    const healthy = bloodTierModifiers('healthy').aimMultiplier;
    const wounded = bloodTierModifiers('wounded').aimMultiplier;
    const heavy = bloodTierModifiers('heavy').aimMultiplier;
    const critical = bloodTierModifiers('critical').aimMultiplier;
    const bleedout = bloodTierModifiers('bleedout').aimMultiplier;
    expect(healthy).toBe(1);
    expect(wounded).toBeLessThan(healthy);
    expect(heavy).toBeLessThan(wounded);
    expect(critical).toBeLessThan(heavy);
    expect(bleedout).toBe(0);
  });

  it('move multiplier decreases monotonically toward bleedout', () => {
    const healthy = bloodTierModifiers('healthy').moveMultiplier;
    const wounded = bloodTierModifiers('wounded').moveMultiplier;
    const heavy = bloodTierModifiers('heavy').moveMultiplier;
    const critical = bloodTierModifiers('critical').moveMultiplier;
    const bleedout = bloodTierModifiers('bleedout').moveMultiplier;
    expect(healthy).toBe(1);
    expect(wounded).toBeLessThan(healthy);
    expect(heavy).toBeLessThan(wounded);
    expect(critical).toBeLessThan(heavy);
    expect(bleedout).toBe(0);
  });
});

describe('createWound', () => {
  it('stores both discrete severity and continuous severityPct', () => {
    const rng = new Rng(4);
    const w = createWound(1, 'head', 'gunshot', 10, 0, rng);
    expect(w.severityPct).toBeGreaterThan(0);
    expect(w.severityPct).toBeLessThanOrEqual(100);
    expect(w.severity).toBe(severityTierFromPct(w.severityPct));
  });
});
