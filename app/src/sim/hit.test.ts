import type { BodyZone } from '@schema/common';
import type { Weapon } from '@schema/weapon';
import { asUnitId, asWeaponId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import { resolveShot } from './hit';
import { Rng } from './rng';
import { makeUnit } from './unit';
import { makeWorld } from './world';

const rifle: Weapon = {
  id: asWeaponId('test-ar'),
  name: 'Test AR',
  hardpoint: 'primary',
  damageType: 'ballistic',
  ballistics: {
    caliberMm: 5.56,
    velocityMps: 900,
    massGrams: 4,
    penetration: 45,
  },
  baseAccuracy: 65,
  rpm: 600,
  magazineSize: 30,
  reloadSeconds: 2.5,
  rangeMeters: 300,
  weightKg: 3.6,
  hands: 2,
  cost: 1200,
};

function zoneDr(overrides: Partial<Record<BodyZone, number>>): Record<BodyZone, number> {
  return {
    head: 0,
    torso_front: 0,
    torso_back: 0,
    left_arm: 0,
    right_arm: 0,
    left_hand: 0,
    right_hand: 0,
    waist: 0,
    left_leg: 0,
    right_leg: 0,
    back_mount: 0,
    ...overrides,
  };
}

const noArmor = zoneDr({});
const lightArmor = zoneDr({ torso_front: 20, torso_back: 20 });
const heavyArmor = zoneDr({ head: 30, torso_front: 70, torso_back: 70 });

function shoot(
  iterations: number,
  targetZoneDr: Record<BodyZone, number>,
  seed = 42,
): Record<string, number> {
  const world = makeWorld(64, 64, 1);
  const counts = { miss: 0, block: 0, wound: 0 };
  for (let i = 0; i < iterations; i++) {
    const rng = new Rng(seed + i);
    const shooter = makeUnit({
      id: asUnitId(1),
      teamId: 0,
      operatorId: null,
      position: { x: 10, y: 10 },
      facing: 0,
    });
    const target = makeUnit({
      id: asUnitId(2),
      teamId: 1,
      operatorId: null,
      position: { x: 25, y: 10 },
      facing: Math.PI,
    });
    const out = resolveShot({
      world,
      shooter,
      target,
      weapon: rifle,
      shooterAim: 50,
      targetZoneDr,
      rng,
      tick: 0,
      nextWoundId: 1,
    });
    counts[out.kind] += 1;
  }
  return counts;
}

describe('hit resolution', () => {
  it('produces wounds against unarmored target', () => {
    const r = shoot(200, noArmor);
    expect(r.wound).toBeGreaterThan(0);
  });

  it('heavy armor blocks more shots than light armor', () => {
    const light = shoot(500, lightArmor);
    const heavy = shoot(500, heavyArmor);
    expect(heavy.block).toBeGreaterThan(light.block);
    expect(heavy.wound).toBeLessThan(light.wound);
  });

  it('miss/block/wound partition sums to all shots', () => {
    const n = 200;
    const r = shoot(n, lightArmor);
    expect(r.miss + r.block + r.wound).toBe(n);
  });
});
