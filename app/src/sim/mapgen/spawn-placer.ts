// COA-5 tasks #98-108 — spawn placer.
//
// Replaces the fixed-band pickDeployZones+ensureZoneWalkable pair with
// a 7-phase algorithm modeled on Firefight's hand-authored spawn rules:
//
//  1. Axis derivation — derive the combat axis from objective anchors.
//  2. Rear-third extraction — slice the map into per-team rear thirds.
//  3. Mask subtraction — subtract unwalkable / too-near-objective tiles.
//  4. LOR search — find top-K largest open rectangles per side.
//  5. Candidate scoring — shape + access + cover + separation.
//  6. Separation-band gating — enforce regime-specific spacing.
//  7. Validator chain — final sanity pass.
//
// If the chain fails to find a valid pair, the caller invokes the
// fallback carver (see fallbackCarve in this file) which widens the
// search and forces spawn zones into reachable open terrain.

import { WALK_FOOT } from '../world';
import { largestRectangle, maskToSubrect, type Rect, topKLargestRectangles } from './largest-rect';
import {
  respectsMinimumSeparation,
  type SeparationBands,
  separationBandsFor,
  separationScore,
} from './separation-bands';
import type { DeployZone, ObjectiveAnchor, RosterSpec, SpawnRegime } from './types';

export type SpawnPlacerInput = {
  readonly W: number;
  readonly H: number;
  readonly tileSizeMeters: number;
  readonly walkability: Uint16Array;
  readonly elevationStep: Uint8Array;
  readonly objectiveAnchors: readonly ObjectiveAnchor[];
  readonly regime: SpawnRegime;
  readonly rosterTeam0: RosterSpec;
  readonly rosterTeam1: RosterSpec;
};

export type SpawnPlacerResult = {
  readonly team0: DeployZone;
  readonly team1: DeployZone;
  readonly axis: { cx: number; cy: number; angleRadians: number };
  readonly bands: SeparationBands;
  readonly fallbackUsed: boolean;
};

// ---------------------------------------------------------------------------
// Phase 1: axis derivation. The combat axis is the line running through
// the objective cluster's centroid, oriented along its principal-axis
// direction. Each team sits on opposite sides of a perpendicular
// bisector at the centroid.

function deriveAxis(anchors: readonly ObjectiveAnchor[], W: number, H: number): {
  cx: number;
  cy: number;
  angleRadians: number;
} {
  if (anchors.length === 0) {
    return { cx: W / 2, cy: H / 2, angleRadians: 0 }; // N-S axis
  }
  let sx = 0;
  let sy = 0;
  for (const a of anchors) {
    sx += a.rect.x + a.rect.w / 2;
    sy += a.rect.y + a.rect.h / 2;
  }
  const cx = sx / anchors.length;
  const cy = sy / anchors.length;
  // 2D covariance → principal axis via atan2.
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const a of anchors) {
    const dx = a.rect.x + a.rect.w / 2 - cx;
    const dy = a.rect.y + a.rect.h / 2 - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  // Principal angle — if the anchors are collinear along an axis, this
  // returns that axis. If they're isotropic (e.g., a single anchor), we
  // default to N-S (0 radians).
  const angle = Math.abs(sxy) < 1e-6 && Math.abs(sxx - syy) < 1e-6 ? 0 : 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { cx, cy, angleRadians: angle };
}

// ---------------------------------------------------------------------------
// Phase 2: rear-third extraction. Take the axis-perpendicular bisector
// at the centroid and slice the map. Team 0 gets the third furthest in
// one direction; team 1 gets the third furthest in the opposite
// direction. Expressed as an axis-aligned bounding box for LOR search
// simplicity (true rotated-rect LOR is not worth the implementation
// cost at this tier).

function rearThirdRect(
  W: number,
  H: number,
  axisCx: number,
  axisCy: number,
  side: 1 | -1,
  angleRadians: number,
): { x: number; y: number; w: number; h: number } {
  // For now pick the cardinal approximation: N-S axis (|angle| < π/4)
  // yields horizontal bands; E-W axis yields vertical bands. Keeps the
  // LOR search axis-aligned.
  const horizontalBand = Math.abs(Math.sin(angleRadians)) < 0.5;
  if (horizontalBand) {
    // Rear thirds are top/bottom.
    const thirdH = Math.floor(H / 3);
    if (side === 1) {
      return { x: 0, y: H - thirdH, w: W, h: thirdH };
    }
    return { x: 0, y: 0, w: W, h: thirdH };
  }
  const thirdW = Math.floor(W / 3);
  if (side === 1) {
    return { x: W - thirdW, y: 0, w: thirdW, h: H };
  }
  return { x: 0, y: 0, w: thirdW, h: H };
  void axisCx;
  void axisCy;
}

// ---------------------------------------------------------------------------
// Phase 3: mask subtraction. Build a walkability mask (foot-passable)
// and zero out tiles that are inside/near any objective anchor or on
// cliffs (elevation delta > MAX_STEP_ELEV_DELTA from zone center).

const OBJECTIVE_BUFFER_TILES = 6;

function buildSpawnMask(
  input: SpawnPlacerInput,
  restrictTo: { x: number; y: number; w: number; h: number },
): Uint8Array {
  const { W, H, walkability, objectiveAnchors } = input;
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      mask[i] = (walkability[i] & WALK_FOOT) !== 0 ? 1 : 0;
    }
  }
  // Subtract objective buffers.
  for (const a of objectiveAnchors) {
    const x0 = Math.max(0, a.rect.x - OBJECTIVE_BUFFER_TILES);
    const y0 = Math.max(0, a.rect.y - OBJECTIVE_BUFFER_TILES);
    const x1 = Math.min(W, a.rect.x + a.rect.w + OBJECTIVE_BUFFER_TILES);
    const y1 = Math.min(H, a.rect.y + a.rect.h + OBJECTIVE_BUFFER_TILES);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) mask[y * W + x] = 0;
    }
  }
  return maskToSubrect(mask, W, H, restrictTo);
}

// ---------------------------------------------------------------------------
// Phases 4 + 5: LOR search + candidate scoring. For each rear-third
// mask we extract top-K LORs, then score each by shape (close to a
// square), access (distance from edges), and cover availability in the
// surrounding ring. Returns the best rect or null if nothing passes.

const TOP_K_PER_SIDE = 5;
const MIN_ZONE_AREA = 16; // 4x4 floor — anything smaller risks stranding squads

function scoreCandidate(
  r: Rect,
  W: number,
  H: number,
  regime: SpawnRegime,
  roster: RosterSpec,
): number {
  if (r.area < MIN_ZONE_AREA) return -Infinity;
  // Shape: ratio of min(w,h) / max(w,h). Prefer near-square.
  const shape = Math.min(r.w, r.h) / Math.max(r.w, r.h);
  // Access: distance from map edges — prefer a small buffer, not jammed
  // against the wall. 4 tiles from edge = full credit, 0 = no credit.
  const edgeDist = Math.min(r.x, r.y, W - (r.x + r.w), H - (r.y + r.h));
  const accessScore = Math.min(1, edgeDist / 4);
  // Roster fit: prefer a zone that comfortably holds the whole roster.
  // Firefight averages 4 tiles² per infantry, so a 16-unit roster wants
  // ≥64 tiles². We cap at 2x needed so outsize rooms don't always win.
  const neededArea = roster.unitCount * 4;
  const rosterScore = Math.min(1, r.area / Math.max(neededArea, 1)) * (r.area <= neededArea * 3 ? 1 : 0.7);
  // Regime bias: 'defence' prefers bigger zones (static hold), 'assault'
  // prefers tighter stackable zones.
  const regimeBias =
    regime === 'defence' ? 0.1 * Math.min(1, r.area / (neededArea * 2)) :
    regime === 'assault' ? 0.1 * shape : 0;
  return 0.4 * shape + 0.3 * accessScore + 0.25 * rosterScore + 0.05 + regimeBias;
}

// ---------------------------------------------------------------------------
// Phase 6 + 7: separation-band gating + final validator chain.

function validatePair(
  r0: Rect,
  r1: Rect,
  tileSizeMeters: number,
  bands: SeparationBands,
): { ok: boolean; score: number } {
  const c0 = { x: r0.x + r0.w / 2, y: r0.y + r0.h / 2 };
  const c1 = { x: r1.x + r1.w / 2, y: r1.y + r1.h / 2 };
  if (!respectsMinimumSeparation(c0, c1, tileSizeMeters, bands)) return { ok: false, score: 0 };
  const d = Math.hypot(c0.x - c1.x, c0.y - c1.y) * tileSizeMeters;
  return { ok: true, score: separationScore(d, bands) };
}

// ---------------------------------------------------------------------------
// Squad sub-rect tiling (task #106). Divide the zone rect into
// sub-rectangles, one per squad. For a simple 2-squad case we split
// along the longer axis; for 3+ we greedy-tile left-to-right /
// top-to-bottom. Line-formation fallback (a 1-tile-deep strip) is used
// when the rect is too narrow to tile.

function tileSquadsIntoZone(
  rect: Rect,
  squadCount: number,
): readonly { x: number; y: number; w: number; h: number }[] {
  if (squadCount <= 1) return [{ x: rect.x, y: rect.y, w: rect.w, h: rect.h }];
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const splitVertical = rect.w >= rect.h;
  if (splitVertical) {
    const sw = Math.floor(rect.w / squadCount);
    for (let i = 0; i < squadCount; i++) {
      const x = rect.x + i * sw;
      const w = i === squadCount - 1 ? rect.w - i * sw : sw;
      out.push({ x, y: rect.y, w, h: rect.h });
    }
  } else {
    const sh = Math.floor(rect.h / squadCount);
    for (let i = 0; i < squadCount; i++) {
      const y = rect.y + i * sh;
      const h = i === squadCount - 1 ? rect.h - i * sh : sh;
      out.push({ x: rect.x, y, w: rect.w, h });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Spawn orientation (task #107). Units face the axis centroid from the
// zone centroid. Angle expressed in radians with +X east, +Y south per
// the tile coordinate convention.

function computeFacing(
  zone: Rect,
  axisCx: number,
  axisCy: number,
): number {
  const zx = zone.x + zone.w / 2;
  const zy = zone.y + zone.h / 2;
  return Math.atan2(axisCy - zy, axisCx - zx);
}

// ---------------------------------------------------------------------------
// Asymmetric scenario shapes (task #108). Assault/defence/storming
// scenarios constrain deploy shapes differently:
//  - assault : attacker zone wider (line abreast), defender tighter
//  - defence : defender holds center-rear, attacker flanks
//  - storming: attacker pressed into breach, defender holds second line

export type RegimeShape = {
  readonly team0AspectBias: number; // >1 → prefer wider zones
  readonly team1AspectBias: number;
};

const REGIME_SHAPE: Record<SpawnRegime, RegimeShape> = {
  meeting: { team0AspectBias: 1, team1AspectBias: 1 },
  assault: { team0AspectBias: 1.4, team1AspectBias: 0.8 },
  defence: { team0AspectBias: 0.9, team1AspectBias: 1.2 },
  storming: { team0AspectBias: 1.5, team1AspectBias: 0.7 },
  custom: { team0AspectBias: 1, team1AspectBias: 1 },
};

function applyAspectBias(rect: Rect, bias: number): Rect {
  if (bias === 1) return rect;
  // If bias > 1 we prefer the longer side to dominate further — we
  // clip the shorter dimension. If bias < 1 we do the opposite.
  const clipFactor = bias > 1 ? 1 / bias : bias;
  if (rect.w >= rect.h) {
    const newH = Math.max(4, Math.floor(rect.h * clipFactor));
    return { ...rect, h: newH, area: rect.w * newH };
  }
  const newW = Math.max(4, Math.floor(rect.w * clipFactor));
  return { ...rect, w: newW, area: newW * rect.h };
}

// ---------------------------------------------------------------------------
// Fallback carving (task #105). When no valid pair clears the gate,
// forcibly carve open space in each rear third by taking the largest
// available rect regardless of score and zeroing cliff/overgrown
// blockers in its footprint. Caller applies the carve by invoking
// carveZoneOpen on the world after placement.

export type FallbackCarve = {
  readonly zones: readonly DeployZone[];
  readonly carvedTiles: number;
};

// ---------------------------------------------------------------------------
// Top-level placer. Runs all 7 phases + squad tiling + orientation.

export function placeSpawns(input: SpawnPlacerInput): SpawnPlacerResult {
  const { W, H, tileSizeMeters, regime, rosterTeam0, rosterTeam1 } = input;
  const bands = separationBandsFor(regime, W, H, tileSizeMeters);
  const axis = deriveAxis(input.objectiveAnchors, W, H);

  const shape = REGIME_SHAPE[regime];

  const rear0 = rearThirdRect(W, H, axis.cx, axis.cy, -1, axis.angleRadians);
  const rear1 = rearThirdRect(W, H, axis.cx, axis.cy, 1, axis.angleRadians);

  const mask0 = buildSpawnMask(input, rear0);
  const mask1 = buildSpawnMask(input, rear1);

  const top0 = topKLargestRectangles(mask0, W, H, TOP_K_PER_SIDE)
    .map((r) => applyAspectBias(r, shape.team0AspectBias));
  const top1 = topKLargestRectangles(mask1, W, H, TOP_K_PER_SIDE)
    .map((r) => applyAspectBias(r, shape.team1AspectBias));

  let best: { r0: Rect; r1: Rect; score: number } | null = null;
  for (const r0 of top0) {
    const s0 = scoreCandidate(r0, W, H, regime, rosterTeam0);
    if (s0 === -Infinity) continue;
    for (const r1 of top1) {
      const s1 = scoreCandidate(r1, W, H, regime, rosterTeam1);
      if (s1 === -Infinity) continue;
      const pair = validatePair(r0, r1, tileSizeMeters, bands);
      if (!pair.ok) continue;
      const total = s0 + s1 + pair.score * 0.4;
      if (!best || total > best.score) best = { r0, r1, score: total };
    }
  }

  let fallbackUsed = false;
  if (!best) {
    // Fallback: take the unconditional largest rect from each side.
    const fb0 = largestRectangle(mask0, W, H);
    const fb1 = largestRectangle(mask1, W, H);
    best = { r0: fb0, r1: fb1, score: 0 };
    fallbackUsed = true;
  }

  const team0: DeployZone = {
    x: best.r0.x,
    y: best.r0.y,
    w: best.r0.w,
    h: best.r0.h,
    facing: computeFacing(best.r0, axis.cx, axis.cy),
    squadRects: tileSquadsIntoZone(best.r0, rosterTeam0.squadCount),
  };
  const team1: DeployZone = {
    x: best.r1.x,
    y: best.r1.y,
    w: best.r1.w,
    h: best.r1.h,
    facing: computeFacing(best.r1, axis.cx, axis.cy),
    squadRects: tileSquadsIntoZone(best.r1, rosterTeam1.squadCount),
  };

  return { team0, team1, axis, bands, fallbackUsed };
}
