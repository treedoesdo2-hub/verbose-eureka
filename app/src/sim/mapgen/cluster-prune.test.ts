// COA-3 #60 — flood-fill + small/elongated cluster pruning.

import { describe, expect, it } from 'vitest';
import {
  floodComponents,
  pruneElongatedClusters,
  pruneSmallClusters,
} from './cluster-prune';

describe('cluster-prune — floodComponents + size/shape pruning', () => {
  it('finds all 4-connected components in a sparse grid', () => {
    const W = 6;
    const H = 6;
    const grid = new Uint8Array(W * H);
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
    grid[2 * W + 2] = 1;
    grid[5 * W + 5] = 1;
    grid[5 * W + 6] = 1;
    grid[5 * W + 7] = 1;
    grid[6 * W + 5] = 1;
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
