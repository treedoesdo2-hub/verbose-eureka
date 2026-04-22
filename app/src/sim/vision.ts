import type { LosResult } from './los';
import {
  angleBetween,
  angularOffset,
  castRayStance,
  distance,
} from './los';
import type { Unit } from './unit';
import type { World } from './world';
import { elevationMeters, inBounds } from './world';

export const CONE_HALF_ANGLE_RAD = (20 * Math.PI) / 180;
export const PERIPHERAL_RANGE_METERS = 80;
export const FOCUSED_RANGE_METERS = 250;
export const ALERTED_RANGE_METERS = 200;

// High-ground observers see farther. Per meter of elevation advantage over
// the target, the focused range grows by this factor. Capped at +50%.
const ELEVATION_RANGE_BONUS_PER_METER = 0.05;
const ELEVATION_RANGE_BONUS_CAP = 0.5;

export type VisionTier = 'focused' | 'peripheral' | 'alerted' | 'none';

export type SightCheck = {
  tier: VisionTier;
  los: LosResult;
  distance: number;
  detected: boolean;
};

function observerElevationMeters(world: World, u: Unit): number {
  const ts = world.tileSizeMeters;
  const x = Math.floor(u.position.x / ts);
  const y = Math.floor(u.position.y / ts);
  if (!inBounds(world, x, y)) return 0;
  return elevationMeters(world.elevationStep[y * world.width + x]);
}

function elevationFocusedRange(observer: Unit, target: Unit, world: World): number {
  const dElev = observerElevationMeters(world, observer) - observerElevationMeters(world, target);
  if (dElev <= 0) return FOCUSED_RANGE_METERS;
  const bonus = Math.min(dElev * ELEVATION_RANGE_BONUS_PER_METER, ELEVATION_RANGE_BONUS_CAP);
  return FOCUSED_RANGE_METERS * (1 + bonus);
}

export function checkSight(world: World, observer: Unit, target: Unit): SightCheck {
  const dist = distance(observer.position, target.position);
  const bearing = angleBetween(observer.position, target.position);
  const offset = angularOffset(observer.facing, bearing);

  // Stance flows through from the unit itself (was a stubbed 'standing').
  const los = castRayStance(world, observer.position, observer.stance, target.position, target.stance);

  if (los === 'blocked') {
    return { tier: 'none', los, distance: dist, detected: false };
  }

  if (observer.alerted) {
    if (dist <= ALERTED_RANGE_METERS) {
      return { tier: 'alerted', los, distance: dist, detected: los !== 'concealed' || dist < 40 };
    }
  }

  const focusedRange = elevationFocusedRange(observer, target, world);
  if (offset <= CONE_HALF_ANGLE_RAD && dist <= focusedRange) {
    const detected = los === 'visible' || dist < 60;
    return { tier: 'focused', los, distance: dist, detected };
  }

  if (dist <= PERIPHERAL_RANGE_METERS) {
    const detected = los === 'visible' && dist < 60;
    return { tier: 'peripheral', los, distance: dist, detected };
  }

  return { tier: 'none', los, distance: dist, detected: false };
}

export function canSee(world: World, observer: Unit, target: Unit): boolean {
  return checkSight(world, observer, target).detected;
}
