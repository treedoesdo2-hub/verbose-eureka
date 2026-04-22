import { castRayAxes, eyeHeightFor, type Stance } from './los';
import type { Unit, Vec2 } from './unit';
import type { CoverAxes, CoverLevel, LosBlock, World } from './world';
import { elevationMeters, inBounds } from './world';

export const MAX_COVER_SCORE = 80;

// Per-sample axis-based point table. Five samples per target silhouette, each
// contributing at most 16 points, totals 80. Points preserve the numeric
// scale hit.ts already expects (coverPenalty up to 60% at MAX_COVER_SCORE).
const AXIS_TO_POINTS: Record<LosBlock, Record<CoverLevel, number>> = {
  // no LOS change, only cover — tank trap / bare cover
  none: { none: 0, light: 4, heavy: 8, full: 12 },
  // partial LOS break + cover — bush / haystack
  thin: { none: 2, light: 8, heavy: 12, full: 14 },
  // sightline break — wall / building / bocage
  full: { none: 8, light: 12, heavy: 16, full: 16 },
};

const BODY_OFFSET = 0.35;

type SamplePoint = { readonly pos: Vec2; readonly eye: number };

function samplePoints(center: Vec2, bearing: number, stance: Stance): readonly SamplePoint[] {
  const cos = Math.cos(bearing);
  const sin = Math.sin(bearing);
  // Base eye-heights per stance. Torso / shoulder / waist positions shrink
  // proportionally as the unit gets lower — prone silhouette is almost
  // entirely at the low sample.
  const scale =
    stance === 'standing' ? 1.0 : stance === 'crouched' ? 0.65 : 0.25;
  const eyeHead = eyeHeightFor(stance);
  const eyeShoulder = eyeHeightFor(stance) * 0.85;
  const eyeWaist = eyeHeightFor(stance) * 0.65;
  const shoulderOffset = BODY_OFFSET * scale;
  const waistOffset = BODY_OFFSET * 0.2 * scale;
  return [
    { pos: center, eye: eyeHead },
    {
      pos: { x: center.x - sin * shoulderOffset, y: center.y + cos * shoulderOffset },
      eye: eyeShoulder,
    },
    {
      pos: { x: center.x + sin * shoulderOffset, y: center.y - cos * shoulderOffset },
      eye: eyeShoulder,
    },
    {
      pos: { x: center.x + cos * waistOffset, y: center.y + sin * waistOffset },
      eye: eyeWaist,
    },
    {
      pos: { x: center.x - cos * waistOffset, y: center.y - sin * waistOffset },
      eye: eyeWaist,
    },
  ];
}

function stanceAdjust(axes: CoverAxes, stance: Stance): CoverAxes {
  const levels: CoverLevel[] = ['none', 'light', 'heavy', 'full'];
  let idx = levels.indexOf(axes.cover);
  if (stance === 'prone' && axes.heightProfile !== 'flat') idx = Math.min(idx + 1, 3);
  if (stance === 'standing' && axes.heightProfile === 'low') idx = Math.max(idx - 1, 0);
  return { ...axes, cover: levels[idx] };
}

export type CoverEval = {
  readonly score: number;
  readonly losBlocked: boolean;
  readonly losThinned: boolean;
  readonly contributingAxes: CoverAxes | null;
};

// Stance-aware evaluation. Shooter + target stances both feed in so the
// ray samples at the right eye heights and cover upgrades / downgrades
// behave correctly (prone behind low wall = upgrade; standing = downgrade).
export function coverEvalAt(
  world: World,
  shooterPos: Vec2,
  shooterStance: Stance,
  pos: Vec2,
  targetStance: Stance,
): CoverEval {
  const bearing = Math.atan2(shooterPos.y - pos.y, shooterPos.x - pos.x);
  const samples = samplePoints(pos, bearing, targetStance);
  const shooterEye = eyeHeightFor(shooterStance);

  // Elevation-delta silhouette adjustment. High-ground defender presents
  // less silhouette over cover vs a low-ground shooter; scale sample eye
  // heights down. Low-ground defender gets the inverse adjustment naturally
  // from the 3D ray math — no extra factor needed.
  let silhouetteScale = 1.0;
  if (world.elevationStep) {
    const ts = world.tileSizeMeters;
    const sx = Math.floor(shooterPos.x / ts);
    const sy = Math.floor(shooterPos.y / ts);
    const tx = Math.floor(pos.x / ts);
    const ty = Math.floor(pos.y / ts);
    if (inBounds(world, sx, sy) && inBounds(world, tx, ty)) {
      const dElev =
        elevationMeters(world.elevationStep[ty * world.width + tx]) -
        elevationMeters(world.elevationStep[sy * world.width + sx]);
      if (dElev > 0) silhouetteScale = 0.8;
    }
  }

  let score = 0;
  let losBlocked = false;
  let losThinned = false;
  let strongest: CoverAxes | null = null;

  for (const s of samples) {
    const r = castRayAxes(world, shooterPos, shooterEye, s.pos, s.eye * silhouetteScale);
    if (r.result === 'blocked') losBlocked = true;
    if (r.result === 'concealed') losThinned = true;
    if (r.strongest) {
      const adj = stanceAdjust(r.strongest, targetStance);
      const pts = AXIS_TO_POINTS[adj.los][adj.cover];
      score += pts;
      if (!strongest) {
        strongest = adj;
      } else {
        const curPts = AXIS_TO_POINTS[strongest.los][strongest.cover];
        if (pts > curPts) strongest = adj;
      }
    }
  }
  return {
    score: Math.min(score, MAX_COVER_SCORE),
    losBlocked,
    losThinned,
    contributingAxes: strongest,
  };
}

// Legacy Unit-based wrapper — hit.ts and ai/movement.ts call this. Passes
// real shooter + target stances through to coverEvalAt.
export function coverScore(world: World, shooter: Unit, target: Unit): number {
  return coverEvalAt(world, shooter.position, shooter.stance, target.position, target.stance).score;
}

// Position-only variant used by cover-aware pathfinding (candidate move
// scoring without constructing synthetic units). Assumes both parties
// standing — pathfinder uses this for planning, not for shot resolution.
export function coverScoreAt(world: World, shooterPos: Vec2, pos: Vec2): number {
  return coverEvalAt(world, shooterPos, 'standing', pos, 'standing').score;
}
