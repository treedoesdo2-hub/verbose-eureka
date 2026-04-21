import { asUnitId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import { RecordingSim } from './replay';
import { SIM_HZ } from './state';
import { LAST_SEEN_TTL_TICKS, makeInitialState } from './tick';

// ALERT_DECAY_TICKS is declared in ai/bt.ts; re-derived here to keep the test
// readable without a cross-import of an AI-internal constant.
const ALERT_DECAY_TICKS = SIM_HZ * 120;

import { makeUnit } from './unit';
import { makeWorld } from './world';

describe('last-seen memory', () => {
  it('records a last-seen entry when a unit perceives an enemy', () => {
    const world = makeWorld(64, 64, 1);
    const a = makeUnit({
      id: asUnitId(1),
      teamId: 0,
      operatorId: null,
      position: { x: 10, y: 10 },
      facing: 0,
    });
    const b = makeUnit({
      id: asUnitId(2),
      teamId: 1,
      operatorId: null,
      position: { x: 15, y: 10 },
      facing: Math.PI,
    });
    const state = makeInitialState(world, 1, [a, b]);
    const sim = new RecordingSim(state, 1);

    // One tick is enough to perceive a target at 5 m inside a focused cone.
    sim.step();
    const observer = sim.current().units.get(asUnitId(1));
    if (!observer) throw new Error('observer missing');
    const seen = observer.lastSeen.get(asUnitId(2));
    expect(seen).toBeDefined();
    expect(seen?.pos.x).toBeCloseTo(15);
    expect(seen?.tick).toBe(0);
  });

  it('expires a last-seen entry after LAST_SEEN_TTL_TICKS once the target is gone', () => {
    const world = makeWorld(64, 64, 1);
    const a = makeUnit({
      id: asUnitId(1),
      teamId: 0,
      operatorId: null,
      position: { x: 10, y: 10 },
      facing: 0,
    });
    // No enemy yet — seed the lastSeen map directly.
    const unitWithMemory = {
      ...a,
      lastSeen: new Map([[asUnitId(99), { pos: { x: 20, y: 10 }, tick: 0 }]]),
    };
    const state = makeInitialState(world, 1, [unitWithMemory]);
    const sim = new RecordingSim(state, 1);

    // One tick after TTL — memory should be gone.
    for (let i = 0; i < LAST_SEEN_TTL_TICKS + 2; i++) sim.step();

    const obs = sim.current().units.get(asUnitId(1));
    if (!obs) throw new Error('observer missing');
    expect(obs.lastSeen.size).toBe(0);
  });
});

describe('alert decay', () => {
  it('clears alerted flag after ALERT_DECAY_TICKS with no new alert signals', () => {
    const world = makeWorld(64, 64, 1);
    const a = {
      ...makeUnit({
        id: asUnitId(1),
        teamId: 0,
        operatorId: null,
        position: { x: 10, y: 10 },
        facing: 0,
      }),
      alerted: true,
      lastAlertedTick: 0,
    };
    const state = makeInitialState(world, 1, [a]);
    const sim = new RecordingSim(state, 1);

    // Fewer than decay ticks: still alerted.
    for (let i = 0; i < ALERT_DECAY_TICKS - SIM_HZ; i++) sim.step();
    expect(sim.current().units.get(asUnitId(1))?.alerted).toBe(true);

    // Past the decay window with no enemies in sight: flag drops.
    for (let i = 0; i < SIM_HZ * 5; i++) sim.step();
    expect(sim.current().units.get(asUnitId(1))?.alerted).toBe(false);
  });
});
