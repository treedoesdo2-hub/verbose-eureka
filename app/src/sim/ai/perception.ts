import type { UnitId } from '@shared/ids';
import type { Unit } from '../unit';
import { canFight, isAlive } from '../unit';
import { checkSight } from '../vision';
import type { World } from '../world';

export type PerceptionResult = {
  readonly observerId: UnitId;
  readonly spotted: readonly UnitId[];
  readonly bestTarget: UnitId | null;
};

export function perceive(
  world: World,
  observer: Unit,
  allUnits: ReadonlyMap<UnitId, Unit>,
): PerceptionResult {
  if (!canFight(observer)) {
    return { observerId: observer.id, spotted: [], bestTarget: null };
  }

  const spotted: UnitId[] = [];
  let bestTarget: UnitId | null = null;
  let bestScore = -Infinity;

  for (const other of allUnits.values()) {
    if (other.teamId === observer.teamId) continue;
    if (!isAlive(other)) continue;
    const s = checkSight(world, observer, other);
    if (!s.detected) continue;
    spotted.push(other.id);

    const proximity = 1 / (1 + s.distance * 0.01);
    const tierMult = s.tier === 'focused' ? 1.0 : s.tier === 'alerted' ? 0.8 : 0.5;
    const exposurePenalty = s.los === 'concealed' ? 0.6 : 1.0;
    const score = proximity * tierMult * exposurePenalty;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = other.id;
    }
  }

  return { observerId: observer.id, spotted, bestTarget };
}
