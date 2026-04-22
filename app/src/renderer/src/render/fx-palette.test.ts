import { describe, expect, it } from 'vitest';
import {
  BLEED_DOT,
  BLOOD_BRIGHT,
  BLOOD_DARK,
  BLOOD_POOL,
  CASING_BRASS,
  CASING_SHADOW,
  DOWNED_BODY,
  DOWNED_OUTLINE,
  DUST_DARK,
  DUST_LIGHT,
  MORALE_AURA,
  MORALE_AURA_PULSE,
  MUZZLE_BLOOM,
  MUZZLE_CORE,
  MUZZLE_SMOKE,
  PIN_AURA,
  POOL_BLOOD,
  SPARK_COOL,
  SPARK_CORE,
  SPARK_HOT,
  SUPPRESSION_HALO,
  SUPPRESSION_PULSE,
  TARGET_LOCK,
  TARGET_LOCK_SOFT,
  TRACER_CORE,
  TRACER_GLOW,
  WOUND_ICON_CRITICAL,
  WOUND_ICON_GRAZE,
  WOUND_ICON_LIGHT,
  WOUND_ICON_SERIOUS,
} from './fx-palette';

const ALL = {
  MUZZLE_CORE,
  MUZZLE_BLOOM,
  MUZZLE_SMOKE,
  TRACER_CORE,
  TRACER_GLOW,
  BLOOD_DARK,
  BLOOD_BRIGHT,
  BLOOD_POOL,
  SPARK_CORE,
  SPARK_HOT,
  SPARK_COOL,
  DUST_LIGHT,
  DUST_DARK,
  SUPPRESSION_HALO,
  SUPPRESSION_PULSE,
  DOWNED_BODY,
  DOWNED_OUTLINE,
  POOL_BLOOD,
  MORALE_AURA,
  MORALE_AURA_PULSE,
  PIN_AURA,
  WOUND_ICON_GRAZE,
  WOUND_ICON_LIGHT,
  WOUND_ICON_SERIOUS,
  WOUND_ICON_CRITICAL,
  BLEED_DOT,
  TARGET_LOCK,
  TARGET_LOCK_SOFT,
  CASING_BRASS,
  CASING_SHADOW,
};

function channelSum(c: number): number {
  return ((c >> 16) & 0xff) + ((c >> 8) & 0xff) + (c & 0xff);
}

describe('fx palette', () => {
  it('all entries are valid 24-bit RGB', () => {
    for (const [name, value] of Object.entries(ALL)) {
      expect(value, name).toBeGreaterThanOrEqual(0);
      expect(value, name).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('blood-dark is darker than blood-bright', () => {
    expect(channelSum(BLOOD_DARK)).toBeLessThan(channelSum(BLOOD_BRIGHT));
  });

  it('spark-hot is brighter than spark-cool', () => {
    expect(channelSum(SPARK_HOT)).toBeGreaterThan(channelSum(SPARK_COOL));
  });

  it('dust-light is lighter than dust-dark', () => {
    expect(channelSum(DUST_LIGHT)).toBeGreaterThan(channelSum(DUST_DARK));
  });

  it('downed outline is darker than downed body', () => {
    expect(channelSum(DOWNED_OUTLINE)).toBeLessThan(channelSum(DOWNED_BODY));
  });

  it('wound icon severity ramp has four distinct colors', () => {
    const colors = new Set([
      WOUND_ICON_GRAZE,
      WOUND_ICON_LIGHT,
      WOUND_ICON_SERIOUS,
      WOUND_ICON_CRITICAL,
    ]);
    expect(colors.size).toBe(4);
  });

  it('wound critical is dominated by red channel', () => {
    const r = (WOUND_ICON_CRITICAL >> 16) & 0xff;
    const g = (WOUND_ICON_CRITICAL >> 8) & 0xff;
    const b = WOUND_ICON_CRITICAL & 0xff;
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it('casing shadow is darker than casing brass', () => {
    expect(channelSum(CASING_SHADOW)).toBeLessThan(channelSum(CASING_BRASS));
  });

  it('morale aura and pin aura are distinct colors', () => {
    expect(MORALE_AURA).not.toBe(PIN_AURA);
  });

  it('target lock ring colors are distinct', () => {
    expect(TARGET_LOCK).not.toBe(TARGET_LOCK_SOFT);
  });
});
