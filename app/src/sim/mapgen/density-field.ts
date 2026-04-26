// COA-1 density-field scatter — density-driven cover placement.
//
// Phase 1: generateCoverDensity builds a Float32 per-tile field in [0, 1]
// that drives cluster scatter via local-max extraction + weighted sampling.
// Higher density = more likely to anchor a cluster. Biome-specific profiles
// (urban vs rural vs mixed) pick different base frequencies, fertility
// affinities, and elevation gating ranges.
//
// Phase 2 (extractHotspots / scatterClustersDensityDriven) lives in
// density-scatter.ts and consumes the field produced here.

import { fbm2D, hashStringToSeed, type Rng } from './noise';

export type DensityProfile = {
  readonly name: string;
  readonly baseFreq: number; // fBm frequency at referenceSize
  readonly octaves: number;
  // Fertility gating: density is multiplied by smoothstep(fertility, lo, hi).
  // For forests, lo=0.4 hi=0.9 (only fertile tiles anchor groves). For urban
  // density, lo=0.0 hi=0.5 (dry tiles prefer buildings).
  readonly fertilityAffinity: { readonly lo: number; readonly hi: number };
  // Elevation gating: zero out density outside [lo, hi] elevation-norm band.
  // Defaults to [0, 1] (full range) if omitted.
  readonly elevationBand?: { readonly lo: number; readonly hi: number };
  // After field generation, multiply by this constant to tune the number of
  // extracted hotspots without rescaling the whole pipeline.
  readonly densityMultiplier: number;
  // P3.1 — per-biome elevation generation parameters. Pipeline calls
  // generateElevation(profile.elevationGen) BEFORE density+scatter. Nil
  // profile means "use flat default" (0.02 stddev) — empirically too flat
  // per Firefight panel (see elevation_stddev_normalized metric). New
  // profiles:
  //   amplitude: peak-to-trough height in normalized units [0, 1]
  //   frequency: base fBm frequency
  //   octaves: number of octave passes
  //   smoothness: Gaussian blur radius in tiles (0 = no blur, 3 = heavy)
  readonly elevationGen?: {
    readonly amplitude: number;
    readonly frequency: number;
    readonly octaves: number;
    readonly smoothness: number;
  };
};

// Elevation amplitude/frequency/smoothness tuned 2026-04-25 to bring
// contour density in line with Firefight panel exemplars. Empirically:
// each unit of `amplitude` × octaves of unsmoothed noise produces ~30
// step crossings per 1000 tiles. Firefight target is ~10-40 per biome,
// so we want amplitude≤0.4 with smoothness≥3 across the board. Higher
// smoothness (>3) trades silhouette visibility for parity — keep just
// barely enough to see hills in the thumbnail.
export const URBAN_SPARSE_DENSITY: DensityProfile = {
  name: 'urban_sparse',
  baseFreq: 0.02,
  octaves: 4,
  fertilityAffinity: { lo: 0.0, hi: 0.55 },
  elevationBand: { lo: 0.1, hi: 0.9 },
  densityMultiplier: 1.0,
  elevationGen: { amplitude: 0.20, frequency: 0.011, octaves: 3, smoothness: 3 },
};

export const RURAL_OPEN_DENSITY: DensityProfile = {
  name: 'rural_open',
  baseFreq: 0.014,
  octaves: 5,
  fertilityAffinity: { lo: 0.35, hi: 0.95 },
  elevationBand: { lo: 0.05, hi: 0.75 },
  densityMultiplier: 0.9,
  elevationGen: { amplitude: 0.30, frequency: 0.012, octaves: 3, smoothness: 4 },
};

export const MIXED_DENSITY: DensityProfile = {
  name: 'mixed',
  baseFreq: 0.018,
  octaves: 4,
  fertilityAffinity: { lo: 0.2, hi: 0.85 },
  elevationBand: { lo: 0.05, hi: 0.9 },
  densityMultiplier: 1.0,
  elevationGen: { amplitude: 0.35, frequency: 0.014, octaves: 3, smoothness: 4 },
};

// P2.1 — urban_dense: town centers. Higher frequency = more cluster
// anchors per area. Fertility affinity biases toward low-fertility dry
// tiles (buildings prefer flat ground). Elevation band broad to capture
// cities on hills.
export const URBAN_DENSE_DENSITY: DensityProfile = {
  name: 'urban_dense',
  baseFreq: 0.025,
  octaves: 4,
  fertilityAffinity: { lo: 0.0, hi: 0.45 },
  elevationBand: { lo: 0.05, hi: 0.95 },
  densityMultiplier: 1.4,
  elevationGen: { amplitude: 0.10, frequency: 0.010, octaves: 3, smoothness: 4 },
};

// P2.2 — industrial: large footprints spaced further apart than urban_dense.
// Lower frequency (broader clusters) + same low-fertility affinity. Tight
// elevation band — factories don't climb hills.
export const INDUSTRIAL_DENSITY: DensityProfile = {
  name: 'industrial',
  baseFreq: 0.015,
  octaves: 3,
  fertilityAffinity: { lo: 0.0, hi: 0.35 },
  elevationBand: { lo: 0.1, hi: 0.7 },
  densityMultiplier: 1.1,
  elevationGen: { amplitude: 0.15, frequency: 0.012, octaves: 3, smoothness: 4 },
};

// P2.3 — forest: densest scatter we produce. Tree clusters dominate
// mid-fertility tiles. Wide elevation band.
export const FOREST_DENSITY: DensityProfile = {
  name: 'forest',
  baseFreq: 0.022,
  octaves: 5,
  fertilityAffinity: { lo: 0.3, hi: 0.95 },
  elevationBand: { lo: 0.05, hi: 0.85 },
  densityMultiplier: 1.6,
  elevationGen: { amplitude: 0.40, frequency: 0.013, octaves: 3, smoothness: 4 },
};

// P2.4 — rural_village: one village cluster + scattered rural structures.
// Similar to rural_open's fertility shape but with a stronger fBm octave
// pattern for distinct village clumps vs open countryside.
export const RURAL_VILLAGE_DENSITY: DensityProfile = {
  name: 'rural_village',
  baseFreq: 0.017,
  octaves: 5,
  fertilityAffinity: { lo: 0.25, hi: 0.85 },
  elevationBand: { lo: 0.05, hi: 0.8 },
  densityMultiplier: 1.15,
  elevationGen: { amplitude: 0.25, frequency: 0.012, octaves: 3, smoothness: 4 },
};

// P2.5 — arid: mostly empty desert with sparse anchors. Extremely low
// multiplier keeps the map legible as "emptiness with punctuation". Wide
// fertility band because arid fertility noise is itself subdued.
export const ARID_DENSITY: DensityProfile = {
  name: 'arid',
  baseFreq: 0.012,
  octaves: 3,
  fertilityAffinity: { lo: 0.0, hi: 0.7 },
  elevationBand: { lo: 0.05, hi: 0.9 },
  // Still low (arid is meant to read barren) but enough to satisfy the
  // ≥3-hotspot minimum so scatter anchors survive.
  densityMultiplier: 0.85,
  // Arid maps often have big dune systems — moderate amplitude with very
  // low frequency for sweeping broad hills, not ridgey chop.
  elevationGen: { amplitude: 0.40, frequency: 0.008, octaves: 3, smoothness: 3 },
};

export const DENSITY_PROFILES: Record<string, DensityProfile> = {
  urban_sparse: URBAN_SPARSE_DENSITY,
  urban_dense: URBAN_DENSE_DENSITY,
  industrial: INDUSTRIAL_DENSITY,
  forest: FOREST_DENSITY,
  rural_village: RURAL_VILLAGE_DENSITY,
  rural_open: RURAL_OPEN_DENSITY,
  arid: ARID_DENSITY,
  mixed: MIXED_DENSITY,
};

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Build a per-tile Float32 density field clamped to [0, 1]. Deterministic
 * given the same (seed, width, height, profile) triple.
 *
 * @param profile the biome-specific DensityProfile (defines frequency,
 *   octaves, fertility + elevation gating).
 * @param width / height the map dimensions in tiles.
 * @param elevationNorm per-tile fBm-derived elevation in [0, 1].
 * @param fertility per-tile fertility in [0, 1].
 * @param seed RNG seed; must be stable per map for determinism.
 */
export function generateCoverDensity(
  profile: DensityProfile,
  width: number,
  height: number,
  elevationNorm: Float32Array,
  fertility: Float32Array,
  seed: number,
): Float32Array {
  const N = width * height;
  if (elevationNorm.length !== N || fertility.length !== N) {
    throw new Error(
      `generateCoverDensity: expected ${N} elements, got elev=${elevationNorm.length} fert=${fertility.length}`,
    );
  }
  const out = new Float32Array(N);
  const subSeed = seed ^ hashStringToSeed(`density:${profile.name}`);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  // Raw fBm pass.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const v = fbm2D(x, y, profile.baseFreq, profile.octaves, subSeed, width);
      out[i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min || 1;

  const fLo = profile.fertilityAffinity.lo;
  const fHi = profile.fertilityAffinity.hi;
  const eLo = profile.elevationBand?.lo ?? 0;
  const eHi = profile.elevationBand?.hi ?? 1;

  for (let i = 0; i < N; i++) {
    const norm = (out[i] - min) / range;
    const fGate = smoothstep(fLo, fHi, fertility[i]);
    const eNorm = elevationNorm[i];
    const eGate = eNorm < eLo || eNorm > eHi ? 0 : 1;
    const gated = norm * fGate * eGate * profile.densityMultiplier;
    out[i] = gated < 0 ? 0 : gated > 1 ? 1 : gated;
  }

  return out;
}

// Helper exposed for density-scatter.ts — sums density * tileArea for a
// scatter pass to know how many clusters to attempt.
export function totalDensity(field: Float32Array): number {
  let s = 0;
  for (let i = 0; i < field.length; i++) s += field[i];
  return s;
}

// Lint appeasement — Rng is re-exported for density-scatter.ts callers
// who construct sub-RNGs keyed on the density pass.
export type { Rng };
