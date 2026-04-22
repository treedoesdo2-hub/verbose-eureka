// COA-3 task #57 — cluster size distribution targets + dilation growth.
//
// After scatter passes and pruning, clusters should form a power-law-ish
// distribution: a handful of big clusters, many small ones. If the
// distribution is too flat (all clusters same size) the map reads as
// uniform noise; if too spiky (one giant cluster dominates) it reads as
// a single blob. checkSizeBuckets counts clusters per size bucket and
// reports which buckets are underpopulated. growUnderpopulated dilates
// small clusters toward the target via a morphological grow sweep.

import { floodComponents, type ClusterInfo } from './cluster-prune';

export type SizeBucket = {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly targetCount: number;
};

export const DEFAULT_BUCKETS: readonly SizeBucket[] = [
  { label: 'tiny', min: 1, max: 4, targetCount: 8 },
  { label: 'small', min: 5, max: 12, targetCount: 4 },
  { label: 'medium', min: 13, max: 30, targetCount: 2 },
  { label: 'large', min: 31, max: Number.POSITIVE_INFINITY, targetCount: 1 },
];

export type SizeReport = {
  readonly buckets: readonly { bucket: SizeBucket; actual: number }[];
  readonly totalClusters: number;
  readonly largestSize: number;
};

export function checkSizeBuckets(
  clusters: readonly ClusterInfo[],
  buckets: readonly SizeBucket[] = DEFAULT_BUCKETS,
): SizeReport {
  const counts = buckets.map(() => 0);
  let largest = 0;
  for (const c of clusters) {
    const sz = c.tiles.length;
    if (sz > largest) largest = sz;
    for (let i = 0; i < buckets.length; i++) {
      if (sz >= buckets[i].min && sz <= buckets[i].max) {
        counts[i]++;
        break;
      }
    }
  }
  return {
    buckets: buckets.map((b, i) => ({ bucket: b, actual: counts[i] })),
    totalClusters: clusters.length,
    largestSize: largest,
  };
}

// Morphological dilation — for each tile currently in the byte-matching
// set, mark its 4-neighbors. After one sweep the set grows by 1 tile on
// all borders. Used by growUnderpopulated to push tiny clusters toward
// their target size bucket.
export function dilateOnce(
  grid: Uint8Array,
  targetByte: number,
  W: number,
  H: number,
  mutator: (idx: number) => void,
): number {
  let grown = 0;
  const toSet: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (grid[i] === targetByte) continue;
      // Check 4-neighbors.
      if (
        (x > 0 && grid[i - 1] === targetByte) ||
        (x < W - 1 && grid[i + 1] === targetByte) ||
        (y > 0 && grid[i - W] === targetByte) ||
        (y < H - 1 && grid[i + W] === targetByte)
      ) {
        toSet.push(i);
      }
    }
  }
  for (const idx of toSet) {
    mutator(idx);
    grown++;
  }
  return grown;
}

export function growUnderpopulated(
  grid: Uint8Array,
  targetByte: number,
  W: number,
  H: number,
  desiredTotal: number,
  maxSweeps = 3,
): number {
  let currentTotal = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] === targetByte) currentTotal++;
  let grown = 0;
  for (let sweep = 0; sweep < maxSweeps && currentTotal < desiredTotal; sweep++) {
    const gained = dilateOnce(grid, targetByte, W, H, (i) => {
      grid[i] = targetByte;
    });
    currentTotal += gained;
    grown += gained;
    if (gained === 0) break;
  }
  return grown;
}

// Hole-pruning (task #58) — for a cluster of `targetByte`, any open
// pocket inside (a 4-connected component of non-target tiles surrounded
// by target tiles) smaller than maxHoleSize gets filled in. Prevents
// scattered forests from being dotted with single-tile open holes.
export function fillSmallHoles(
  grid: Uint8Array,
  targetByte: number,
  replacementForHoles: number,
  W: number,
  H: number,
  maxHoleSize: number,
): number {
  // Find all holes: 4-connected components of non-target tiles that do
  // not touch the map edge (interior holes only).
  const clusters = floodComponents(W, H, (i) => grid[i] !== targetByte);
  let filled = 0;
  for (const c of clusters) {
    if (c.tiles.length > maxHoleSize) continue;
    let touchesEdge = false;
    for (const t of c.tiles) {
      const x = t % W;
      const y = (t - x) / W;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
        touchesEdge = true;
        break;
      }
    }
    if (touchesEdge) continue;
    // All neighbors must already be targetByte for a "true" enclosed hole.
    let fullyEnclosed = true;
    for (const t of c.tiles) {
      const x = t % W;
      const y = (t - x) / W;
      const neighbors = [
        x > 0 ? t - 1 : t,
        x < W - 1 ? t + 1 : t,
        y > 0 ? t - W : t,
        y < H - 1 ? t + W : t,
      ];
      for (const n of neighbors) {
        if (grid[n] !== targetByte && !c.tiles.includes(n)) {
          fullyEnclosed = false;
          break;
        }
      }
      if (!fullyEnclosed) break;
    }
    if (!fullyEnclosed) continue;
    for (const t of c.tiles) grid[t] = replacementForHoles;
    filled += c.tiles.length;
  }
  return filled;
}
