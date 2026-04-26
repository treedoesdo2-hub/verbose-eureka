// ADR 016 ammo task #281.09 — unit-runs-dry sim tests.
//
// Validates the magazine-stack semantics that replaced the legacy `Unit.ammo`
// scalar:
//   - `isDryWeapon` / `totalRoundsCarried` helpers.
//   - The defensive `unit-reload-failed` event when reload completes with an
//     empty spare-mag stack.
//   - The BT dry-weapon gate prevents an infinite reload loop when the
//     operator has truly run out of ammo.

import { asUnitId } from '@shared/ids';
import { makeContent, makeWeapon } from '@test-helpers/fixtures';
import { describe, expect, it } from 'vitest';
import { deriveCombatProfile } from './loadout';
import { RecordingSim } from './replay';
import { SIM_HZ } from './state';
import { makeInitialState } from './tick';
import { isDryWeapon, makeUnit, totalRoundsCarried } from './unit';
import { makeWorld } from './world';

const ar = makeWeapon({
  id: 'test-ar',
  name: 'AR',
  baseAccuracy: 70,
  magazineSize: 5,
  reloadSeconds: 1,
});
const content = makeContent([ar], []);

function unitWithLoadout(id: number, teamId: number, x: number, y: number, facing: number) {
  return makeUnit({
    id: asUnitId(id),
    teamId,
    operatorId: null,
    position: { x, y },
    facing,
    combat: deriveCombatProfile(
      { items: [{ type: 'weapon', id: ar.id, zone: 'right_hand' }] },
      content,
    ),
  });
}

describe('isDryWeapon', () => {
  it('is true when ammo=0 and no spare mags', () => {
    const u = unitWithLoadout(1, 0, 0, 0, 0);
    const dry = { ...u, ammo: 0, mags: [] };
    expect(isDryWeapon(dry)).toBe(true);
  });

  it('is false when spare mags remain even if loaded ammo is 0', () => {
    const u = unitWithLoadout(1, 0, 0, 0, 0);
    const reloadable = { ...u, ammo: 0, mags: [{ ammoId: null, rounds: 30 }] };
    expect(isDryWeapon(reloadable)).toBe(false);
  });

  it('is false when ammo is loaded even if no spare mags', () => {
    const u = unitWithLoadout(1, 0, 0, 0, 0);
    const lastMag = { ...u, ammo: 5, mags: [] };
    expect(isDryWeapon(lastMag)).toBe(false);
  });
});

describe('totalRoundsCarried', () => {
  it('sums loaded rounds plus all spare mags', () => {
    const u = unitWithLoadout(1, 0, 0, 0, 0);
    const stocked = {
      ...u,
      ammo: 12,
      mags: [
        { ammoId: null, rounds: 30 },
        { ammoId: null, rounds: 30 },
        { ammoId: null, rounds: 7 },
      ],
    };
    expect(totalRoundsCarried(stocked)).toBe(12 + 30 + 30 + 7);
  });

  it('returns 0 for a fully dry unit', () => {
    const u = unitWithLoadout(1, 0, 0, 0, 0);
    expect(totalRoundsCarried({ ...u, ammo: 0, mags: [] })).toBe(0);
  });
});

describe('unit-reload-failed event', () => {
  it('fires when reload completes with an empty mag stack', () => {
    const world = makeWorld(40, 40, 1);
    const u = unitWithLoadout(1, 0, 10, 10, 0);
    const dryReloading = {
      ...u,
      ammo: 0,
      mags: [],
      // ticksRemaining=1 lets the BT decrement it to 0 this tick, leaving
      // the action as `reloading` for processReload to finalize.
      action: { kind: 'reloading' as const, ticksRemaining: 1 },
    };
    const state = makeInitialState(world, 1, [dryReloading]);
    const sim = new RecordingSim(state, 1);
    sim.step();
    const next = sim.current();
    const reloadFailed = next.events.filter((e) => e.kind === 'unit-reload-failed');
    expect(reloadFailed).toHaveLength(1);
    expect(reloadFailed[0]).toMatchObject({ unitId: asUnitId(1), kind: 'unit-reload-failed' });
    const final = next.units.get(asUnitId(1));
    expect(final?.action.kind).not.toBe('reloading');
    expect(final?.ammo).toBe(0);
  });

  it('does not fire when reload completes with a spare mag available', () => {
    const world = makeWorld(40, 40, 1);
    const u = unitWithLoadout(1, 0, 10, 10, 0);
    const reloadingWithSpare = {
      ...u,
      ammo: 0,
      mags: [{ ammoId: null, rounds: 5 }],
      action: { kind: 'reloading' as const, ticksRemaining: 1 },
    };
    const state = makeInitialState(world, 1, [reloadingWithSpare]);
    const sim = new RecordingSim(state, 1);
    sim.step();
    const next = sim.current();
    expect(next.events.some((e) => e.kind === 'unit-reload-failed')).toBe(false);
    const final = next.units.get(asUnitId(1));
    expect(final?.ammo).toBe(5);
    expect(final?.mags).toHaveLength(0);
  });
});

describe('dry weapon does not loop reload', () => {
  it('a unit with ammo=0 and no spare mags never enters a reloading action', () => {
    const world = makeWorld(80, 80, 1);
    // Two opposing units within sight so the BT engagement branch would
    // normally fire. Unit 1 starts dry; unit 2 has rounds. Unit 1 should
    // fall through to non-engagement behavior, not infinite-loop reload.
    const dry = (() => {
      const u = unitWithLoadout(1, 0, 10, 20, 0);
      return { ...u, ammo: 0, mags: [] };
    })();
    const armed = unitWithLoadout(2, 1, 25, 20, Math.PI);
    const state = makeInitialState(world, 1, [dry, armed]);
    const sim = new RecordingSim(state, 1);
    let reloadStartTicks = 0;
    for (let i = 0; i < SIM_HZ * 10; i++) {
      sim.step();
      const u1 = sim.current().units.get(asUnitId(1));
      if (u1 && u1.action.kind === 'reloading') reloadStartTicks++;
      if (sim.current().ended) break;
    }
    expect(reloadStartTicks).toBe(0);
  });
});
