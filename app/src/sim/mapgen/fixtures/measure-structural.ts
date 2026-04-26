// Structural metrics (#277).
//
// Density metrics (forest_pct, building_pct, …) only catch coverage-level
// regressions. They miss the structural complaint the user raised
// 2026-04-23: "buildings are littered everywhere", "trees are scattered",
// "no road network". A 30%-building urban map can still read as
// chicken-pox if those buildings are 1-tile splatters instead of clusters.
//
// This module measures the shape of the content. Connected-component
// analysis on building / forest / road / hedge tile sets gives:
//   - cluster_count: how many distinct blobs?
//   - mean_cluster_size: are blobs villages or splatters?
//   - largest_cluster_pct: does any single cluster dominate?
//   - road_reaches_edge: can the dominant road exit the map (march-entry
//     prereq for spawn placer + scenario AI)?
//
// Used by structural-fidelity tests to gate "looks like a village, not
// chicken pox" properties without needing Firefight blob-detector ground
// truth.

import { byteToBase, byteToPoint, BARRIER_KINDS } from '../../world';
import type { MapGenResult } from '../types';

const TREE_POINT_KINDS = new Set([
  'tree_forest',
  'tree_fruit',
  'tree_jungle',
  'tree_oak',
  'tree_poplar',
  'tree_snow',
]);

const HEDGE_KIND_BYTES = new Set(
  BARRIER_KINDS.map((k, i) => (k === 'hedge' || k === 'bocage' ? i + 1 : -1)).filter((v) => v > 0),
);

function extractBarrierKind(edgeByte: number): number {
  return edgeByte & 0x0f;
}

export type ClusterStats = {
  readonly count: number;
  readonly meanSize: number;
  readonly largestSize: number;
  readonly totalTiles: number;
};

export type StructuralMetrics = {
  readonly buildings: ClusterStats;
  readonly forests: ClusterStats;
  readonly roads: ClusterStats;
  readonly hedges: ClusterStats;
  readonly roadReachesEdge: boolean;
};

// 4-connected flood fill over a boolean grid. Returns one entry per
// connected component, value = tile count.
function clusterSizes(mask: Uint8Array, W: number, H: number): number[] {
  const N = W * H;
  const visited = new Uint8Array(N);
  const stack = new Int32Array(N);
  const sizes: number[] = [];
  for (let i = 0; i < N; i += 1) {
    if (visited[i] || !mask[i]) continue;
    let top = 0;
    stack[top++] = i;
    let size = 0;
    while (top > 0) {
      const p = stack[--top];
      if (visited[p]) continue;
      visited[p] = 1;
      if (!mask[p]) continue;
      size += 1;
      const x = p % W;
      const y = (p - x) / W;
      if (x > 0 && !visited[p - 1]) stack[top++] = p - 1;
      if (x < W - 1 && !visited[p + 1]) stack[top++] = p + 1;
      if (y > 0 && !visited[p - W]) stack[top++] = p - W;
      if (y < H - 1 && !visited[p + W]) stack[top++] = p + W;
    }
    if (size > 0) sizes.push(size);
  }
  return sizes;
}

function statsFromSizes(sizes: number[]): ClusterStats {
  if (sizes.length === 0) {
    return { count: 0, meanSize: 0, largestSize: 0, totalTiles: 0 };
  }
  let total = 0;
  let largest = 0;
  for (const s of sizes) {
    total += s;
    if (s > largest) largest = s;
  }
  return {
    count: sizes.length,
    meanSize: total / sizes.length,
    largestSize: largest,
    totalTiles: total,
  };
}

export function measureStructural(result: MapGenResult): StructuralMetrics {
  const { width: W, height: H, base, point, buildingId, edgeN, edgeW } = result;
  const N = W * H;

  // Build per-feature masks.
  const buildingMask = new Uint8Array(N);
  const forestMask = new Uint8Array(N);
  const roadMask = new Uint8Array(N);
  const hedgeTileMask = new Uint8Array(N);

  for (let i = 0; i < N; i += 1) {
    if (buildingId[i] > 0) buildingMask[i] = 1;
    const pk = byteToPoint(point[i]);
    if (pk && TREE_POINT_KINDS.has(pk)) forestMask[i] = 1;
    if (byteToBase(base[i]) === 'road') roadMask[i] = 1;
    if (
      HEDGE_KIND_BYTES.has(extractBarrierKind(edgeN[i])) ||
      HEDGE_KIND_BYTES.has(extractBarrierKind(edgeW[i]))
    ) {
      hedgeTileMask[i] = 1;
    }
  }

  // Road-reaches-edge: any road tile sitting on row 0 / row H-1 / col 0 /
  // col W-1 means an external entry exists. Required so spawn placer's
  // road-march logic has a usable edge endpoint.
  let roadReachesEdge = false;
  for (let x = 0; x < W && !roadReachesEdge; x += 1) {
    if (roadMask[x] || roadMask[(H - 1) * W + x]) roadReachesEdge = true;
  }
  for (let y = 0; y < H && !roadReachesEdge; y += 1) {
    if (roadMask[y * W] || roadMask[y * W + W - 1]) roadReachesEdge = true;
  }

  return {
    buildings: statsFromSizes(clusterSizes(buildingMask, W, H)),
    forests: statsFromSizes(clusterSizes(forestMask, W, H)),
    roads: statsFromSizes(clusterSizes(roadMask, W, H)),
    hedges: statsFromSizes(clusterSizes(hedgeTileMask, W, H)),
    roadReachesEdge,
  };
}
