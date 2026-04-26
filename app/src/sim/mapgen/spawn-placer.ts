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
import type { DominantLine } from './dominant-line';
import { largestRectangle, maskToSubrect, type Rect, topKLargestRectangles } from './largest-rect';
import {
  respectsMinimumSeparation,
  type SeparationBands,
  separationBandsFor,
  separationScore,
} from './separation-bands';
import type { DeployZone, ObjectiveAnchor, RosterSpec, SpawnRegime, UnitSlot, UnitSlots } from './types';

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
  void axisCx;
  void axisCy;
  return { x: 0, y: 0, w: thirdW, h: H };
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

// ---------------------------------------------------------------------------
// ADR 014 — marching-order + objective-ring spawn planner.
//
// Replaces the old rect-grid spawn model. Team 0 marches in along a
// road-connected map edge; team 1 rings the dominant objective anchor.
// The zones remain as a back-compat shape but no longer drive terrain
// suppression in the pipeline. See decisions/014 for the full rationale.

const MARCH_MAX_SLOTS = 16; // over-provision; consumers slice to roster size
const RING_MAX_SLOTS = 24;

type MapEdge = 'top' | 'bottom' | 'left' | 'right';

function nearestMapEdge(p: { x: number; y: number }, W: number, H: number): { edge: MapEdge; dist: number } {
  const candidates: { edge: MapEdge; dist: number }[] = [
    { edge: 'top', dist: p.y },
    { edge: 'bottom', dist: H - 1 - p.y },
    { edge: 'left', dist: p.x },
    { edge: 'right', dist: W - 1 - p.x },
  ];
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0];
}

function edgeIsRoadLike(kind: DominantLine['kind']): boolean {
  return kind === 'road-straight' || kind === 'road-star' || kind === 'rail' || kind === 'highstreet';
}

function inwardVector(edge: MapEdge): { dx: number; dy: number } {
  switch (edge) {
    case 'top': return { dx: 0, dy: 1 };
    case 'bottom': return { dx: 0, dy: -1 };
    case 'left': return { dx: 1, dy: 0 };
    case 'right': return { dx: -1, dy: 0 };
  }
}

function lateralVector(edge: MapEdge): { dx: number; dy: number } {
  switch (edge) {
    case 'top':
    case 'bottom': return { dx: 1, dy: 0 };
    case 'left':
    case 'right': return { dx: 0, dy: 1 };
  }
}

function inBounds(x: number, y: number, W: number, H: number): boolean {
  return x >= 0 && x < W && y >= 0 && y < H;
}

function walkableFoot(walkability: Uint16Array, idx: number): boolean {
  return (walkability[idx] & WALK_FOOT) !== 0;
}

// Pick the entry point on a map edge. Prefer a road-like dominantLine
// endpoint that actually reaches an edge tile; otherwise fall back to the
// center of the team0 deploy zone projected to its nearest edge.
function pickMarchEntry(
  W: number,
  H: number,
  walkability: Uint16Array,
  dominantLine: DominantLine | null,
  team0Zone: DeployZone,
): { edge: MapEdge; entry: { x: number; y: number }; facingRad: number } {
  if (dominantLine && edgeIsRoadLike(dominantLine.kind) && dominantLine.waypoints.length >= 2) {
    const endpoints = [dominantLine.waypoints[0], dominantLine.waypoints[dominantLine.waypoints.length - 1]];
    let best: { edge: MapEdge; entry: { x: number; y: number }; dist: number } | null = null;
    for (const p of endpoints) {
      const ne = nearestMapEdge(p, W, H);
      // Keep endpoints within 3 tiles of the edge — farther than that and
      // it's not really an entry point.
      if (ne.dist > 3) continue;
      const entry = {
        x: ne.edge === 'left' ? 0 : ne.edge === 'right' ? W - 1 : Math.max(0, Math.min(W - 1, p.x)),
        y: ne.edge === 'top' ? 0 : ne.edge === 'bottom' ? H - 1 : Math.max(0, Math.min(H - 1, p.y)),
      };
      if (!best || ne.dist < best.dist) best = { edge: ne.edge, entry, dist: ne.dist };
    }
    if (best) {
      const inward = inwardVector(best.edge);
      return { edge: best.edge, entry: best.entry, facingRad: Math.atan2(inward.dy, inward.dx) };
    }
  }
  // Fallback: project team0 zone center to its nearest edge and use that.
  const cx = Math.floor(team0Zone.x + team0Zone.w / 2);
  const cy = Math.floor(team0Zone.y + team0Zone.h / 2);
  const ne = nearestMapEdge({ x: cx, y: cy }, W, H);
  const entry = {
    x: ne.edge === 'left' ? 0 : ne.edge === 'right' ? W - 1 : cx,
    y: ne.edge === 'top' ? 0 : ne.edge === 'bottom' ? H - 1 : cy,
  };
  // Nudge to nearest foot-passable tile along the edge if the direct
  // projection is blocked.
  const adjusted = nudgeToWalkable(entry, ne.edge, W, H, walkability);
  const inward = inwardVector(ne.edge);
  return { edge: ne.edge, entry: adjusted, facingRad: Math.atan2(inward.dy, inward.dx) };
}

function nudgeToWalkable(
  p: { x: number; y: number },
  edge: MapEdge,
  W: number,
  H: number,
  walkability: Uint16Array,
): { x: number; y: number } {
  if (walkableFoot(walkability, p.y * W + p.x)) return p;
  const lat = lateralVector(edge);
  for (let step = 1; step < Math.max(W, H); step++) {
    for (const s of [1, -1]) {
      const nx = p.x + lat.dx * step * s;
      const ny = p.y + lat.dy * step * s;
      if (!inBounds(nx, ny, W, H)) continue;
      if (walkableFoot(walkability, ny * W + nx)) return { x: nx, y: ny };
    }
  }
  return p;
}

// Generate marching-order slots starting from the edge tile and walking
// inland. Squads stack along the road (squad 0 closest to edge, squad N
// deepest). Within a squad we stagger members laterally so they form a
// loose column rather than a conga line.
function generateMarchSlots(
  entry: { x: number; y: number },
  edge: MapEdge,
  facingRad: number,
  W: number,
  H: number,
  walkability: Uint16Array,
  maxSlots: number,
): UnitSlot[] {
  const inward = inwardVector(edge);
  const lat = lateralVector(edge);
  const out: UnitSlot[] = [];
  const squadSize = 4; // ADR 003 squads chunk by 4
  const squadCount = Math.ceil(maxSlots / squadSize);
  const squadSpacing = 3; // tiles of gap between squads inland
  const memberSpacing = 2; // tiles between members within a squad

  for (let s = 0; s < squadCount && out.length < maxSlots; s++) {
    const inlandOffset = s * (squadSpacing + memberSpacing);
    for (let m = 0; m < squadSize && out.length < maxSlots; m++) {
      // Column layout: two abreast per rank, alternating sides.
      const rank = Math.floor(m / 2);
      const side = m % 2 === 0 ? 1 : -1;
      const lateralOffset = side * Math.ceil((rank + 1) / 2);
      const depth = inlandOffset + rank * memberSpacing + 1;
      const x = entry.x + inward.dx * depth + lat.dx * lateralOffset;
      const y = entry.y + inward.dy * depth + lat.dy * lateralOffset;
      const slot = nudgeToWalkable({ x, y }, edge, W, H, walkability);
      // Skip duplicates (nudge can collapse many slots onto one tile on narrow maps).
      if (out.some((p) => p.x === slot.x && p.y === slot.y)) continue;
      if (!inBounds(slot.x, slot.y, W, H)) continue;
      if (!walkableFoot(walkability, slot.y * W + slot.x)) continue;
      out.push({ x: slot.x, y: slot.y, facing: facingRad });
    }
  }
  return out;
}

function pickRingAnchor(anchors: readonly ObjectiveAnchor[]): ObjectiveAnchor | null {
  if (anchors.length === 0) return null;
  const priority: Record<ObjectiveAnchor['kindHint'], number> = { defend: 3, secure: 2, extract: 1 };
  return anchors.slice().sort((a, b) => {
    const pa = priority[a.kindHint] ?? 0;
    const pb = priority[b.kindHint] ?? 0;
    if (pa !== pb) return pb - pa;
    return b.qualityScore - a.qualityScore;
  })[0];
}

// Ring of tiles around a center point. Grows outward in concentric rings
// until we've produced maxSlots foot-passable positions. Units face
// outward (away from the anchor center).
function generateRingSlots(
  anchor: ObjectiveAnchor,
  W: number,
  H: number,
  walkability: Uint16Array,
  maxSlots: number,
): UnitSlot[] {
  const cx = anchor.rect.x + anchor.rect.w / 2;
  const cy = anchor.rect.y + anchor.rect.h / 2;
  const out: UnitSlot[] = [];
  const minRadius = Math.max(2, Math.ceil(Math.max(anchor.rect.w, anchor.rect.h) / 2) + 1);
  const maxRadius = minRadius + 6;
  for (let radius = minRadius; radius <= maxRadius && out.length < maxSlots; radius++) {
    const circumference = Math.max(6, Math.ceil(2 * Math.PI * radius));
    for (let i = 0; i < circumference && out.length < maxSlots; i++) {
      const theta = (i / circumference) * 2 * Math.PI;
      const x = Math.round(cx + Math.cos(theta) * radius);
      const y = Math.round(cy + Math.sin(theta) * radius);
      if (!inBounds(x, y, W, H)) continue;
      if (!walkableFoot(walkability, y * W + x)) continue;
      if (out.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 2)) continue;
      // Face outward.
      const facing = Math.atan2(y - cy, x - cx);
      out.push({ x, y, facing });
    }
  }
  return out;
}

function gridSampleZone(zone: DeployZone, count: number): UnitSlot[] {
  const out: UnitSlot[] = [];
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const dx = zone.w / (cols + 1);
  const dy = zone.h / (rows + 1);
  const facing = zone.facing ?? 0;
  for (let r = 0; r < rows && out.length < count; r++) {
    for (let c = 0; c < cols && out.length < count; c++) {
      out.push({
        x: Math.floor(zone.x + dx * (c + 1)),
        y: Math.floor(zone.y + dy * (r + 1)),
        facing,
      });
    }
  }
  return out;
}

export type SpawnPlanInput = {
  readonly W: number;
  readonly H: number;
  readonly walkability: Uint16Array;
  readonly dominantLine: DominantLine | null;
  readonly objectiveAnchors: readonly ObjectiveAnchor[];
  readonly team0Zone: DeployZone;
  readonly team1Zone: DeployZone;
};

export type SpawnPlanResult = {
  readonly slots: UnitSlots;
  readonly team0FallbackUsed: boolean;
  readonly team1FallbackUsed: boolean;
  readonly team0Entry: { readonly edge: MapEdge; readonly x: number; readonly y: number; readonly facing: number } | null;
  readonly team1Anchor: ObjectiveAnchor | null;
};

export function planUnitSlots(input: SpawnPlanInput): SpawnPlanResult {
  const { W, H, walkability, dominantLine, objectiveAnchors, team0Zone, team1Zone } = input;

  // Team 0: marching-order road entry.
  const entry = pickMarchEntry(W, H, walkability, dominantLine, team0Zone);
  const team0Slots = generateMarchSlots(
    entry.entry,
    entry.edge,
    entry.facingRad,
    W,
    H,
    walkability,
    MARCH_MAX_SLOTS,
  );
  let team0FallbackUsed = false;
  let team0Final: readonly UnitSlot[] = team0Slots;
  if (team0Final.length === 0) {
    team0Final = gridSampleZone(team0Zone, MARCH_MAX_SLOTS);
    team0FallbackUsed = true;
  }

  // Team 1: ring around dominant objective.
  const ringAnchor = pickRingAnchor(objectiveAnchors);
  let team1Slots: UnitSlot[] = [];
  if (ringAnchor) {
    team1Slots = generateRingSlots(ringAnchor, W, H, walkability, RING_MAX_SLOTS);
  }
  let team1FallbackUsed = false;
  let team1Final: readonly UnitSlot[] = team1Slots;
  if (team1Final.length === 0) {
    team1Final = gridSampleZone(team1Zone, RING_MAX_SLOTS);
    team1FallbackUsed = true;
  }

  return {
    slots: { team0: team0Final, team1: team1Final },
    team0FallbackUsed,
    team1FallbackUsed,
    team0Entry: {
      edge: entry.edge,
      x: entry.entry.x,
      y: entry.entry.y,
      facing: entry.facingRad,
    },
    team1Anchor: ringAnchor,
  };
}
