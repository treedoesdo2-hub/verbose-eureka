import type { Ballistics } from '@schema/weapon';

export function kineticEnergyJoules(b: Ballistics): number {
  const massKg = b.massGrams / 1000;
  return 0.5 * massKg * b.velocityMps * b.velocityMps;
}

export function rangeFalloff(b: Ballistics, distanceMeters: number): number {
  const ke = kineticEnergyJoules(b);
  const dropFactor = Math.exp(-distanceMeters / 600);
  return ke * dropFactor;
}

export function effectivePenetration(b: Ballistics, distanceMeters: number): number {
  const atMuzzle = b.penetration;
  const dropFactor = Math.exp(-distanceMeters / 500);
  return atMuzzle * dropFactor;
}
