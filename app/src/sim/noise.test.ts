import { asUnitId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import { approxPosJitter, effectiveHearingRange, hearingConfidence, NOISE_LOUDNESS } from './noise';
import { BASE_AXES, POINT_AXES } from './world';

describe('effectiveHearingRange', () => {
  it('returns a positive range for weapon-fire at neutral awareness on open terrain', () => {
    const r = effectiveHearingRange('weapon-fire', 50, BASE_AXES.open, false);
    expect(r).toBeGreaterThan(50);
    expect(r).toBeLessThanOrEqual(NOISE_LOUDNESS['weapon-fire'].noiseDb);
  });

  it('foliage axes reduce range vs open', () => {
    const rOpen = effectiveHearingRange('weapon-fire', 50, BASE_AXES.open, false);
    const rForest = effectiveHearingRange('weapon-fire', 50, POINT_AXES.tree_forest, false);
    expect(rForest).toBeLessThan(rOpen);
  });

  it('high awareness extends range, low awareness shrinks it', () => {
    const rLow = effectiveHearingRange('weapon-fire', 10, BASE_AXES.open, false);
    const rHigh = effectiveHearingRange('weapon-fire', 90, BASE_AXES.open, false);
    expect(rHigh).toBeGreaterThan(rLow);
  });

  it('suppressed listener has reduced effective range', () => {
    const rNormal = effectiveHearingRange('weapon-fire', 50, BASE_AXES.open, false);
    const rSuppressed = effectiveHearingRange('weapon-fire', 50, BASE_AXES.open, true);
    expect(rSuppressed).toBeLessThan(rNormal);
  });
});

describe('hearingConfidence', () => {
  it('is 1 at distance 0, 0 at distance >= range, monotonic in between', () => {
    expect(hearingConfidence(0, 100)).toBe(1);
    expect(hearingConfidence(100, 100)).toBe(0);
    expect(hearingConfidence(150, 100)).toBe(0);
    const a = hearingConfidence(25, 100);
    const b = hearingConfidence(75, 100);
    expect(a).toBeGreaterThan(b);
  });
});

describe('approxPosJitter', () => {
  it('is deterministic under identical inputs', () => {
    const j1 = approxPosJitter(5, asUnitId(1), asUnitId(2), 'weapon-fire', 2);
    const j2 = approxPosJitter(5, asUnitId(1), asUnitId(2), 'weapon-fire', 2);
    expect(j1.x).toBe(j2.x);
    expect(j1.y).toBe(j2.y);
  });

  it('produces offsets within [-jitterMeters, jitterMeters]', () => {
    for (let t = 0; t < 20; t++) {
      const j = approxPosJitter(t, asUnitId(7), asUnitId(9), 'footstep-standing', 3);
      expect(j.x).toBeGreaterThanOrEqual(-3);
      expect(j.x).toBeLessThanOrEqual(3);
      expect(j.y).toBeGreaterThanOrEqual(-3);
      expect(j.y).toBeLessThanOrEqual(3);
    }
  });
});
