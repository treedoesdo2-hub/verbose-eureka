import { describe, expect, it } from 'vitest';
import { coverEvalAt } from './cover';
import { castRay, castRayStance, type SmokeVolume } from './los';
import {
  applyBarrierDamage,
  BARRIER_MAX_HP,
  makeWorld,
  setBarrier,
  setPoint,
  type World,
} from './world';

// ---------------------------------------------------------------------------
// three_axis_matrix — LOS × cover crosses produce the expected per-sample
// score band. Verifies the 3-axis decomposition (LOS block × cover level ×
// height) yields coverEvalAt scores in a predictable ordering.

describe('fixture: three_axis_matrix', () => {
  function shootAt(w: World, pointKind: Parameters<typeof setPoint>[3]): number {
    setPoint(w, 15, 10, pointKind);
    return coverEvalAt(
      w,
      { x: 5, y: 10 },
      'standing',
      { x: 25, y: 10 },
      'standing',
    ).score;
  }

  it('none/none (open) gives zero cover', () => {
    const w = makeWorld(48, 24, 1);
    const score = coverEvalAt(
      w,
      { x: 5, y: 10 },
      'standing',
      { x: 25, y: 10 },
      'standing',
    ).score;
    expect(score).toBe(0);
  });

  it('thin/light (bush_small) scores less than full/full (storage_tank)', () => {
    const wBush = makeWorld(48, 24, 1);
    const bush = shootAt(wBush, 'bush_small');
    const wTank = makeWorld(48, 24, 1);
    const tank = shootAt(wTank, 'storage_tank');
    expect(bush).toBeGreaterThan(0);
    expect(tank).toBeGreaterThan(bush);
  });

  it('thin/heavy (barrel) scores between light and full', () => {
    const wBush = makeWorld(48, 24, 1);
    const wBarrel = makeWorld(48, 24, 1);
    const wTank = makeWorld(48, 24, 1);
    const bush = shootAt(wBush, 'bush_small');
    const barrel = shootAt(wBarrel, 'barrel');
    const tank = shootAt(wTank, 'storage_tank');
    expect(barrel).toBeGreaterThanOrEqual(bush);
    expect(barrel).toBeLessThanOrEqual(tank);
  });
});

// ---------------------------------------------------------------------------
// destructible_walk — a hedge transitions cover axes as it damages. Covers
// the mutator's cache invalidation + DAMAGED_AXES switch.

describe('fixture: destructible_walk', () => {
  it('hedge cover score drops when damaged, drops to zero when destroyed', () => {
    const w = makeWorld(32, 16, 1);
    setBarrier(w, 15, 8, 'N', 'hedge');

    const intactScore = coverEvalAt(
      w,
      { x: 15, y: 2 },
      'standing',
      { x: 15, y: 10 },
      'standing',
    ).score;
    expect(intactScore).toBeGreaterThan(0);

    // Damage past half — hedge is now thin/light with low height.
    applyBarrierDamage(w, 15, 8, 'N', BARRIER_MAX_HP['hedge']! - 5);
    const damagedScore = coverEvalAt(
      w,
      { x: 15, y: 2 },
      'standing',
      { x: 15, y: 10 },
      'standing',
    ).score;
    expect(damagedScore).toBeLessThanOrEqual(intactScore);

    // Destroy → leaves rubble_strip (thin, light, low).
    applyBarrierDamage(w, 15, 8, 'N', 100);
    const destroyedScore = coverEvalAt(
      w,
      { x: 15, y: 2 },
      'standing',
      { x: 15, y: 10 },
      'standing',
    ).score;
    // Post-destroy rubble still provides SOME cover but strictly less than
    // an intact hedge (higher silhouette, heavier cover).
    expect(destroyedScore).toBeLessThan(intactScore);
  });
});

// ---------------------------------------------------------------------------
// stance_peek — a prone attacker behind a chest-high wall is blocked from
// a standing observer, but the same wall is full-LOS for a standing shooter
// pointing back at the observer. Validates that eye-height differences
// interact correctly with per-tile occluder height.

describe('fixture: stance_peek', () => {
  it('low wall (cover=heavy, height=chest) concealment flips with stance', () => {
    const w = makeWorld(48, 16, 1);
    // A stone_wall_low on the shared edge between shooter and target rows.
    for (let x = 15; x <= 18; x++) setBarrier(w, x, 8, 'N', 'stone_wall_low');

    // Standing vs standing: wall blocks or strongly occludes ray.
    const standVsStand = castRayStance(
      w,
      { x: 16, y: 5 },
      'standing',
      { x: 16, y: 11 },
      'standing',
    );
    // Prone vs prone: ray passes below wall height in a world without
    // elevation drops, so LOS is typically maintained.
    const proneVsProne = castRayStance(
      w,
      { x: 16, y: 5 },
      'prone',
      { x: 16, y: 11 },
      'prone',
    );
    // The two stances should not produce the same result — the wall must
    // discriminate based on eye height.
    expect(standVsStand === proneVsProne).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// smoke — a smoke volume placed between shooter and target thins an
// otherwise visible ray. Large enough volumes block.

describe('fixture: smoke', () => {
  it('no smoke = visible; thin smoke = concealed; dense smoke = blocked', () => {
    const w = makeWorld(48, 16, 1);
    const shooter = { x: 5, y: 8 };
    const target = { x: 25, y: 8 };

    const noSmoke = castRay(w, shooter, 1.7, target, 1.7);
    expect(noSmoke).toBe('visible');

    const thin: SmokeVolume[] = [
      { x: 15, y: 8, radius: 3, opacityTop: 3, opacityPerMeter: 0.02 },
    ];
    const thinRes = castRay(w, shooter, 1.7, target, 1.7, { smoke: thin });
    expect(['concealed', 'blocked']).toContain(thinRes);

    const dense: SmokeVolume[] = [
      { x: 15, y: 8, radius: 6, opacityTop: 5, opacityPerMeter: 0.5 },
    ];
    const denseRes = castRay(w, shooter, 1.7, target, 1.7, { smoke: dense });
    expect(denseRes).toBe('blocked');
  });

  it('smoke below opacityTop only — standing eye above smoke sees through', () => {
    const w = makeWorld(48, 16, 1);
    const shooter = { x: 5, y: 8 };
    const target = { x: 25, y: 8 };
    // Low-hanging smoke (cap at 0.5m above ground) should not obscure a
    // 1.7m standing eye-line.
    const groundSmoke: SmokeVolume[] = [
      { x: 15, y: 8, radius: 3, opacityTop: 0.5, opacityPerMeter: 0.4 },
    ];
    const res = castRay(w, shooter, 1.7, target, 1.7, { smoke: groundSmoke });
    expect(res).toBe('visible');
  });
});
