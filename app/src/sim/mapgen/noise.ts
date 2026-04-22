// Deterministic seeded 2D value noise.
//
// Full simplex/Perlin is overkill for MVP. Value noise with bicubic-ish
// smoothing produces serviceable terrain patterns and is easy to verify
// for determinism. Frequency is normalized to a reference map size so the
// same seed produces visually consistent patterns across map scales.

export type Rng = () => number;

// xorshift32 — deterministic, fast, no globals.
export function makeRng(seed: number): Rng {
  let s = seed | 0;
  if (s === 0) s = 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 0x100000000) / 0x100000000;
  };
}

// FNV-1a for turning (seedString, key) into a 32-bit seed.
export function hashStringToSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hashCombine(seed: number, part: number): number {
  let h = seed ^ (part | 0);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function subRng(seed: number, stepKey: string): Rng {
  return makeRng(hashCombine(seed, hashStringToSeed(stepKey)));
}

// Hash-based gradient per integer cell — deterministic, no lookup table.
function cellHash(ix: number, iy: number, seed: number): number {
  let h = seed ^ Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

// Single-octave 2D value noise at (x,y) sampled at the given frequency.
// Returns a number in [0, 1].
export function valueNoise2D(x: number, y: number, freq: number, seed: number): number {
  const fx = x * freq;
  const fy = y * freq;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = smoothstep(fx - ix);
  const ty = smoothstep(fy - iy);
  const v00 = cellHash(ix, iy, seed);
  const v10 = cellHash(ix + 1, iy, seed);
  const v01 = cellHash(ix, iy + 1, seed);
  const v11 = cellHash(ix + 1, iy + 1, seed);
  const a = v00 + (v10 - v00) * tx;
  const b = v01 + (v11 - v01) * tx;
  return a + (b - a) * ty;
}

// Fractal noise (fBm) — several octaves summed with decaying amplitude.
// Frequency is normalized against `referenceSize` so a given `baseFreq` is
// scale-invariant: the same visual pattern at different map sizes.
export function fbm2D(
  x: number,
  y: number,
  baseFreq: number,
  octaves: number,
  seed: number,
  mapSize: number,
  referenceSize: number = 256,
): number {
  const scaledFreq = baseFreq * (referenceSize / mapSize);
  let sum = 0;
  let amp = 1;
  let ampSum = 0;
  let freq = scaledFreq;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2D(x, y, freq, hashCombine(seed, o));
    ampSum += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / ampSum;
}
