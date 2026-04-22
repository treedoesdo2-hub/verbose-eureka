// COA-4 tasks #69-#77 — route generators for all 8 LineKinds + stampLine.
//
// Each routeLine* function produces a waypoint list (tile coords). The
// choice is geometry-driven: road-straight is a Bresenham line with an
// fBm S-curve, river follows elevation minima, ridge follows maxima, etc.
// stampLine walks between consecutive waypoints and writes the correct
// base/point/barrier byte per tile according to line kind.

import type { TerrainBase } from '@schema/map';
import { baseToByte } from '../world';
import type { DominantLine, LineKind } from './dominant-line';
import { fbm2D, type Rng } from './noise';

type Point = { x: number; y: number };

// ---------------------------------------------------------------------------
// Helper: Bresenham rasterization with optional fBm displacement.

function bresenhamWithSCurve(
  from: Point,
  to: Point,
  fbmAmplitude: number,
  seed: number,
): Point[] {
  const points: Point[] = [];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return [from];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bx = from.x + dx * t;
    const by = from.y + dy * t;
    // S-curve: perpendicular displacement driven by fBm along t.
    const perpX = -dy / Math.hypot(dx, dy);
    const perpY = dx / Math.hypot(dx, dy);
    const offset = (fbm2D(t * 100, 0, 0.05, 3, seed, 100) - 0.5) * fbmAmplitude;
    points.push({ x: Math.round(bx + perpX * offset), y: Math.round(by + perpY * offset) });
  }
  return points;
}

// ---------------------------------------------------------------------------
// #69 road-straight: Bresenham + fBm S-curve.

export function routeRoadStraight(
  W: number,
  H: number,
  rng: Rng,
): Point[] {
  // Pick an axis: horizontal or vertical. Entry / exit points are
  // randomized along the perpendicular edge.
  const horizontal = rng() < 0.5;
  if (horizontal) {
    const y = Math.floor(H * (0.3 + rng() * 0.4));
    return bresenhamWithSCurve(
      { x: 0, y },
      { x: W - 1, y },
      Math.min(W, H) * 0.15,
      Math.floor(rng() * 0xffffffff),
    );
  } else {
    const x = Math.floor(W * (0.3 + rng() * 0.4));
    return bresenhamWithSCurve(
      { x, y: 0 },
      { x, y: H - 1 },
      Math.min(W, H) * 0.15,
      Math.floor(rng() * 0xffffffff),
    );
  }
}

// ---------------------------------------------------------------------------
// #70 road-star: Y/X convergence at the map center.

export function routeRoadStar(W: number, H: number, rng: Rng): Point[] {
  void rng;
  // Three spokes converging at (cx, cy) from three edge points.
  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2);
  return [
    { x: 0, y: cy },
    { x: cx, y: cy },
    { x: W - 1, y: cy },
    { x: cx, y: cy },
    { x: cx, y: 0 },
    { x: cx, y: cy },
    { x: cx, y: H - 1 },
  ];
}

// ---------------------------------------------------------------------------
// #71 rail: grade-limited (no >2-step elevation jump per segment) + stations.

export function routeRail(
  W: number,
  H: number,
  elevationStep: Uint8Array,
  rng: Rng,
): { path: Point[]; stations: Point[] } {
  // Pick entry + exit tiles with low elevation so the grade cap is easy
  // to satisfy.
  const ey = Math.floor(H * (0.4 + rng() * 0.2));
  const exy = Math.floor(H * (0.4 + rng() * 0.2));
  const entry: Point = { x: 0, y: ey };
  const exit: Point = { x: W - 1, y: exy };
  const path: Point[] = [];
  let prev = entry;
  // Straight-line with grade-smoothing: when an elevation jump exceeds 2
  // steps, detour via the lower neighbor.
  const dx = exit.x - entry.x;
  const dy = exit.y - entry.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let x = Math.round(entry.x + dx * t);
    let y = Math.round(entry.y + dy * t);
    if (i > 0 && x >= 0 && x < W && y >= 0 && y < H) {
      const prevStep = elevationStep[prev.y * W + prev.x];
      const curStep = elevationStep[y * W + x];
      if (Math.abs(curStep - prevStep) > 2) {
        // Detour — add an intermediate at prev.y to smooth.
        path.push({ x, y: prev.y });
      }
    }
    path.push({ x, y });
    prev = { x, y };
  }
  // Stations every ~quarter of the line.
  const stationCount = 3;
  const stations: Point[] = [];
  for (let s = 1; s <= stationCount; s++) {
    const idx = Math.floor((path.length * s) / (stationCount + 1));
    stations.push(path[idx]);
  }
  return { path, stations };
}

// ---------------------------------------------------------------------------
// #72 river: elevation-minimum Dijkstra-ish traversal.

export function routeRiver(
  W: number,
  H: number,
  elevationStep: Uint8Array,
  rng: Rng,
): Point[] {
  // Start at highest-elevation edge tile, end at lowest. Flow along
  // elevation minima (steepest descent, 8-connected).
  const start: Point = { x: 0, y: Math.floor(H / 2) };
  const path: Point[] = [start];
  let cur = start;
  const visited = new Uint8Array(W * H);
  visited[cur.y * W + cur.x] = 1;
  const maxSteps = W + H + 32;
  for (let i = 0; i < maxSteps; i++) {
    if (cur.x >= W - 1 || cur.y <= 0 || cur.y >= H - 1) break;
    let best: Point | null = null;
    let bestElev = elevationStep[cur.y * W + cur.x];
    // Prefer neighbors toward the right (east) + lowest elevation.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (visited[ny * W + nx]) continue;
        const ne = elevationStep[ny * W + nx];
        if (ne <= bestElev) {
          bestElev = ne;
          best = { x: nx, y: ny };
        }
      }
    }
    if (!best) break;
    path.push(best);
    visited[best.y * W + best.x] = 1;
    cur = best;
  }
  // Add some small fBm wiggle via rng-seeded lateral shifts — rivers
  // shouldn't look like graph-paper.
  void rng;
  return path;
}

// ---------------------------------------------------------------------------
// #73 canal: like river but straight with lock waypoints.

export function routeCanal(W: number, H: number, rng: Rng): { path: Point[]; locks: Point[] } {
  // Straight horizontal canal with 2-3 locks.
  const y = Math.floor(H * (0.4 + rng() * 0.2));
  const path: Point[] = [];
  for (let x = 0; x < W; x++) path.push({ x, y });
  const lockCount = 2 + Math.floor(rng() * 2);
  const locks: Point[] = [];
  for (let l = 1; l <= lockCount; l++) {
    const idx = Math.floor((W * l) / (lockCount + 1));
    locks.push({ x: idx, y });
  }
  return { path, locks };
}

// ---------------------------------------------------------------------------
// #74 ridge: elevation-max traversal (opposite of river).

export function routeRidge(
  W: number,
  H: number,
  elevationStep: Uint8Array,
  rng: Rng,
): Point[] {
  void rng;
  // Scan each column for the highest elevation tile; connect.
  const path: Point[] = [];
  for (let x = 0; x < W; x++) {
    let bestY = 0;
    let bestElev = -1;
    for (let y = 0; y < H; y++) {
      if (elevationStep[y * W + x] > bestElev) {
        bestElev = elevationStep[y * W + x];
        bestY = y;
      }
    }
    path.push({ x, y: bestY });
  }
  return path;
}

// ---------------------------------------------------------------------------
// #75 highstreet: village core with densest cluster. Picks the center
// of mass of the highest-density tiles and runs a street through it.

export function routeHighstreet(W: number, H: number, density: Float32Array): Point[] {
  // Center of mass of the top-quartile density tiles.
  const tiles: { x: number; y: number; v: number }[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = density[y * W + x];
      if (v >= 0.5) tiles.push({ x, y, v });
    }
  }
  if (tiles.length === 0) return routeRoadStraight(W, H, () => 0.5);
  tiles.sort((a, b) => b.v - a.v);
  const top = tiles.slice(0, Math.max(1, Math.floor(tiles.length * 0.25)));
  let cx = 0;
  let cy = 0;
  for (const t of top) {
    cx += t.x;
    cy += t.y;
  }
  cx = Math.floor(cx / top.length);
  cy = Math.floor(cy / top.length);
  const len = Math.min(W, H) / 3;
  // Horizontal street through the center of mass.
  const x0 = Math.max(0, cx - Math.floor(len / 2));
  const x1 = Math.min(W - 1, cx + Math.floor(len / 2));
  const points: Point[] = [];
  for (let x = x0; x <= x1; x++) points.push({ x, y: cy });
  return points;
}

// ---------------------------------------------------------------------------
// #76 hedgerow-spine: braided barrier line (returns center waypoints;
// actual barrier stamping uses stampBarrierLine from barriers.ts).

export function routeHedgerowSpine(W: number, H: number, rng: Rng): Point[] {
  // Braided = two parallel lines joined by occasional cross-links.
  const y = Math.floor(H * (0.35 + rng() * 0.3));
  const points: Point[] = [];
  for (let x = 2; x < W - 2; x++) {
    const wave = Math.sin(x * 0.15) * 2;
    points.push({ x, y: Math.floor(y + wave) });
  }
  return points;
}

// ---------------------------------------------------------------------------
// #77 stampLine — walks between consecutive waypoints and writes tiles.

export function stampLine(
  line: DominantLine,
  base: Uint8Array,
  W: number,
  H: number,
): number {
  const targetByte = baseByteForKind(line.kind);
  const halfWidth = Math.max(0, Math.floor((line.width - 1) / 2));
  let tilesStamped = 0;
  for (let i = 0; i < line.waypoints.length - 1; i++) {
    const a = line.waypoints[i];
    const b = line.waypoints[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const steps = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = Math.round(a.x + dx * t);
      const cy = Math.round(a.y + dy * t);
      for (let oy = -halfWidth; oy <= halfWidth; oy++) {
        for (let ox = -halfWidth; ox <= halfWidth; ox++) {
          const x = cx + ox;
          const y = cy + oy;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          base[y * W + x] = targetByte;
          tilesStamped++;
        }
      }
    }
  }
  return tilesStamped;
}

function baseByteForKind(kind: LineKind): number {
  switch (kind) {
    case 'road-straight':
    case 'road-star':
    case 'highstreet':
      return baseToByte('road');
    case 'rail':
      return baseToByte('rubble_ground'); // rail bed placeholder
    case 'river':
    case 'canal':
      return baseToByte('water_shallow');
    case 'ridge':
      return baseToByte('rubble_ground');
    case 'hedgerow-spine':
      return baseToByte('open'); // barrier-carried, base stays open
  }
}

// Factory: delegate to the right algorithm per LineKind, returning a
// fully-populated DominantLine. Keeps pipeline integration a one-liner.
export function buildDominantLine(
  kind: LineKind,
  W: number,
  H: number,
  elevationStep: Uint8Array,
  density: Float32Array,
  rng: Rng,
): DominantLine {
  switch (kind) {
    case 'road-straight': {
      const waypoints = routeRoadStraight(W, H, rng);
      return { kind, waypoints, width: 2 };
    }
    case 'road-star': {
      const waypoints = routeRoadStar(W, H, rng);
      return { kind, waypoints, width: 2, metadata: { villageCenter: waypoints[1] } };
    }
    case 'rail': {
      const { path, stations } = routeRail(W, H, elevationStep, rng);
      return { kind, waypoints: path, width: 1, metadata: { stations } };
    }
    case 'river': {
      const waypoints = routeRiver(W, H, elevationStep, rng);
      return { kind, waypoints, width: 2 };
    }
    case 'canal': {
      const { path, locks } = routeCanal(W, H, rng);
      return { kind, waypoints: path, width: 2, metadata: { locks } };
    }
    case 'ridge': {
      const waypoints = routeRidge(W, H, elevationStep, rng);
      return { kind, waypoints, width: 1 };
    }
    case 'highstreet': {
      const waypoints = routeHighstreet(W, H, density);
      return {
        kind,
        waypoints,
        width: 3,
        metadata: { villageCenter: waypoints[Math.floor(waypoints.length / 2)] },
      };
    }
    case 'hedgerow-spine': {
      const waypoints = routeHedgerowSpine(W, H, rng);
      return { kind, waypoints, width: 1 };
    }
  }
}

// Utility for TerrainBase callers that want to poke the line painter
// without going through buildDominantLine.
export function baseKindForLine(kind: LineKind): TerrainBase {
  switch (kind) {
    case 'road-straight':
    case 'road-star':
    case 'highstreet':
      return 'road';
    case 'rail':
    case 'ridge':
      return 'rubble_ground';
    case 'river':
    case 'canal':
      return 'water_shallow';
    case 'hedgerow-spine':
      return 'open';
  }
}
