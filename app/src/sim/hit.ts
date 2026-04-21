import type { Armor, ArmorPlacement } from '@schema/armor';
import type { BodyZone } from '@schema/common';
import type { Weapon } from '@schema/weapon';
import { effectivePenetration } from './ballistics';
import { coverScore, MAX_COVER_SCORE } from './cover';
import { distance } from './los';
import type { Rng } from './rng';
import type { Unit, Wound } from './unit';
import type { World } from './world';
import { createWound } from './wound';

export type ShotContext = {
  world: World;
  shooter: Unit;
  target: Unit;
  weapon: Weapon;
  shooterAim: number;
  targetArmor: Armor | null;
  rng: Rng;
  tick: number;
  nextWoundId: number;
};

export type ShotOutcome =
  | { kind: 'miss'; reason: 'accuracy' | 'cover' | 'range'; accuracyFinal: number }
  | { kind: 'block'; zone: BodyZone; effectivePen: number; dr: number }
  | { kind: 'wound'; zone: BodyZone; wound: Wound; effectivePen: number; dr: number };

const ZONE_WEIGHTS_FRONT: Record<BodyZone, number> = {
  head: 0.08,
  torso_front: 0.38,
  torso_back: 0.02,
  pelvis: 0.1,
  left_arm: 0.1,
  right_arm: 0.1,
  left_leg: 0.11,
  right_leg: 0.11,
};

const ZONE_WEIGHTS_BACK: Record<BodyZone, number> = {
  head: 0.08,
  torso_front: 0.02,
  torso_back: 0.38,
  pelvis: 0.08,
  left_arm: 0.1,
  right_arm: 0.1,
  left_leg: 0.12,
  right_leg: 0.12,
};

function facingDotBearing(target: Unit, shooter: Unit): number {
  const dx = shooter.position.x - target.position.x;
  const dy = shooter.position.y - target.position.y;
  const mag = Math.hypot(dx, dy) || 1;
  const fx = Math.cos(target.facing);
  const fy = Math.sin(target.facing);
  return (fx * dx + fy * dy) / mag;
}

function pickZone(rng: Rng, target: Unit, shooter: Unit): BodyZone {
  const dot = facingDotBearing(target, shooter);
  const weights = dot > 0 ? ZONE_WEIGHTS_FRONT : ZONE_WEIGHTS_BACK;
  let r = rng.next();
  for (const [zone, w] of Object.entries(weights) as [BodyZone, number][]) {
    r -= w;
    if (r <= 0) return zone;
  }
  return 'torso_front';
}

function armorDrForZone(armor: Armor | null, zone: BodyZone): number {
  if (!armor) return 0;
  let best = 0;
  for (const p of armor.placements as readonly ArmorPlacement[]) {
    if (p.zone === zone && p.damageReduction > best) best = p.damageReduction;
  }
  return best;
}

export function resolveShot(ctx: ShotContext): ShotOutcome {
  const dist = distance(ctx.shooter.position, ctx.target.position);
  const cover = coverScore(ctx.world, ctx.shooter, ctx.target);

  const rangePenalty = Math.max(0, (dist - ctx.weapon.rangeMeters * 0.5) * 0.1);
  const coverPenalty = (cover / MAX_COVER_SCORE) * 60;
  const accuracyFinal = Math.max(
    5,
    Math.min(98, ctx.weapon.baseAccuracy + ctx.shooterAim * 0.3 - rangePenalty - coverPenalty),
  );

  if (ctx.rng.next() * 100 >= accuracyFinal) {
    const reason =
      cover > MAX_COVER_SCORE * 0.5 ? 'cover' : rangePenalty > 20 ? 'range' : 'accuracy';
    return { kind: 'miss', reason, accuracyFinal };
  }

  const zone = pickZone(ctx.rng, ctx.target, ctx.shooter);
  const effectivePen = effectivePenetration(ctx.weapon.ballistics, dist);
  const dr = armorDrForZone(ctx.targetArmor, zone);

  if (dr > 0 && effectivePen < dr) {
    return { kind: 'block', zone, effectivePen, dr };
  }

  const overPen = dr === 0 ? effectivePen : Math.max(0, effectivePen - dr);
  const penMult = dr === 0 ? 1 : Math.min(1, 0.4 + (0.6 * overPen) / Math.max(1, dr));
  const rawDamage = 8 + ctx.weapon.ballistics.caliberMm * 1.2;
  const damage = rawDamage * penMult;

  const wound = createWound(
    ctx.nextWoundId,
    zone,
    ctx.weapon.damageType as Wound['type'],
    damage,
    ctx.tick,
    ctx.rng,
  );
  return { kind: 'wound', zone, wound, effectivePen, dr };
}
