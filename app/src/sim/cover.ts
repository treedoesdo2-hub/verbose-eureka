import { castRay, eyeHeightFor } from './los';
import type { Unit, Vec2 } from './unit';
import type { World } from './world';

export const MAX_COVER_SCORE = 80;

const BODY_OFFSET = 0.35;

function samplePoints(center: Vec2, bearing: number): readonly { pos: Vec2; eye: number }[] {
  const cos = Math.cos(bearing);
  const sin = Math.sin(bearing);
  return [
    { pos: center, eye: eyeHeightFor('standing') },
    {
      pos: { x: center.x - sin * BODY_OFFSET, y: center.y + cos * BODY_OFFSET },
      eye: 1.2,
    },
    {
      pos: { x: center.x + sin * BODY_OFFSET, y: center.y - cos * BODY_OFFSET },
      eye: 1.2,
    },
    {
      pos: { x: center.x + cos * BODY_OFFSET * 0.2, y: center.y + sin * BODY_OFFSET * 0.2 },
      eye: 0.9,
    },
    {
      pos: { x: center.x - cos * BODY_OFFSET * 0.2, y: center.y - sin * BODY_OFFSET * 0.2 },
      eye: 0.9,
    },
  ];
}

export function coverScore(world: World, shooter: Unit, target: Unit): number {
  return coverScoreAt(world, shooter.position, target.position);
}

/**
 * Position-only variant: the cover a unit *would* have at `pos` against
 * a shooter firing from `shooterPos`. Used by cover-aware pathfinding
 * to score candidate move steps without constructing synthetic Units.
 */
export function coverScoreAt(world: World, shooterPos: Vec2, pos: Vec2): number {
  const bearing = Math.atan2(shooterPos.y - pos.y, shooterPos.x - pos.x);
  const samples = samplePoints(pos, bearing);
  const shooterEye = eyeHeightFor('standing');
  let score = 0;
  for (const s of samples) {
    const r = castRay(world, shooterPos, shooterEye, s.pos, s.eye);
    if (r === 'blocked') score += MAX_COVER_SCORE / samples.length;
    else if (r === 'concealed') score += MAX_COVER_SCORE / samples.length / 2;
  }
  return score;
}
