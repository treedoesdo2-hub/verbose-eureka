// COA-4 task #78 — secondary capillary picker + stamper.
//
// A capillary is a narrower secondary line branching off the dominant
// line: side-roads off a highway, tributaries off a river, footpaths
// off a hedgerow spine. Capillaries add spatial variety without
// overwhelming the primary line's identity.

import { baseToByte } from '../world';
import type { DominantCapillary, DominantLine } from './dominant-line';
import { baseKindForLine } from './route-line';
import type { Rng } from './noise';

// Pick capillary branch points along the dominant line — every 20-40
// tiles along the line path, a capillary branches perpendicular for
// 10-30 tiles. Returns 0-3 capillaries depending on the dominant line's
// length and the RNG roll.
export function pickCapillaries(
  parent: DominantLine,
  rng: Rng,
  W: number,
  H: number,
): DominantCapillary[] {
  const path = parent.waypoints;
  if (path.length < 8) return [];
  const maxCapillaries = 3;
  const out: DominantCapillary[] = [];
  const attempts = maxCapillaries + 2;
  for (let attempt = 0; attempt < attempts && out.length < maxCapillaries; attempt++) {
    // Pick an anchor along the path.
    const anchorIdx = Math.floor(rng() * path.length);
    const anchor = path[anchorIdx];
    // Determine the line direction at this point (for perpendicular branch).
    const prev = path[Math.max(0, anchorIdx - 1)];
    const next = path[Math.min(path.length - 1, anchorIdx + 1)];
    const dirX = next.x - prev.x;
    const dirY = next.y - prev.y;
    const mag = Math.hypot(dirX, dirY) || 1;
    // Perpendicular unit vector.
    const perpX = -dirY / mag;
    const perpY = dirX / mag;
    // Capillary length 10-30 tiles, flip random side.
    const length = 10 + Math.floor(rng() * 20);
    const side = rng() < 0.5 ? 1 : -1;
    const endX = Math.round(anchor.x + perpX * length * side);
    const endY = Math.round(anchor.y + perpY * length * side);
    if (endX < 0 || endY < 0 || endX >= W || endY >= H) continue;
    const cap: DominantCapillary = {
      parent,
      waypoints: [anchor, { x: endX, y: endY }],
      width: 1,
    };
    out.push(cap);
  }
  return out;
}

// Stamp a capillary into the base grid. Width is always 1 tile.
export function stampCapillary(
  cap: DominantCapillary,
  base: Uint8Array,
  W: number,
  H: number,
): number {
  const byte = baseToByte(baseKindForLine(cap.parent.kind));
  let stamped = 0;
  for (let i = 0; i < cap.waypoints.length - 1; i++) {
    const a = cap.waypoints[i];
    const b = cap.waypoints[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const steps = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(a.x + dx * t);
      const y = Math.round(a.y + dy * t);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      base[y * W + x] = byte;
      stamped++;
    }
  }
  return stamped;
}
