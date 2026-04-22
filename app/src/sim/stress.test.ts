import { asUnitId, asWoundId } from '@shared/ids';
import { makeWeapon, makeZoneDr } from '@test-helpers/fixtures';
import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { SIM_HZ, type SimEvent, type SimState } from './state';
import { makeInitialState, tick } from './tick';
import {
  MORALE_ALLY_DIED_LOSS,
  MORALE_ALLY_DOWN_LOSS,
  MORALE_PANIC_THRESHOLD,
  MORALE_RECOVER_THRESHOLD,
  makeUnit,
  SUPPRESSION_DECAY_PER_SEC,
  SUPPRESSION_HEAVY_THRESHOLD,
  SUPPRESSION_PER_SHOT,
  suppressionAimMultiplier,
  type Unit,
} from './unit';
import { makeWorld } from './world';

function combatUnit(id: number, teamId: number, pos: { x: number; y: number }): Unit {
  const u = makeUnit({
    id: asUnitId(id),
    teamId,
    operatorId: null,
    position: pos,
    facing: 0,
  });
  return {
    ...u,
    combat: {
      ...u.combat,
      primaryWeapon: makeWeapon({ baseAccuracy: 80, rpm: 300 }),
      zoneDr: makeZoneDr(),
    },
    ammo: 30,
  };
}

function advance(state: SimState, rng: Rng, ticks: number): SimState {
  let s = state;
  for (let i = 0; i < ticks; i++) s = tick(s, rng);
  return s;
}

function runCollectingEvents(
  state: SimState,
  rng: Rng,
  ticks: number,
): { state: SimState; events: SimEvent[] } {
  let s = state;
  const all: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    s = tick(s, rng);
    for (const e of s.events) all.push(e);
  }
  return { state: s, events: all };
}

function fatalBleedWound(id: number) {
  return {
    id: asWoundId(id),
    zone: 'torso_front' as const,
    type: 'gunshot' as const,
    severity: 'critical' as const,
    severityPct: 90,
    bleedRatePerSec: 1000,
    treatment: 'untreated' as const,
    tickInflicted: 0,
  };
}

describe('suppressionAimMultiplier', () => {
  it('is 1.0 at zero suppression, 0.5 at full, monotonic', () => {
    expect(suppressionAimMultiplier(0)).toBe(1);
    expect(suppressionAimMultiplier(100)).toBe(0.5);
    expect(suppressionAimMultiplier(50)).toBeGreaterThan(suppressionAimMultiplier(80));
  });

  it('clamps negative + over-100 inputs', () => {
    expect(suppressionAimMultiplier(-10)).toBe(1);
    expect(suppressionAimMultiplier(500)).toBe(0.5);
  });
});

describe('suppression accumulation + decay', () => {
  it('incoming fire raises target suppression', () => {
    const world = makeWorld(64, 64, 1);
    const shooter = {
      ...combatUnit(1, 0, { x: 5, y: 10 }),
      stats: { ...combatUnit(1, 0, { x: 5, y: 10 }).stats, aim: 80 },
    };
    const target = combatUnit(2, 1, { x: 8, y: 10 });
    // Force shooter into firing action so processFiring fires this tick.
    const firingShooter: Unit = {
      ...shooter,
      action: {
        kind: 'firing',
        targetId: target.id,
        roundsRemaining: 3,
        tickPer: 6,
        cooldown: 0,
      },
      currentTarget: target.id,
    };
    const state = makeInitialState(world, 1, [firingShooter, target]);
    const rng = new Rng(7);
    const next = tick(state, rng);
    const targetAfter = next.units.get(target.id);
    expect(targetAfter).toBeDefined();
    if (!targetAfter) throw new Error('target missing');
    // One shot bumps by SUPPRESSION_PER_SHOT minus one tick of decay.
    const expected = SUPPRESSION_PER_SHOT - SUPPRESSION_DECAY_PER_SEC / SIM_HZ;
    expect(targetAfter.suppression).toBeGreaterThan(expected - 0.1);
    expect(targetAfter.suppression).toBeLessThan(SUPPRESSION_PER_SHOT + 0.1);
  });

  it('decays toward zero when not under fire', () => {
    const world = makeWorld(64, 64, 1);
    const pinned: Unit = { ...combatUnit(1, 0, { x: 5, y: 5 }), suppression: 80 };
    const state = makeInitialState(world, 1, [pinned]);
    const rng = new Rng(8);
    // Two seconds of solitude: ~16 suppression decayed.
    const after = advance(state, rng, SIM_HZ * 2);
    const u = after.units.get(pinned.id);
    if (!u) throw new Error('unit missing');
    expect(u.suppression).toBeLessThan(80 - SUPPRESSION_DECAY_PER_SEC * 2 + 1);
    expect(u.suppression).toBeGreaterThan(80 - SUPPRESSION_DECAY_PER_SEC * 2 - 1);
  });

  it('emits unit-pinned when crossing the heavy threshold', () => {
    const world = makeWorld(64, 64, 1);
    // Already close to the threshold — one shot should push us across.
    const nearThreshold: Unit = {
      ...combatUnit(2, 1, { x: 8, y: 10 }),
      suppression: SUPPRESSION_HEAVY_THRESHOLD - 5,
    };
    const shooter: Unit = {
      ...combatUnit(1, 0, { x: 5, y: 10 }),
      action: {
        kind: 'firing',
        targetId: nearThreshold.id,
        roundsRemaining: 3,
        tickPer: 6,
        cooldown: 0,
      },
      currentTarget: nearThreshold.id,
    };
    const state = makeInitialState(world, 1, [shooter, nearThreshold]);
    const rng = new Rng(9);
    const next = tick(state, rng);
    expect(next.events.some((e) => e.kind === 'unit-pinned' && e.unitId === nearThreshold.id)).toBe(
      true,
    );
  });
});

describe('morale + panic', () => {
  it('drops morale on nearby ally down, emits unit-broke below panic threshold', () => {
    const world = makeWorld(64, 64, 1);
    // A hemorrhaging wound + low blood volume guarantees a unit-died event
    // this tick without depending on RNG or ballistic rolls.
    const doomed: Unit = {
      ...combatUnit(1, 0, { x: 10, y: 10 }),
      bloodVolume: 1,
      wounds: [fatalBleedWound(1)],
    };
    const witness: Unit = {
      ...combatUnit(2, 0, { x: 12, y: 10 }),
      morale: MORALE_PANIC_THRESHOLD + MORALE_ALLY_DIED_LOSS * 0.5,
    };
    const state = makeInitialState(world, 1, [doomed, witness]);
    const rng = new Rng(10);
    const next = tick(state, rng);
    expect(next.events.some((e) => e.kind === 'unit-died' && e.unitId === doomed.id)).toBe(true);
    const w = next.units.get(witness.id);
    if (!w) throw new Error('witness missing');
    expect(w.morale).toBeLessThan(witness.morale);
    expect(next.events.some((e) => e.kind === 'unit-broke' && e.unitId === witness.id)).toBe(true);
  });

  it('ignores ally drops outside the radius', () => {
    const world = makeWorld(128, 128, 1);
    const doomed: Unit = {
      ...combatUnit(1, 0, { x: 10, y: 10 }),
      bloodVolume: 1,
      wounds: [fatalBleedWound(1)],
    };
    const farAlly: Unit = {
      ...combatUnit(2, 0, { x: 60, y: 60 }),
      morale: 90,
    };
    const state = makeInitialState(world, 1, [doomed, farAlly]);
    const rng = new Rng(11);
    const next = tick(state, rng);
    const ally = next.units.get(farAlly.id);
    if (!ally) throw new Error('ally missing');
    expect(ally.morale).toBeGreaterThanOrEqual(90);
  });

  it('ignores enemy drops (morale shouldn’t swing because an enemy died)', () => {
    const world = makeWorld(64, 64, 1);
    const enemy: Unit = {
      ...combatUnit(1, 1, { x: 10, y: 10 }),
      bloodVolume: 1,
      wounds: [fatalBleedWound(1)],
    };
    const observer: Unit = { ...combatUnit(2, 0, { x: 12, y: 10 }), morale: 50 };
    const state = makeInitialState(world, 1, [enemy, observer]);
    const rng = new Rng(12);
    const next = tick(state, rng);
    const o = next.units.get(observer.id);
    if (!o) throw new Error('observer missing');
    expect(o.morale).toBeGreaterThanOrEqual(50);
  });

  it('panicked units go idle and stop firing', () => {
    const world = makeWorld(64, 64, 1);
    const panicked: Unit = {
      ...combatUnit(1, 0, { x: 5, y: 10 }),
      morale: MORALE_PANIC_THRESHOLD - 1,
    };
    const enemy = combatUnit(2, 1, { x: 15, y: 10 });
    const state = makeInitialState(world, 1, [panicked, enemy]);
    const rng = new Rng(13);
    const after = advance(state, rng, 5);
    const u = after.units.get(panicked.id);
    if (!u) throw new Error('unit missing');
    expect(u.aiState).toBe('panic');
    expect(u.action.kind).toBe('idle');
    expect(after.events.some((e) => e.kind === 'unit-fired' && e.shooter === panicked.id)).toBe(
      false,
    );
  });

  it('recovers and emits unit-rallied when morale crosses back above the recover threshold', () => {
    const world = makeWorld(64, 64, 1);
    const recovering: Unit = {
      ...combatUnit(1, 0, { x: 5, y: 5 }),
      morale: MORALE_RECOVER_THRESHOLD - 1,
      suppression: 0,
      alerted: false,
    };
    const state = makeInitialState(world, 1, [recovering]);
    const rng = new Rng(14);
    // Recovery is slow — several seconds of calm to cross the threshold.
    const { state: finalState, events } = runCollectingEvents(state, rng, SIM_HZ * 2);
    expect(events.some((e) => e.kind === 'unit-rallied' && e.unitId === recovering.id)).toBe(true);
    const u = finalState.units.get(recovering.id);
    if (!u) throw new Error('unit missing');
    expect(u.morale).toBeGreaterThanOrEqual(MORALE_RECOVER_THRESHOLD);
  });
});

describe('MORALE_ALLY_DOWN_LOSS constant is referenced', () => {
  // Sanity — the downed case uses a lower loss than death; test coverage for
  // the down branch is via emergent sim in integration.
  it('ally-down loss is less than ally-died loss', () => {
    expect(MORALE_ALLY_DOWN_LOSS).toBeLessThan(MORALE_ALLY_DIED_LOSS);
  });
});

// COA-8 task #34 — LOS raycast stress benchmark. Generates a populated
// 64x64 world and fires N rays across it to ensure the stance-aware
// 3D interpolation + smoke + structureHeight lookups stay under a
// generous per-ray budget. This is a regression guard, not a hard
// perf target — we want to catch a 10× slowdown if any hot path is
// accidentally inner-loop-allocating.

import { castRay, castRayStance, type SmokeVolume } from './los';
import { setBarrier, setPoint } from './world';

describe('LOS raycast stress', () => {
  it('2000 rays across a dense 64x64 world complete under 250ms', () => {
    const w = makeWorld(64, 64, 1);
    // Populate with ~10% coverage of point objects + a wall network.
    const denseSeed = 42;
    let seed = denseSeed;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x80000000;
    };
    for (let i = 0; i < 400; i++) {
      const x = Math.floor(rand() * 64);
      const y = Math.floor(rand() * 64);
      const kinds = ['tree_forest', 'bush_medium', 'storage_tank', 'barrel'] as const;
      setPoint(w, x, y, kinds[Math.floor(rand() * kinds.length)]);
    }
    for (let i = 0; i < 80; i++) {
      const x = Math.floor(rand() * 64);
      const y = Math.floor(rand() * 64);
      setBarrier(w, x, y, rand() < 0.5 ? 'N' : 'W', 'stone_wall_low');
    }
    // Elevation noise
    for (let i = 0; i < 300; i++) {
      const x = Math.floor(rand() * 64);
      const y = Math.floor(rand() * 64);
      w.elevationStep[y * 64 + x] = Math.floor(rand() * 6);
    }
    const smoke: SmokeVolume[] = [
      { x: 32, y: 32, radius: 4, opacityTop: 2, opacityPerMeter: 0.1 },
    ];

    const t0 = performance.now();
    let hits = 0;
    for (let i = 0; i < 2000; i++) {
      const fx = rand() * 60 + 2;
      const fy = rand() * 60 + 2;
      const tx = rand() * 60 + 2;
      const ty = rand() * 60 + 2;
      const eyeA = rand() < 0.5 ? 1.7 : 0.3;
      const eyeB = rand() < 0.5 ? 1.7 : 0.3;
      const r = castRay(w, { x: fx, y: fy }, eyeA, { x: tx, y: ty }, eyeB, { smoke });
      if (r === 'visible') hits++;
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(250);
    // Sanity: at least one ray should succeed (not all blocked by dense scatter).
    expect(hits).toBeGreaterThan(0);
  });

  it('castRayStance against the same world completes under the same budget', () => {
    const w = makeWorld(64, 64, 1);
    for (let i = 0; i < 50; i++) {
      setPoint(w, 10 + i, 30, 'tree_forest');
    }
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      castRayStance(w, { x: 5, y: 5 }, 'standing', { x: 60, y: 60 }, 'prone');
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(200);
  });
});
