import { describe, expect, it } from 'vitest';
import {
  BLOOD_BRIGHT,
  BLOOD_DARK,
  BLOOD_POOL,
  DOWNED_BODY,
  DOWNED_OUTLINE,
  DUST_DARK,
  DUST_LIGHT,
  MUZZLE_BLOOM,
  MUZZLE_CORE,
  MUZZLE_SMOKE,
  POOL_BLOOD,
  SPARK_COOL,
  SPARK_CORE,
  SPARK_HOT,
  SUPPRESSION_HALO,
  SUPPRESSION_PULSE,
  TRACER_CORE,
  TRACER_GLOW,
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
});
