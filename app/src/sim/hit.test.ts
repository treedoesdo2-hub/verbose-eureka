import type { Armor } from '@schema/armor';
import type { Weapon } from '@schema/weapon';
import { asArmorId, asUnitId, asWeaponId } from '@shared/ids';
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
  tonnage: 4,
  critSlots: 2,
  cost: 1200,
};

const lightArmor: Armor = {
  id: asArmorId('test-light'),
  name: 'Light Plates',
  class: 'light',
  mobilityPenalty: 5,
  cost: 400,
  placements: [
    { zone: 'torso_front', damageReduction: 20, tonnage: 2 },
    { zone: 'torso_back', damageReduction: 20, tonnage: 2 },
  ],
};

const heavyArmor: Armor = {
  id: asArmorId('test-heavy'),
  name: 'Heavy Plates',
  class: 'heavy',
  mobilityPenalty: 25,
  cost: 2000,
  placements: [
    { zone: 'head', damageReduction: 30, tonnage: 1 },
    { zone: 'torso_front', damageReduction: 70, tonnage: 4 },
    { zone: 'torso_back', damageReduction: 70, tonnage: 4 },
    { zone: 'pelvis', damageReduction: 60, tonnage: 3 },
  ],
};

function shoot(iterations: number, armor: Armor | null, seed = 42): Record<string, number> {
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
      targetArmor: armor,
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
    const r = shoot(200, null);
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
