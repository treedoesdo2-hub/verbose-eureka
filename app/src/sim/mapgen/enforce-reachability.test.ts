// COA-3 #62 — BFS + corridor carving.

import { describe, expect, it } from 'vitest';
import { bfsFootReachable, enforceReachability } from './enforce-reachability';
import { WALK_FOOT } from '../world';

describe('enforce-reachability — BFS + corridor carving', () => {
  it('bfsFootReachable visits every connected foot-passable tile', () => {
    const W = 8;
    const H = 8;
    const walk = new Uint16Array(W * H).fill(WALK_FOOT);
    for (let y = 0; y < H; y++) {
      for (let x = 4; x < W; x++) walk[y * W + x] = 0;
    }
    const visited = bfsFootReachable(walk, W, H, 0, 0);
    let count = 0;
    for (let i = 0; i < visited.length; i++) if (visited[i]) count++;
    expect(count).toBe(4 * H);
  });

  it('enforceReachability carves a corridor when a seed is disconnected', () => {
    const W = 12;
    const H = 12;
    const walk = new Uint16Array(W * H).fill(WALK_FOOT);
    const base = new Uint8Array(W * H);
    const point = new Uint8Array(W * H);
    const buildingId = new Uint16Array(W * H);
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
