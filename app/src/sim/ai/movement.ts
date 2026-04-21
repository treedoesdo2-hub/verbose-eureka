import { coverScoreAt, MAX_COVER_SCORE } from '../cover';
import type { Vec2 } from '../unit';
import type { World } from '../world';
import { inBounds, terrainAt } from '../world';

/**
 * NSiR spatial DNA: when threats are visible, the next footstep should
 * prefer cover over beeline. This is a *local* greedy bias, not A*:
 * we sample a few candidate step directions fanned around the bearing
 * to the goal, score each by (remaining distance to goal) minus a cover
 * bonus against visible threats, and pick the best.
 *
 * No threats → beeline (just return the goal).
 * Short hop to goal → no intermediate step needed.
 */
const STEP_DISTANCE_M = 3;
const ANGLE_OFFSETS = [
  0,
  Math.PI / 6,
  -Math.PI / 6,
  Math.PI / 3,
  -Math.PI / 3,
  Math.PI / 2,
  -Math.PI / 2,
];
const COVER_WEIGHT = 0.15;
const PROGRESS_WEIGHT = 0.5;

export function coverAwareStepTarget(
  world: World,
  from: Vec2,
  goal: Vec2,
  threats: readonly Vec2[],
): Vec2 {
  if (threats.length === 0) return goal;
  const dx = goal.x - from.x;
  const dy = goal.y - from.y;
  const distToGoal = Math.hypot(dx, dy);
  if (distToGoal <= STEP_DISTANCE_M) return goal;

  const bearing = Math.atan2(dy, dx);

  let best: Vec2 | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const offset of ANGLE_OFFSETS) {
    const theta = bearing + offset;
    const candidate: Vec2 = {
      x: from.x + Math.cos(theta) * STEP_DISTANCE_M,
      y: from.y + Math.sin(theta) * STEP_DISTANCE_M,
    };
    const tx = Math.floor(candidate.x / world.tileSizeMeters);
    const ty = Math.floor(candidate.y / world.tileSizeMeters);
    if (!inBounds(world, tx, ty) || !terrainAt(world, tx, ty).passable) continue;

    const remaining = Math.hypot(goal.x - candidate.x, goal.y - candidate.y);
    const progress = distToGoal - remaining;

    let coverBonus = 0;
    for (const t of threats) coverBonus += coverScoreAt(world, t, candidate) / MAX_COVER_SCORE;

    const score = remaining - coverBonus * COVER_WEIGHT - progress * PROGRESS_WEIGHT;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best ?? goal;
}
