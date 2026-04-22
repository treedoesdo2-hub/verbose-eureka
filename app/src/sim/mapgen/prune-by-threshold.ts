// COA-3 task #55 — generic prune-by-threshold, replacing the bespoke
// removeSmallWaterIslands. The pipeline now prunes any base byte, point
// byte, or barrier byte through a single function driven by the
// thresholds table.

import { floodComponents, pruneElongatedClusters, pruneSmallClusters } from './cluster-prune';
import type { ClusterInfo } from './cluster-prune';
import {
  BASE_THRESHOLDS,
  BARRIER_THRESHOLDS,
  POINT_THRESHOLDS,
  type ClusterThresholds,
} from './thresholds';

export type PruneReport = {
  readonly clustersFound: number;
  readonly clustersPruned: number;
  readonly tilesPruned: number;
};

// Prune a base-byte layer by a single kind (e.g., water_deep islands
// smaller than BASE_THRESHOLDS['water_deep'].minSize get converted to
// `replacement`).
export function pruneBaseByKind(
  base: Uint8Array,
  W: number,
  H: number,
  targetByte: number,
  replacementByte: number,
  thresholds: ClusterThresholds = BASE_THRESHOLDS.water_deep,
): PruneReport {
  const clusters = floodComponents(W, H, (i) => base[i] === targetByte);
  let tilesPruned = 0;
  const mutator = (i: number) => {
    base[i] = replacementByte;
    tilesPruned++;
  };
  const prunedBySize = pruneSmallClusters(clusters, thresholds.minSize, mutator);
  const prunedByShape = pruneElongatedClusters(
    clusters,
    thresholds.maxElongation,
    mutator,
  );
  return {
    clustersFound: clusters.length,
    clustersPruned: prunedBySize + prunedByShape,
    tilesPruned,
  };
}

// Prune a point-byte layer — a tile-level sweep where each point kind's
// small clusters get cleared (byte → 0). Uses POINT_THRESHOLDS.
export function prunePointsByKind(
  point: Uint8Array,
  pointByte: number,
  W: number,
  H: number,
  thresholds: ClusterThresholds,
): PruneReport {
  const clusters = floodComponents(W, H, (i) => point[i] === pointByte);
  let tilesPruned = 0;
  const mutator = (i: number) => {
    point[i] = 0;
    tilesPruned++;
  };
  const prunedBySize = pruneSmallClusters(clusters, thresholds.minSize, mutator);
  return {
    clustersFound: clusters.length,
    clustersPruned: prunedBySize,
    tilesPruned,
  };
}

// Exhaustively prune all known kinds — one report per registered kind.
// Used by the pipeline's post-scatter sweep so a single call handles
// every kind. Returns { [kindLabel]: PruneReport }.
export function pruneByThresholdTable(
  base: Uint8Array,
  point: Uint8Array,
  W: number,
  H: number,
  baseByteResolver: (kind: keyof typeof BASE_THRESHOLDS) => number,
  pointByteResolver: (kind: keyof typeof POINT_THRESHOLDS) => number,
): Record<string, PruneReport> {
  const reports: Record<string, PruneReport> = {};
  // Only prune base kinds that have a non-default minSize — skipping
  // walkable ground saves a O(N) scan per kind.
  for (const kind of Object.keys(BASE_THRESHOLDS) as (keyof typeof BASE_THRESHOLDS)[]) {
    const t = BASE_THRESHOLDS[kind];
    if (t.minSize <= 1) continue;
    const byte = baseByteResolver(kind);
    const fill = baseByteResolver('open'); // prune replaces with open ground
    if (byte === fill) continue;
    reports[`base:${kind}`] = pruneBaseByKind(base, W, H, byte, fill, t);
  }
  for (const kind of Object.keys(POINT_THRESHOLDS) as (keyof typeof POINT_THRESHOLDS)[]) {
    const t = POINT_THRESHOLDS[kind];
    if (t.minSize <= 1) continue;
    const byte = pointByteResolver(kind);
    reports[`point:${kind}`] = prunePointsByKind(point, byte, W, H, t);
  }
  return reports;
}

// Barrier pruning — consumes an edge byte grid. For COA-4 integration
// once stampBarrierLine lands. Kept here for completeness of the
// threshold system.
export type BarrierPruneOpts = {
  readonly edgeBytes: Uint8Array;
  readonly W: number;
  readonly H: number;
  readonly targetByte: number;
  readonly thresholds: ClusterThresholds;
};

export function pruneBarrierByKind(opts: BarrierPruneOpts): PruneReport {
  const { edgeBytes, W, H, targetByte, thresholds } = opts;
  const clusters = floodComponents(W, H, (i) => (edgeBytes[i] & 0x0f) === (targetByte & 0x0f));
  let tilesPruned = 0;
  const mutator = (i: number) => {
    edgeBytes[i] = 0;
    tilesPruned++;
  };
  const prunedBySize = pruneSmallClusters(clusters, thresholds.minSize, mutator);
  return {
    clustersFound: clusters.length,
    clustersPruned: prunedBySize,
    tilesPruned,
  };
}

// Re-export of ClusterInfo for callers that want to introspect clusters
// before mutating.
export type { ClusterInfo };
// Keep the unused import suppressed by type-reference.
void BARRIER_THRESHOLDS;
