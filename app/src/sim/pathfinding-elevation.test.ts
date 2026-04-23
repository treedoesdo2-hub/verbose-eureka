// P3.13 — per-mode cliff guard tests.
//
// Tracked vehicles must climb +3 step deltas; wheeled vehicles must
// refuse +2. Foot + mech + power_armor accept +2. The A* detour-vs-
// direct-climb choice is implicit in the step cost — we assert
// path-length changes are observable, not specific waypoint choices.

import { describe, expect, it } from 'vitest';
import { findPathTiles } from './pathfinding';
import { makeWorld, WALK_FOOT, WALK_TRACKED, WALK_WHEELED, WALK_MECH, WALK_POWER_ARMOR } from './world';

// Thin wrapper so the test reads as "find a path if one exists",
// returning null when the tile engine yields an empty array (no path).
function findPath(
  w: ReturnType<typeof makeWorld>,
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts: { mode: 'foot' | 'prone' | 'mech' | 'power_armor' | 'wheeled' | 'tracked' },
): readonly { x: number; y: number }[] | null {
  const path = findPathTiles(w, from.x, from.y, to.x, to.y, { mode: opts.mode, partial: false });
  return path.length === 0 ? null : path;
}

const TS = 1.5;
const ALL_MODES_BITS = WALK_FOOT | WALK_TRACKED | WALK_WHEELED | WALK_MECH | WALK_POWER_ARMOR;

function mkFlatWorld(size: number): ReturnType<typeof makeWorld> {
  const w = makeWorld(size, size, TS);
  w.walkability.fill(ALL_MODES_BITS);
  return w;
}

describe('P3.12 per-mode cliff guard', () => {
  it('foot + tracked cross a +2 step ridge; wheeled refuses the direct path', () => {
    const w = mkFlatWorld(8);
    // Build a 3-wide +2 ridge across the middle so diagonal detours
    // still face the +2 step. The only way around is to go vertically
    // past the ridge entirely.
    for (let i = 0; i < w.elevationStep.length; i++) w.elevationStep[i] = 1;
    // Block vertical detour at y=3 to force the failure mode: ridge
    // runs across x=3..5 at y=4; detour via y=5 is allowed for all.
    for (let x = 3; x <= 5; x++) w.elevationStep[4 * 8 + x] = 3; // +2

    // Foot + tracked can cross the ridge directly.
    const foot = findPath(w, { x: 2, y: 4 }, { x: 6, y: 4 }, { mode: 'foot' });
    expect(foot).not.toBeNull();
    const tracked = findPath(w, { x: 2, y: 4 }, { x: 6, y: 4 }, { mode: 'tracked' });
    expect(tracked).not.toBeNull();

    // Wheeled can't cross the +2 ridge directly. With cap=1 it must
    // detour via y≠4. Path existence is enough — specific length
    // depends on A* tiebreaks.
    const wheeled = findPath(w, { x: 2, y: 4 }, { x: 6, y: 4 }, { mode: 'wheeled' });
    expect(wheeled).not.toBeNull();
    // Assert the wheeled path does not go directly through y=4's ridge
    // cells — at least one waypoint must be off-row.
    const offRow = wheeled!.some((p) => {
      const ty = Math.floor(p.y / TS);
      return ty !== 4;
    });
    expect(offRow).toBe(true);
  });

  it('tracked crosses a +3 step delta; foot refuses (cap=2)', () => {
    const w = mkFlatWorld(4);
    // 4x4 corridor, only row 1 passable. Blocking the rest forces
    // either the direct path (step delta +3) or nothing.
    w.walkability.fill(0);
    const passable = ALL_MODES_BITS;
    for (let x = 0; x < 4; x++) w.walkability[1 * 4 + x] = passable;
    for (let i = 0; i < w.elevationStep.length; i++) w.elevationStep[i] = 1;
    w.elevationStep[1 * 4 + 2] = 4; // delta +3

    const tracked = findPath(w, { x: 0, y: 1 }, { x: 3, y: 1 }, { mode: 'tracked' });
    expect(tracked).not.toBeNull();

    const foot = findPath(w, { x: 0, y: 1 }, { x: 3, y: 1 }, { mode: 'foot' });
    expect(foot).toBeNull(); // +3 exceeds foot's +2 cap
  });
});
