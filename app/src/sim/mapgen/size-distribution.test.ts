// COA-3 #63 — size distribution buckets + dilation + holes.

import { describe, expect, it } from 'vitest';
import {
  checkSizeBuckets,
  DEFAULT_BUCKETS,
  dilateOnce,
  fillSmallHoles,
  growUnderpopulated,
} from './size-distribution';

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
    expect(grid[3 * W + 2]).toBe(1);
    expect(grid[3 * W + 4]).toBe(1);
    expect(grid[2 * W + 3]).toBe(1);
    expect(grid[4 * W + 3]).toBe(1);
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
