import type { BodyZone } from '@schema/common';
import type { SnapshotMissReason, SnapshotStance } from '@shared/snapshot';
import {
  BLOOD_BRIGHT,
  BLOOD_DARK,
  DUST_DARK,
  DUST_LIGHT,
  WOUND_ICON_CRITICAL,
  WOUND_ICON_GRAZE,
  WOUND_ICON_LIGHT,
  WOUND_ICON_SERIOUS,
} from './fx-palette';

export type Direction = {
  readonly nx: number;
  readonly ny: number;
  readonly len: number;
  readonly angle: number;
};

export function direction(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { nx: 0, ny: 0, len: 0, angle: 0 };
  return { nx: dx / len, ny: dy / len, len, angle: Math.atan2(dy, dx) };
}

export function perp(nx: number, ny: number): { px: number; py: number } {
  return { px: -ny, py: nx };
}

export type StanceFootprint = {
  readonly scale: number;
  readonly squash: number;
  readonly bodyLength: number;
  readonly shoulderWidth: number;
};

export function stanceFootprint(stance: SnapshotStance): StanceFootprint {
  if (stance === 'prone') {
    return { scale: 1.35, squash: 0.55, bodyLength: 2.6, shoulderWidth: 1.2 };
  }
  if (stance === 'crouched') {
    return { scale: 0.9, squash: 0.85, bodyLength: 1.5, shoulderWidth: 1.6 };
  }
  return { scale: 1.0, squash: 1.0, bodyLength: 1.8, shoulderWidth: 2.0 };
}

export function muzzleOffset(
  unit: {
    readonly x: number;
    readonly y: number;
    readonly facing: number;
    readonly stance: SnapshotStance;
    readonly actionKind: string;
  },
  baseRadius: number,
): { x: number; y: number } {
  const foot = stanceFootprint(unit.stance);
  // Prone units extend along their facing; crouched pulled in tighter.
  const reach = baseRadius * 2.2 * foot.scale * (unit.stance === 'crouched' ? 0.85 : 1.0);
  return {
    x: unit.x + Math.cos(unit.facing) * reach,
    y: unit.y + Math.sin(unit.facing) * reach,
  };
}

// splitmix32-like deterministic hash; avoids Math.random in render code.
function hash32(tick: number, a: number, b: number, index: number): number {
  let x = (tick | 0) ^ Math.imul(a | 0, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (b | 0), 0x735a2d97);
  x = Math.imul(x ^ (index | 0), 0x27d4eb2f);
  x ^= x >>> 15;
  return x >>> 0;
}

export function jitter(seed: { tick: number; a: number; b: number }, index: number): number {
  const h = hash32(seed.tick, seed.a, seed.b, index);
  // Map to [-1, 1).
  return h / 0x80000000 - 1;
}

export function pickMissColor(reason: SnapshotMissReason | null): number {
  if (reason === 'cover') return 0x8a7050; // tan — dust off cover
  if (reason === 'range') return 0x708090; // cold gray-blue — distant
  return 0x9a9a9a; // accuracy default — concrete gray
}

export type WoundPalette = {
  readonly primary: number;
  readonly secondary: number;
  readonly weight: number;
};

export function woundPaletteForZone(zone: BodyZone | null): WoundPalette {
  if (zone === 'head' || zone === 'torso_front' || zone === 'torso_back') {
    return { primary: BLOOD_BRIGHT, secondary: BLOOD_DARK, weight: 1.3 };
  }
  if (zone === null) {
    return { primary: BLOOD_BRIGHT, secondary: BLOOD_DARK, weight: 1.0 };
  }
  // Limbs — lighter weight, smaller pool.
  return { primary: BLOOD_BRIGHT, secondary: BLOOD_DARK, weight: 0.8 };
}

export function missDustColors(reason: SnapshotMissReason | null): {
  light: number;
  dark: number;
} {
  const base = pickMissColor(reason);
  // Blend base with the generic dust palette for tonal variety.
  if (reason === 'cover') return { light: DUST_LIGHT, dark: base };
  if (reason === 'range') return { light: base, dark: DUST_DARK };
  return { light: DUST_LIGHT, dark: DUST_DARK };
}

export function isBleeding(
  wounds: readonly { readonly treatment: string; readonly bleedRate: number }[],
): boolean {
  for (const w of wounds) {
    if (w.treatment === 'stabilized' || w.treatment === 'tourniquet') continue;
    if (w.bleedRate > 0) return true;
  }
  return false;
}

export function woundIconColor(severity: string): number {
  if (severity === 'critical') return WOUND_ICON_CRITICAL;
  if (severity === 'serious') return WOUND_ICON_SERIOUS;
  if (severity === 'light') return WOUND_ICON_LIGHT;
  return WOUND_ICON_GRAZE;
}

export function casingArcEnd(
  origin: { readonly x: number; readonly y: number },
  facing: number,
  seed: { tick: number; a: number; b: number },
): { x: number; y: number; peakY: number } {
  const cos = Math.cos(facing);
  const sin = Math.sin(facing);
  const { px, py } = perp(cos, sin);
  const j = jitter(seed, 7);
  const lateral = 0.7 + Math.abs(j) * 0.3;
  const forward = 0.15 + Math.abs(j) * 0.25;
  return {
    x: origin.x + px * lateral + cos * forward,
    y: origin.y + py * lateral + sin * forward,
    peakY: 0.4 + Math.abs(jitter(seed, 8)) * 0.2,
  };
}
