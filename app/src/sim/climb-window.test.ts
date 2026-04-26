// Climb-window integration tests (#275 increment 2 / ADR 017).
//
// A foot unit attempting to step across an intact-window edge transitions
// into a 'climbing' action, finishes ~3 seconds later, breaks the window
// to WINDOW_BROKEN, and ends up on the destination tile. Subsequent units
// can pass freely because broken windows aren't gated.

import { asUnitId } from '@shared/ids';
import { makeContent, makeWeapon } from '@test-helpers/fixtures';
import { describe, expect, it } from 'vitest';
import { deriveCombatProfile } from './loadout';
import { RecordingSim } from './replay';
import { SIM_HZ } from './state';
import { makeInitialState } from './tick';
import { makeUnit } from './unit';
import {
  EDGE_OVERRIDE_WINDOW_BROKEN,
  EDGE_OVERRIDE_WINDOW_INTACT,
  edgeBlocksMovement,
  makeWorld,
} from './world';

const ar = makeWeapon({
  id: 'test-ar',
  name: 'AR',
  baseAccuracy: 70,
  magazineSize: 30,
  reloadSeconds: 2,
});
const content = makeContent([ar], []);

function setupWorldAndUnit() {
  const world = makeWorld(10, 10, 1);
  // Stamp an intact window on the north edge of (5, 5).
  world.edgeOverrideN[5 * 10 + 5] = EDGE_OVERRIDE_WINDOW_INTACT;
  // Unit at tile (5, 4), tasked to walk south into the building.
  // makeUnit always initialises action=idle; override to a moving action
  // post-construction since the test scenario starts mid-move.
  const unit = {
    ...makeUnit({
      id: asUnitId(1),
      teamId: 0,
      operatorId: null,
      position: { x: 5.5, y: 4.5 },
      facing: Math.PI / 2,
      combat: deriveCombatProfile(
        { items: [{ type: 'weapon', id: ar.id, zone: 'right_hand' }] },
        content,
      ),
      waypoints: [{ x: 5.5, y: 5.5 }],
    }),
    action: { kind: 'moving' as const, target: { x: 5.5, y: 5.5 } },
  };
  return { world, unit };
}

describe('climb-window mechanic (#275)', () => {
  it('intact window initially blocks foot crossing', () => {
    const { world } = setupWorldAndUnit();
    expect(edgeBlocksMovement(world, 5, 4, 5, 5, 'foot')).toBe(true);
  });

  it('a foot unit triggers climbing when about to cross an intact window', () => {
    const { world, unit } = setupWorldAndUnit();
    const state = makeInitialState(world, 1, [unit]);
    const sim = new RecordingSim(state, 1);
    sim.step();
    const u = sim.current().units.get(unit.id);
    if (!u) throw new Error('unit lost');
    expect(u.action.kind).toBe('climbing');
  });

  it('climb completes after ~3 seconds, breaks window, teleports unit across', () => {
    const { world, unit } = setupWorldAndUnit();
    const state = makeInitialState(world, 1, [unit]);
    const sim = new RecordingSim(state, 1);
    // Run enough ticks to start + finish the climb (3s + slop at 30Hz).
    for (let i = 0; i < SIM_HZ * 4; i += 1) sim.step();
    const final = sim.current();
    const u = final.units.get(unit.id);
    if (!u) throw new Error('unit lost');
    expect(u.action.kind).not.toBe('climbing');
    // Unit ended up on the destination tile (or close to it — the BT may
    // already have re-decided what to do once climbing finished).
    expect(Math.floor(u.position.y)).toBeGreaterThanOrEqual(5);
    // Window is broken.
    expect(final.world.edgeOverrideN[5 * 10 + 5]).toBe(EDGE_OVERRIDE_WINDOW_BROKEN);
    // Subsequent crossings are free.
    expect(edgeBlocksMovement(final.world, 5, 4, 5, 5, 'foot')).toBe(false);
  });
});
