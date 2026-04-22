import { describe, expect, it } from 'vitest';
import {
  AtmosphereState,
  BUILDING_CRACK_THRESHOLDS,
  BUILDING_RUBBLE_THRESHOLD,
  SMOKE_THRESHOLD_SHOTS,
  SMOKE_WINDOW_MS,
} from './atmosphere-state';

describe('smoke accumulator', () => {
  it('does not emit before threshold', () => {
    const a = new AtmosphereState(64, 64, 1);
    let last: ReturnType<typeof a.recordFire> = null;
    for (let i = 0; i < SMOKE_THRESHOLD_SHOTS - 1; i++) {
      last = a.recordFire(10, 10, i * 10);
    }
    expect(last).toBeNull();
  });

  it('emits a source at threshold and resets', () => {
    const a = new AtmosphereState(64, 64, 1);
    let src: ReturnType<typeof a.recordFire> = null;
    for (let i = 0; i < SMOKE_THRESHOLD_SHOTS; i++) src = a.recordFire(10, 10, i * 10);
    expect(src).not.toBeNull();
    expect(src?.intensity).toBeGreaterThanOrEqual(SMOKE_THRESHOLD_SHOTS);
    // Next shot starts from 1, no emit.
    const nextSrc = a.recordFire(10, 10, SMOKE_THRESHOLD_SHOTS * 10);
    expect(nextSrc).toBeNull();
  });

  it('expires counters past the window', () => {
    const a = new AtmosphereState(64, 64, 1);
    for (let i = 0; i < SMOKE_THRESHOLD_SHOTS - 1; i++) a.recordFire(10, 10, i * 10);
    const late = a.recordFire(10, 10, 10 + SMOKE_WINDOW_MS + 100);
    // The late shot starts a fresh counter; no emit.
    expect(late).toBeNull();
  });

  it('keeps separate counters for distant tiles', () => {
    const a = new AtmosphereState(200, 200, 1);
    for (let i = 0; i < SMOKE_THRESHOLD_SHOTS - 1; i++) a.recordFire(10, 10, i * 10);
    // Far-away shot must NOT count toward (10,10).
    const far = a.recordFire(120, 120, SMOKE_THRESHOLD_SHOTS * 10);
    expect(far).toBeNull();
  });

  it('decay clears stale counters', () => {
    const a = new AtmosphereState(64, 64, 1);
    a.recordFire(10, 10, 0);
    a.decay(SMOKE_WINDOW_MS + 100);
    const next = a.recordFire(10, 10, SMOKE_WINDOW_MS + 200);
    // Decay wiped counter; next fire starts a new one at shots=1.
    expect(next).toBeNull();
  });
});

describe('building damage accumulator', () => {
  it('ignores non-building hits', () => {
    const a = new AtmosphereState(64, 64, 1);
    expect(a.recordBuildingHit(5, false)).toBeNull();
    expect(a.getBuildingDamage(5)).toBeUndefined();
  });

  it('escalates crack levels at the thresholds', () => {
    const a = new AtmosphereState(64, 64, 1);
    let last = a.recordBuildingHit(10, true);
    expect(last?.crackLevel).toBe(0);
    for (let i = 2; i <= BUILDING_CRACK_THRESHOLDS[0]; i++) last = a.recordBuildingHit(10, true);
    expect(last?.crackLevel).toBe(1);
    while ((last?.hits ?? 0) < BUILDING_CRACK_THRESHOLDS[1]) last = a.recordBuildingHit(10, true);
    expect(last?.crackLevel).toBe(2);
    while ((last?.hits ?? 0) < BUILDING_CRACK_THRESHOLDS[2]) last = a.recordBuildingHit(10, true);
    expect(last?.crackLevel).toBe(3);
  });

  it('flips to rubbled at the rubble threshold', () => {
    const a = new AtmosphereState(64, 64, 1);
    let last: ReturnType<typeof a.recordBuildingHit> = null;
    for (let i = 0; i < BUILDING_RUBBLE_THRESHOLD; i++) last = a.recordBuildingHit(10, true);
    expect(last?.rubbled).toBe(true);
  });

  it('allBuildingDamage returns the full map', () => {
    const a = new AtmosphereState(64, 64, 1);
    a.recordBuildingHit(10, true);
    a.recordBuildingHit(25, true);
    expect(a.allBuildingDamage().size).toBe(2);
    expect(a.getBuildingDamage(99)).toBeUndefined();
  });
});
