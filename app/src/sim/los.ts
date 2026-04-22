import type { Vec2 } from './unit';
import {
  type CoverAxes,
  BASE_AXES,
  elevationMeters,
  inBounds,
  terrainAxesDirectional,
  type World,
} from './world';

export type LosResult = 'visible' | 'concealed' | 'blocked';

const EYE_HEIGHT_STANDING = 1.7;
const EYE_HEIGHT_CROUCHED = 1.1;
const EYE_HEIGHT_PRONE = 0.3;
export type Stance = 'standing' | 'crouched' | 'prone';

export function eyeHeightFor(stance: Stance): number {
  switch (stance) {
    case 'standing':
      return EYE_HEIGHT_STANDING;
    case 'crouched':
      return EYE_HEIGHT_CROUCHED;
    case 'prone':
      return EYE_HEIGHT_PRONE;
  }
}

const SAMPLE_STEP_METERS = 0.5;

// Thin-LOS accumulator — each sample through `thin` terrain adds this much
// opacity; once the running total reaches 1.0 the ray is treated as blocked.
// A single tile of forest thins but doesn't block; crossing ~6–8 tiles of
// dense jungle accumulates to a full block.
const THIN_OPACITY_PER_SAMPLE = 0.18;

// Smoke occluders (COA-2). Smoke contributes extra thin-LOS opacity wherever
// the ray passes within the volume's radius and below its opacity-top height.
export type SmokeVolume = {
  readonly x: number; // meters
  readonly y: number;
  readonly radius: number; // meters
  readonly opacityTop: number; // above-ground meters where smoke still thins
  readonly opacityPerMeter: number; // opacity added per meter traversed through the volume
};

export type CastRayOptions = {
  readonly smoke?: readonly SmokeVolume[];
};

export type CastRayAxesResult = {
  readonly result: LosResult;
  readonly strongest: CoverAxes | null;
};

// Eye-height variant — used by cover.ts to fire sample rays at arbitrary
// silhouette points. `fromEye`/`toEye` are measured from each endpoint's
// ground-level elevation (i.e., stand height, not absolute altitude).
export function castRay(
  world: World,
  from: Vec2,
  fromEye: number,
  to: Vec2,
  toEye: number,
  opts: CastRayOptions = {},
): LosResult {
  return castRayAxes(world, from, fromEye, to, toEye, opts).result;
}

// Stance-driven variant — vision.ts / AI detection path.
export function castRayStance(
  world: World,
  from: Vec2,
  fromStance: Stance,
  to: Vec2,
  toStance: Stance,
  opts: CastRayOptions = {},
): LosResult {
  return castRay(world, from, eyeHeightFor(fromStance), to, eyeHeightFor(toStance), opts);
}

// Axes-aware cast — returns both result and the strongest cover contributor
// encountered along the ray. cover.ts uses this to bias per-sample scoring.
export function castRayAxes(
  world: World,
  from: Vec2,
  fromEye: number,
  to: Vec2,
  toEye: number,
  opts: CastRayOptions = {},
): CastRayAxesResult {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { result: 'visible', strongest: null };

  const ts = world.tileSizeMeters;
  const fx = Math.floor(from.x / ts);
  const fy = Math.floor(from.y / ts);
  const tx = Math.floor(to.x / ts);
  const ty = Math.floor(to.y / ts);

  const fromGround = inBounds(world, fx, fy)
    ? elevationMeters(world.elevationStep[fy * world.width + fx])
    : 0;
  const toGround = inBounds(world, tx, ty)
    ? elevationMeters(world.elevationStep[ty * world.width + tx])
    : 0;

  const zFrom = fromGround + fromEye;
  const zTo = toGround + toEye;

  // Bearing points from target → shooter (incoming direction), which is
  // what edge-directional cover reads expect.
  const incomingBearing = Math.atan2(from.y - to.y, from.x - to.x);

  const steps = Math.max(1, Math.ceil(dist / SAMPLE_STEP_METERS));
  const stepMeters = dist / steps;
  let result: LosResult = 'visible';
  let thinAccum = 0;
  let strongest: CoverAxes | null = null;

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = from.x + dx * t;
    const py = from.y + dy * t;
    const ix = Math.floor(px / ts);
    const iy = Math.floor(py / ts);
    if (!inBounds(world, ix, iy)) return { result: 'blocked', strongest };

    const idx = iy * world.width + ix;
    const cellGround = elevationMeters(world.elevationStep[idx]);
    const cellStructure = world.structureHeight[idx]; // meters
    const axes = terrainAxesDirectional(world, ix, iy, incomingBearing);
    const zRay = zFrom + (zTo - zFrom) * t;

    // Track the strongest cover axes for sample-ray scoring.
    strongest = strongerAxes(strongest, axes);

    // Per-tile occluder top = ground + max(axes height, structure height).
    // structureHeight overrides the kind-default when present (per-building
    // floor count rather than the family-average).
    const occluderTop = cellGround + Math.max(axes.heightMeters, cellStructure);

    if (axes.los === 'full' && zRay <= occluderTop) {
      return { result: 'blocked', strongest };
    }

    if (axes.los === 'thin' && zRay <= occluderTop) {
      thinAccum += THIN_OPACITY_PER_SAMPLE;
      if (thinAccum >= 1.0) return { result: 'blocked', strongest };
      if (result === 'visible') result = 'concealed';
    }

    // Smoke contribution — per-sample opacity. Accumulates the same way as
    // thin-LOS terrain; a dense smoke volume blocks after enough traversal.
    if (opts.smoke && opts.smoke.length > 0) {
      for (const s of opts.smoke) {
        const sdx = px - s.x;
        const sdy = py - s.y;
        if (sdx * sdx + sdy * sdy > s.radius * s.radius) continue;
        if (zRay > cellGround + s.opacityTop) continue;
        thinAccum += s.opacityPerMeter * stepMeters;
        if (thinAccum >= 1.0) return { result: 'blocked', strongest };
        if (result === 'visible') result = 'concealed';
      }
    }
  }

  return { result, strongest };
}

function strongerAxes(a: CoverAxes | null, b: CoverAxes): CoverAxes {
  if (!a) return b;
  const rankLos = (x: CoverAxes['los']): number => (x === 'full' ? 2 : x === 'thin' ? 1 : 0);
  const rankCover = (x: CoverAxes['cover']): number =>
    x === 'full' ? 3 : x === 'heavy' ? 2 : x === 'light' ? 1 : 0;
  const aScore = rankLos(a.los) * 10 + rankCover(a.cover);
  const bScore = rankLos(b.los) * 10 + rankCover(b.cover);
  return bScore > aScore ? b : a;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angleBetween(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function normalizeAngle(a: number): number {
  const two = Math.PI * 2;
  const n = a % two;
  return n < 0 ? n + two : n;
}

export function angularOffset(facing: number, targetAngle: number): number {
  const diff = normalizeAngle(targetAngle - facing);
  return diff > Math.PI ? Math.PI * 2 - diff : diff;
}

// Lint appeasement — BASE_AXES is re-exported for use-sites that want a
// default axis value when out of bounds; keep the import live.
void BASE_AXES;
