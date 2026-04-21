import type { LosResult, Stance } from './los';
import { angleBetween, angularOffset, castRay, distance, eyeHeightFor } from './los';
import type { Unit } from './unit';
import type { World } from './world';

export const CONE_HALF_ANGLE_RAD = (20 * Math.PI) / 180;
export const PERIPHERAL_RANGE_METERS = 80;
export const FOCUSED_RANGE_METERS = 250;
export const ALERTED_RANGE_METERS = 200;

export type VisionTier = 'focused' | 'peripheral' | 'alerted' | 'none';

export type SightCheck = {
  tier: VisionTier;
  los: LosResult;
  distance: number;
  detected: boolean;
};

function stanceOf(_unit: Unit): Stance {
  return 'standing';
}

export function checkSight(world: World, observer: Unit, target: Unit): SightCheck {
  const dist = distance(observer.position, target.position);
  const bearing = angleBetween(observer.position, target.position);
  const offset = angularOffset(observer.facing, bearing);

  const observerEye = eyeHeightFor(stanceOf(observer));
  const targetEye = eyeHeightFor(stanceOf(target)) * 0.6;
  const los = castRay(world, observer.position, observerEye, target.position, targetEye);

  if (los === 'blocked') {
    return { tier: 'none', los, distance: dist, detected: false };
  }

  if (observer.alerted) {
    if (dist <= ALERTED_RANGE_METERS) {
      return { tier: 'alerted', los, distance: dist, detected: los !== 'concealed' || dist < 40 };
    }
  }

  if (offset <= CONE_HALF_ANGLE_RAD && dist <= FOCUSED_RANGE_METERS) {
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
