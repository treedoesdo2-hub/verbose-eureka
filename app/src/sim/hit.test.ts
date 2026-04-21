import type { BodyZone } from '@schema/common';
import { asUnitId } from '@shared/ids';
import { makeWeapon, makeZoneDr } from '@test-helpers/fixtures';
import { describe, expect, it } from 'vitest';
import { resolveShot } from './hit';
import { Rng } from './rng';
import { makeUnit } from './unit';
import { makeWorld } from './world';

const rifle = makeWeapon({ name: 'Test AR' });
const noArmor = makeZoneDr();
const lightArmor = makeZoneDr({ torso_front: 20, torso_back: 20 });
const heavyArmor = makeZoneDr({ head: 30, torso_front: 70, torso_back: 70 });

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
