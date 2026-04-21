import type { Vec2 } from './unit';
import type { World } from './world';
import { inBounds, terrainAt } from './world';

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

export function castRay(
  world: World,
  from: Vec2,
  fromEye: number,
  to: Vec2,
  toEye: number,
): LosResult {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return 'visible';
  const steps = Math.max(1, Math.ceil(dist / SAMPLE_STEP_METERS));
  const ux = dx / dist;
  const uy = dy / dist;

  const fromTile = {
    x: Math.floor(from.x / world.tileSizeMeters),
    y: Math.floor(from.y / world.tileSizeMeters),
  };
  const baseEye =
    (inBounds(world, fromTile.x, fromTile.y)
      ? world.groundHeight[fromTile.y * world.width + fromTile.x]
      : 0) + fromEye;

  let result: LosResult = 'visible';
  for (let i = 1; i < steps; i++) {
    const t = (i / steps) * dist;
    const px = from.x + ux * t;
    const py = from.y + uy * t;
    const tx = Math.floor(px / world.tileSizeMeters);
    const ty = Math.floor(py / world.tileSizeMeters);
    if (!inBounds(world, tx, ty)) return 'blocked';

    const ground = world.groundHeight[ty * world.width + tx];
    const terrain = terrainAt(world, tx, ty);
    const rayHeight = baseEye + ((toEye - fromEye) * t) / dist;
    const occlusionTop = ground + terrain.fullOcclusionHeight;
    const concealmentTop = ground + terrain.concealmentHeight;

    if (rayHeight <= occlusionTop) return 'blocked';
    if (result === 'visible' && rayHeight <= concealmentTop) result = 'concealed';
  }
  return result;
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
