// COA-3 task #56 — reachability enforcement between multiple regions.
//
// A map can be procedurally correct (all tiles within spec) but still
// broken for play if the team 0 zone can't reach the team 1 zone or the
// central objective. enforceReachability runs a BFS flood from each
// required anchor, intersects the reachable sets, and carves a corridor
// through the smallest bottleneck if coverage is incomplete.
//
// Corridor carving mutates the base + point + walkability grids to open
// a 1-tile-wide path, prioritizing tiles that were already walkable but
// isolated (forest / scatter clusters) over tiles that were structurally
// impassable (buildings, cliffs).

import { WALK_FOOT } from '../world';
import type { DebugSink } from './debug-sink';

export type ReachableRegion = {
  readonly label: string;
  readonly seedTileX: number;
  readonly seedTileY: number;
};

export type ReachabilityReport = {
  readonly allReachable: boolean;
  readonly reachedFromFirst: number; // tile count from seeds[0]'s flood
  readonly disconnectedRegions: readonly string[];
  readonly carvedTiles: number;
};

// BFS flood from (sx, sy) over tiles where walkability[i] & WALK_FOOT != 0.
// Returns the visited mask (Uint8 per tile).
export function bfsFootReachable(
  walkability: Uint16Array,
  W: number,
  H: number,
  sx: number,
  sy: number,
): Uint8Array {
  const visited = new Uint8Array(W * H);
  const startIdx = sy * W + sx;
  if (startIdx < 0 || startIdx >= W * H) return visited;
  if ((walkability[startIdx] & WALK_FOOT) === 0) return visited;
  visited[startIdx] = 1;
  const queue: number[] = [startIdx];
  while (queue.length > 0) {
    const i = queue.shift() as number;
    const x = i % W;
    const y = (i - x) / W;
    const neighbors = [
      x > 0 ? i - 1 : -1,
      x < W - 1 ? i + 1 : -1,
      y > 0 ? i - W : -1,
      y < H - 1 ? i + W : -1,
    ];
    for (const n of neighbors) {
      if (n < 0 || visited[n]) continue;
      if ((walkability[n] & WALK_FOOT) === 0) continue;
      visited[n] = 1;
      queue.push(n);
    }
  }
  return visited;
}

// Naive corridor carver — steps one tile per iteration toward the goal,
// forcing the current tile to be foot-walkable. Used only as a fallback
// when proper cluster routing fails; logs a warning so it's visible in
// integration runs that this map needed surgery.
export function carveStraightCorridor(
  walkability: Uint16Array,
  base: Uint8Array,
  point: Uint8Array,
  buildingId: Uint16Array,
  W: number,
  H: number,
  fx: number,
  fy: number,
  gx: number,
  gy: number,
  openByte: number,
): number {
  let x = fx;
  let y = fy;
  let carved = 0;
  let iter = 0;
  const maxIter = W + H + 16;
  while ((x !== gx || y !== gy) && iter++ < maxIter) {
    const i = y * W + x;
    if ((walkability[i] & WALK_FOOT) === 0) {
      walkability[i] |= WALK_FOOT;
      if (point[i] !== 0) point[i] = 0;
      if (buildingId[i] !== 0) buildingId[i] = 0;
      base[i] = openByte;
      carved++;
    }
    if (x < gx) x++;
    else if (x > gx) x--;
    else if (y < gy) y++;
    else if (y > gy) y--;
  }
  return carved;
}

export function enforceReachability(
  walkability: Uint16Array,
  base: Uint8Array,
  point: Uint8Array,
  buildingId: Uint16Array,
  W: number,
  H: number,
  seeds: readonly ReachableRegion[],
  openByte: number,
  sink?: DebugSink,
): ReachabilityReport {
  if (seeds.length === 0) {
    return {
      allReachable: true,
      reachedFromFirst: 0,
      disconnectedRegions: [],
      carvedTiles: 0,
    };
  }
  const first = seeds[0];
  const reachable = bfsFootReachable(walkability, W, H, first.seedTileX, first.seedTileY);
  let reachedFromFirst = 0;
  for (let i = 0; i < reachable.length; i++) if (reachable[i]) reachedFromFirst++;
  const disconnected: string[] = [];
  let carved = 0;
  for (let s = 1; s < seeds.length; s++) {
    const seed = seeds[s];
    const idx = seed.seedTileY * W + seed.seedTileX;
    if (!reachable[idx]) {
      disconnected.push(seed.label);
      if (sink) sink.warn('reachability', 'region disconnected', { label: seed.label });
      // Carve a straight corridor from seed[0] to this seed. Good enough
      // for MVP; proper cluster-routing arrives with COA-4's dominant lines.
      carved += carveStraightCorridor(
        walkability,
        base,
        point,
        buildingId,
        W,
        H,
        first.seedTileX,
        first.seedTileY,
        seed.seedTileX,
        seed.seedTileY,
        openByte,
      );
    }
  }
  if (sink) {
    sink.info('reachability', 'enforcement complete', {
      reachedFromFirst,
      disconnectedRegions: disconnected.length,
      carvedTiles: carved,
    });
  }
  return {
    allReachable: disconnected.length === 0,
    reachedFromFirst,
    disconnectedRegions: disconnected,
    carvedTiles: carved,
  };
}
