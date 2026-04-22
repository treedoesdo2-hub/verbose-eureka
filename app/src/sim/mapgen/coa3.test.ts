// COA-3 test battery — tasks #60-#64 combined.
// Covers clusterPrune, scatterFramework, enforceReachability,
// sizeDistribution, and thresholds table exhaustiveness.

import { describe, expect, it } from 'vitest';
import {
  BARRIER_THRESHOLDS,
  BASE_THRESHOLDS,
  POINT_THRESHOLDS,
  thresholdsFor,
} from './thresholds';
import {
  floodComponents,
  pruneElongatedClusters,
  pruneSmallClusters,
} from './cluster-prune';
import { makeDebugSink } from './debug-sink';
import {
  andValidators,
  ScatterRegistry,
  runScatterPass,
  V,
} from './scatter-framework';
import { makeRng } from './noise';
import { bfsFootReachable, enforceReachability } from './enforce-reachability';
import {
  checkSizeBuckets,
  DEFAULT_BUCKETS,
  dilateOnce,
  fillSmallHoles,
  growUnderpopulated,
} from './size-distribution';
import { WALK_FOOT } from '../world';

// ---------------------------------------------------------------------------
// #60 clusterPrune.test.ts — flood-fill + small/elongated pruning.

describe('cluster-prune — floodComponents + size/shape pruning', () => {
  it('finds all 4-connected components in a sparse grid', () => {
    const W = 6;
    const H = 6;
    const grid = new Uint8Array(W * H);
    // Two disjoint blobs: (1,1)-(1,2) and (4,4)-(5,4).
    grid[1 * W + 1] = 1;
    grid[1 * W + 2] = 1;
    grid[4 * W + 4] = 1;
    grid[4 * W + 5] = 1;
    const clusters = floodComponents(W, H, (i) => grid[i] === 1);
    expect(clusters.length).toBe(2);
    expect(clusters[0].tiles.length).toBe(2);
    expect(clusters[1].tiles.length).toBe(2);
  });

  it('pruneSmallClusters drops components below minSize', () => {
    const W = 8;
    const H = 8;
    const grid = new Uint8Array(W * H);
    grid[2 * W + 2] = 1; // 1-tile cluster
    grid[5 * W + 5] = 1;
    grid[5 * W + 6] = 1;
    grid[5 * W + 7] = 1;
    grid[6 * W + 5] = 1;
    // 5-tile cluster.
    const clusters = floodComponents(W, H, (i) => grid[i] === 1);
    expect(clusters.length).toBe(2);
    const pruned = pruneSmallClusters(clusters, 3, (i) => (grid[i] = 0));
    expect(pruned).toBe(1);
    expect(grid[2 * W + 2]).toBe(0);
    expect(grid[5 * W + 5]).toBe(1);
  });

  it('pruneElongatedClusters drops strips past the elongation cap', () => {
    const W = 16;
    const H = 4;
    const grid = new Uint8Array(W * H);
    // 8-tile horizontal strip, height 1 → elongation 8.
    for (let x = 2; x < 10; x++) grid[1 * W + x] = 1;
    const clusters = floodComponents(W, H, (i) => grid[i] === 1);
    const pruned = pruneElongatedClusters(clusters, 5, (i) => (grid[i] = 0));
    expect(pruned).toBe(1);
  });

  it('centroid approximates the mean of cluster tile coords', () => {
    const W = 8;
    const H = 8;
    const grid = new Uint8Array(W * H);
    grid[2 * W + 2] = 1;
    grid[2 * W + 3] = 1;
    grid[3 * W + 2] = 1;
    grid[3 * W + 3] = 1;
    const clusters = floodComponents(W, H, (i) => grid[i] === 1);
    expect(clusters.length).toBe(1);
    expect(clusters[0].centroidX).toBeCloseTo(2.5, 5);
    expect(clusters[0].centroidY).toBeCloseTo(2.5, 5);
  });
});

// ---------------------------------------------------------------------------
// #61 scatterFramework.test.ts — pass execution + validator chaining.

describe('scatter-framework — runScatterPass + validators', () => {
  it('runs a pass until target count is reached', () => {
    type Ctx = { width: number; height: number; placed: { x: number; y: number }[] };
    const ctx: Ctx = { width: 16, height: 16, placed: [] };
    const pass = {
      name: 'test-pass',
      targetCount: 5,
      maxAttempts: 100,
      picker: (_c: Ctx, rng: () => number) => ({
        x: Math.floor(rng() * 16),
        y: Math.floor(rng() * 16),
      }),
      validator: V.insideBounds<Ctx>(),
      onAccept: (c: Ctx, x: number, y: number) => {
        c.placed.push({ x, y });
      },
    };
    const rng = makeRng(42);
    const result = runScatterPass(pass, ctx, rng);
    expect(result.placed).toBe(5);
    expect(ctx.placed.length).toBe(5);
  });

  it('andValidators short-circuits on first rejection', () => {
    const v1 = V.insideBounds<{ width: number; height: number }>();
    const v2: (ctx: { width: number; height: number }, x: number, y: number) => boolean =
      (_ctx, x) => x % 2 === 0;
    const chained = andValidators(v1, v2);
    expect(chained({ width: 10, height: 10 }, 4, 5)).toBe(true);
    expect(chained({ width: 10, height: 10 }, 3, 5)).toBe(false);
    expect(chained({ width: 10, height: 10 }, -1, 5)).toBe(false);
  });

  it('minSpacingFromPlaced rejects overlapping candidates', () => {
    type Ctx = { width: number; height: number; placed: { x: number; y: number }[] };
    const ctx: Ctx = { width: 20, height: 20, placed: [{ x: 10, y: 10 }] };
    const v = V.minSpacingFromPlaced<Ctx>(3);
    expect(v(ctx, 10, 10)).toBe(false);
    expect(v(ctx, 11, 10)).toBe(false);
    expect(v(ctx, 15, 10)).toBe(true);
  });

  it('ScatterRegistry runs passes in order and returns per-pass results', () => {
    type Ctx = { width: number; height: number; placed: { x: number; y: number }[] };
    const ctx: Ctx = { width: 16, height: 16, placed: [] };
    const reg = new ScatterRegistry<Ctx>();
    for (let i = 0; i < 3; i++) {
      reg.add({
        name: `p${i}`,
        targetCount: 2,
        maxAttempts: 50,
        picker: (_c: Ctx, rng: () => number) => ({
          x: Math.floor(rng() * 16),
          y: Math.floor(rng() * 16),
        }),
        validator: V.insideBounds<Ctx>(),
        onAccept: (c: Ctx, x: number, y: number) => {
          c.placed.push({ x, y });
        },
      });
    }
    const rng = makeRng(7);
    const results = reg.runAll(ctx, rng);
    expect(results.length).toBe(3);
    expect(ctx.placed.length).toBe(6);
  });

  it('sink captures under-placement warnings', () => {
    type Ctx = { width: number; height: number };
    const ctx: Ctx = { width: 4, height: 4 };
    const sink = makeDebugSink();
    const result = runScatterPass(
      {
        name: 'hopeless',
        targetCount: 10,
        maxAttempts: 5, // way too few
        picker: () => null, // never picks
        validator: () => true,
        onAccept: () => {},
      },
      ctx,
      makeRng(1),
      sink,
    );
    expect(result.placed).toBe(0);
    expect(sink.warnings).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// #62 enforceReachability.test.ts — BFS + corridor carving.

describe('enforce-reachability — BFS + corridor carving', () => {
  it('bfsFootReachable visits every connected foot-passable tile', () => {
    const W = 8;
    const H = 8;
    const walk = new Uint16Array(W * H).fill(WALK_FOOT);
    // Block the right half.
    for (let y = 0; y < H; y++) {
      for (let x = 4; x < W; x++) walk[y * W + x] = 0;
    }
    const visited = bfsFootReachable(walk, W, H, 0, 0);
    let count = 0;
    for (let i = 0; i < visited.length; i++) if (visited[i]) count++;
    expect(count).toBe(4 * H); // only left half reachable
  });

  it('enforceReachability carves a corridor when a seed is disconnected', () => {
    const W = 12;
    const H = 12;
    const walk = new Uint16Array(W * H).fill(WALK_FOOT);
    const base = new Uint8Array(W * H);
    const point = new Uint8Array(W * H);
    const buildingId = new Uint16Array(W * H);
    // Block column x=6.
    for (let y = 0; y < H; y++) walk[y * W + 6] = 0;
    const report = enforceReachability(
      walk,
      base,
      point,
      buildingId,
      W,
      H,
      [
        { label: 'team0', seedTileX: 2, seedTileY: 6 },
        { label: 'team1', seedTileX: 10, seedTileY: 6 },
      ],
      0,
    );
    expect(report.disconnectedRegions).toContain('team1');
    expect(report.carvedTiles).toBeGreaterThan(0);
    // After carving, team1 is reachable from team0.
    const visitedAfter = bfsFootReachable(walk, W, H, 2, 6);
    expect(visitedAfter[6 * W + 10]).toBe(1);
  });

  it('reports allReachable=true when no carving is needed', () => {
    const W = 8;
    const H = 8;
    const walk = new Uint16Array(W * H).fill(WALK_FOOT);
    const base = new Uint8Array(W * H);
    const point = new Uint8Array(W * H);
    const buildingId = new Uint16Array(W * H);
    const r = enforceReachability(
      walk,
      base,
      point,
      buildingId,
      W,
      H,
      [
        { label: 'team0', seedTileX: 1, seedTileY: 1 },
        { label: 'team1', seedTileX: 6, seedTileY: 6 },
      ],
      0,
    );
    expect(r.allReachable).toBe(true);
    expect(r.carvedTiles).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// #63 sizeDistribution.test.ts — buckets + dilation + hole-pruning.

describe('size-distribution — buckets + dilation + holes', () => {
  it('checkSizeBuckets correctly bins clusters by tile count', () => {
    const clusters = [
      { id: 0, tiles: [0, 1], minX: 0, minY: 0, maxX: 0, maxY: 0, centroidX: 0, centroidY: 0 },
      { id: 1, tiles: Array(20).fill(0), minX: 0, minY: 0, maxX: 0, maxY: 0, centroidX: 0, centroidY: 0 },
    ];
    const r = checkSizeBuckets(clusters, DEFAULT_BUCKETS);
    expect(r.totalClusters).toBe(2);
    expect(r.buckets.find((b) => b.bucket.label === 'tiny')?.actual).toBe(1);
    expect(r.buckets.find((b) => b.bucket.label === 'medium')?.actual).toBe(1);
  });

  it('dilateOnce grows the target set by 1 tile on borders', () => {
    const W = 8;
    const H = 8;
    const grid = new Uint8Array(W * H);
    grid[3 * W + 3] = 1;
    dilateOnce(grid, 1, W, H, (i) => (grid[i] = 1));
    // After one dilate, 4 neighbors of (3,3) become 1.
    expect(grid[3 * W + 2]).toBe(1);
    expect(grid[3 * W + 4]).toBe(1);
    expect(grid[2 * W + 3]).toBe(1);
    expect(grid[4 * W + 3]).toBe(1);
    // Diagonals are NOT touched by 4-conn dilation.
    expect(grid[2 * W + 2]).toBe(0);
  });

  it('growUnderpopulated expands a small cluster toward a desired total', () => {
    const W = 8;
    const H = 8;
    const grid = new Uint8Array(W * H);
    grid[4 * W + 4] = 1;
    const grown = growUnderpopulated(grid, 1, W, H, 8, 3);
    expect(grown).toBeGreaterThan(0);
    let total = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i] === 1) total++;
    expect(total).toBeGreaterThanOrEqual(5);
  });

  it('fillSmallHoles plugs enclosed single-tile holes', () => {
    const W = 5;
    const H = 5;
    const grid = new Uint8Array(W * H);
    // Fill ring around (2,2), leave center as hole.
    const target = 1;
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        if (x === 2 && y === 2) continue;
        grid[y * W + x] = target;
      }
    }
    const filled = fillSmallHoles(grid, target, target, W, H, 2);
    expect(filled).toBeGreaterThanOrEqual(1);
    expect(grid[2 * W + 2]).toBe(target);
  });
});

// ---------------------------------------------------------------------------
// #64 thresholds.test.ts — exhaustiveness + resolver sanity.

describe('thresholds — registry exhaustiveness', () => {
  it('every base terrain kind has a threshold entry', () => {
    // Fail at compile time if a kind is missing (Record<TerrainBase, ...>);
    // runtime check confirms the registry object is populated.
    const keys = Object.keys(BASE_THRESHOLDS);
    expect(keys.length).toBe(8);
  });

  it('every point kind has a threshold entry', () => {
    expect(Object.keys(POINT_THRESHOLDS).length).toBe(27);
  });

  it('every barrier kind has a threshold entry', () => {
    expect(Object.keys(BARRIER_THRESHOLDS).length).toBe(11);
  });

  it('thresholdsFor dispatches by kind', () => {
    expect(thresholdsFor({ kind: 'base', value: 'open' })).toEqual(BASE_THRESHOLDS.open);
    expect(thresholdsFor({ kind: 'point', value: 'tree_forest' })).toEqual(
      POINT_THRESHOLDS.tree_forest,
    );
    expect(thresholdsFor({ kind: 'barrier', value: 'hedge' })).toEqual(BARRIER_THRESHOLDS.hedge);
  });
});
