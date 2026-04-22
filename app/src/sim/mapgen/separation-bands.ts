// COA-5 task #96 — separation bands between team deploy zones.
//
// Firefight's authored maps consistently space spawn blocks at roughly
// 40% of the map diagonal. With a standard Firefight cell being ~24 px,
// that's typically 40-60 tiles across medium maps. We reproduce the
// scaling here: target and minimum separation both derive from the
// map's diagonal. Callers use these thresholds to:
//  - Reject spawn candidate pairs that are closer than minimumSeparation
//  - Score candidate pairs by how close to targetSeparation they sit
//  - Widen separation on 'meeting' regimes, compress it on 'storming'

import type { SpawnRegime } from './types';

export type SeparationBands = {
  readonly minimumSeparation: number; // meters — hard floor
  readonly targetSeparation: number; // meters — scoring bullseye
  readonly maximumSeparation: number; // meters — upper soft bound
};

// Firefight's reference band fractions (expressed as fraction of map
// diagonal in meters). Derived by measuring the ASTM, GECE, and Maple
// Grove maps and averaging pairwise deploy-block centroid distances.
const REGIME_BANDS: Record<SpawnRegime, { min: number; target: number; max: number }> = {
  meeting: { min: 0.35, target: 0.4, max: 0.55 },
  assault: { min: 0.3, target: 0.38, max: 0.5 },
  defence: { min: 0.35, target: 0.42, max: 0.55 },
  storming: { min: 0.2, target: 0.28, max: 0.4 },
  custom: { min: 0.3, target: 0.4, max: 0.55 },
};

export function separationBandsFor(
  regime: SpawnRegime,
  mapWidthTiles: number,
  mapHeightTiles: number,
  tileSizeMeters: number,
): SeparationBands {
  const bands = REGIME_BANDS[regime];
  const diagonalMeters = Math.hypot(mapWidthTiles, mapHeightTiles) * tileSizeMeters;
  return {
    minimumSeparation: bands.min * diagonalMeters,
    targetSeparation: bands.target * diagonalMeters,
    maximumSeparation: bands.max * diagonalMeters,
  };
}

// Score a candidate pair of deploy-zone centroids against the bands.
// Returns 0-1 where 1 = bullseye at target, 0 = outside [min, max]. Used
// by the spawn placer's candidate scoring phase.
export function separationScore(
  distanceMeters: number,
  bands: SeparationBands,
): number {
  if (distanceMeters < bands.minimumSeparation) return 0;
  if (distanceMeters > bands.maximumSeparation) return 0;
  const spread = bands.maximumSeparation - bands.minimumSeparation;
  const delta = Math.abs(distanceMeters - bands.targetSeparation);
  return Math.max(0, 1 - delta / (spread * 0.5));
}

// True if two deploy-zone centroids respect the minimum-separation band.
export function respectsMinimumSeparation(
  a: { x: number; y: number },
  b: { x: number; y: number },
  tileSizeMeters: number,
  bands: SeparationBands,
): boolean {
  const dx = (b.x - a.x) * tileSizeMeters;
  const dy = (b.y - a.y) * tileSizeMeters;
  return Math.hypot(dx, dy) >= bands.minimumSeparation;
}
