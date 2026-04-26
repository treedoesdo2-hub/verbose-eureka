// Edge-barrier movement regression tests (#276).
//
// Per-edge barriers (hedge, bocage, stone walls, fences, wire) used to be
// ignored by both A* and tick-level movement: an open tile next to an open
// tile was always passable, regardless of whether a stone wall sat on the
// shared edge. This file proves that's no longer the case.

import { describe, expect, it } from 'vitest';
import { findPathTiles } from './pathfinding';
import { edgeBlocksMovement, encodeBarrier, makeWorld } from './world';

// 10x10 open world, then stamp a north-edge barrier across an interior
// row so the only horizontal path requires either going through the
// barrier (must NOT happen) or detouring around it.
function worldWithHorizontalWall(barrierKind: Parameters<typeof encodeBarrier>[0]) {
  const world = makeWorld(10, 10, 1);
  // North edge of row 5, columns 0..7 — leaves a gap at columns 8-9.
  const byte = encodeBarrier(barrierKind, false);
  for (let x = 0; x <= 7; x++) {
    world.edgeN[5 * 10 + x] = byte;
  }
  return world;
}

describe('edge-barrier movement (#276)', () => {
  it('stone_wall_low blocks foot movement across the edge', () => {
    const world = worldWithHorizontalWall('stone_wall_low');
    // Step from (3, 4) → (3, 5) crosses the wall (the wall sits on the
    // north edge of row 5).
    expect(edgeBlocksMovement(world, 3, 4, 3, 5, 'foot')).toBe(true);
    // Reverse direction also blocked.
    expect(edgeBlocksMovement(world, 3, 5, 3, 4, 'foot')).toBe(true);
    // Lateral move on the same side of the wall is fine.
    expect(edgeBlocksMovement(world, 3, 4, 4, 4, 'foot')).toBe(false);
    // Stepping at the gap (column 8 has no wall above row 5) is fine.
    expect(edgeBlocksMovement(world, 8, 4, 8, 5, 'foot')).toBe(false);
  });

  it('hedge does NOT block foot movement (walkable-slow)', () => {
    const world = worldWithHorizontalWall('hedge');
    // Hedges slow you but don't stop you — squads push through.
    expect(edgeBlocksMovement(world, 3, 4, 3, 5, 'foot')).toBe(false);
  });

  it('bocage blocks foot but not mech / power_armor', () => {
    const world = worldWithHorizontalWall('bocage');
    expect(edgeBlocksMovement(world, 3, 4, 3, 5, 'foot')).toBe(true);
    expect(edgeBlocksMovement(world, 3, 4, 3, 5, 'prone')).toBe(true);
    expect(edgeBlocksMovement(world, 3, 4, 3, 5, 'mech')).toBe(false);
    expect(edgeBlocksMovement(world, 3, 4, 3, 5, 'power_armor')).toBe(false);
    // Wheeled / tracked still blocked — they'd have to crash through.
    expect(edgeBlocksMovement(world, 3, 4, 3, 5, 'wheeled')).toBe(true);
    expect(edgeBlocksMovement(world, 3, 4, 3, 5, 'tracked')).toBe(true);
  });

  it('damaged stone wall is walkable (DAMAGED_AXES override)', () => {
    const world = makeWorld(10, 10, 1);
    // Damaged flag set (high nibble bit 4 of the barrier byte).
    world.edgeN[5 * 10 + 3] = encodeBarrier('stone_wall_low', true);
    expect(edgeBlocksMovement(world, 3, 4, 3, 5, 'foot')).toBe(false);
  });

  it('diagonal move requires at least one clear L-path', () => {
    const world = makeWorld(10, 10, 1);
    // Stamp an L-shape that blocks BOTH diagonals from (3,4) to (4,5):
    //   north edge of (4,5) blocks the (3,4)→(4,4)→(4,5) path
    //   west  edge of (4,5) blocks the (3,4)→(3,5)→(4,5) path
    const wall = encodeBarrier('stone_wall_low', false);
    world.edgeN[5 * 10 + 4] = wall;
    world.edgeW[5 * 10 + 4] = wall;
    expect(edgeBlocksMovement(world, 3, 4, 4, 5, 'foot')).toBe(true);

    // Now drop one of the two walls: the diagonal opens via the unblocked L.
    const world2 = makeWorld(10, 10, 1);
    world2.edgeN[5 * 10 + 4] = wall; // only the N edge has a wall
    expect(edgeBlocksMovement(world2, 3, 4, 4, 5, 'foot')).toBe(false);
  });

  it('A* routes around a wall instead of through it', () => {
    const world = worldWithHorizontalWall('stone_wall_low');
    const path = findPathTiles(world, 3, 1, 3, 8);
    expect(path.length).toBeGreaterThan(0);
    // The path must visit the gap at columns 8-9 — there's no other way
    // through. (Tiles in path are in meter-space tile centers; floor-x
    // recovers the tile column.)
    const visitsGap = path.some((p) => Math.floor(p.x) >= 8);
    expect(visitsGap).toBe(true);
  });
});
