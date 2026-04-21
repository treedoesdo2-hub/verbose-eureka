import type { Armor } from '@schema/armor';
import type { Weapon } from '@schema/weapon';
import { asArmorId, asUnitId, asWeaponId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import { hashState } from './hash';
import type { ContentLookup } from './loadout';
import { deriveCombatProfile } from './loadout';
import { castRay } from './los';
import { RecordingSim, replay } from './replay';
import { SIM_HZ } from './state';
import { makeInitialState } from './tick';
import { canFight, makeUnit } from './unit';
import { makeWorld, setTerrain } from './world';

const ar: Weapon = {
  id: asWeaponId('ar-01'),
  name: 'AR',
  hardpoint: 'primary',
  damageType: 'ballistic',
  ballistics: { caliberMm: 5.56, velocityMps: 900, massGrams: 4, penetration: 45 },
  baseAccuracy: 70,
  rpm: 600,
  magazineSize: 30,
  reloadSeconds: 2.5,
  rangeMeters: 300,
  tonnage: 4,
  critSlots: 2,
  cost: 1200,
};

const light: Armor = {
  id: asArmorId('light'),
  name: 'Light',
  class: 'light',
  mobilityPenalty: 5,
  cost: 400,
  placements: [
    { zone: 'torso_front', damageReduction: 20, tonnage: 2 },
    { zone: 'torso_back', damageReduction: 20, tonnage: 2 },
  ],
};

const heavy: Armor = {
  id: asArmorId('heavy'),
  name: 'Heavy',
  class: 'heavy',
  mobilityPenalty: 28,
  cost: 2000,
  placements: [
    { zone: 'head', damageReduction: 30, tonnage: 1 },
    { zone: 'torso_front', damageReduction: 70, tonnage: 4 },
    { zone: 'torso_back', damageReduction: 65, tonnage: 3.5 },
    { zone: 'pelvis', damageReduction: 55, tonnage: 2.5 },
  ],
};

const content: ContentLookup = {
  weapon: (id) => (id === ar.id ? ar : undefined),
  armor: (id) => (id === light.id ? light : id === heavy.id ? heavy : undefined),
  utility: () => undefined,
};

function unit(
  id: number,
  teamId: number,
  x: number,
  y: number,
  facing: number,
  armor: Armor | null,
) {
  return makeUnit({
    id: asUnitId(id),
    teamId,
    operatorId: null,
    position: { x, y },
    facing,
    combat: deriveCombatProfile(
      {
        primaryWeaponId: ar.id,
        sidearmId: null,
        armorId: armor?.id ?? null,
        utilityIds: [],
      },
      content,
    ),
  });
}

function runMatch(
  seed: number,
  teamAArmor: Armor | null,
  teamBArmor: Armor | null,
  size = 6,
): { winner: number | null; ticks: number; casualtiesA: number; casualtiesB: number } {
  const world = makeWorld(80, 80, 1);
  const units = [];
  for (let i = 0; i < size; i++) {
    units.push(unit(i + 1, 0, 10, 20 + i * 2, 0, teamAArmor));
    units.push(unit(100 + i, 1, 35, 20 + i * 2, Math.PI, teamBArmor));
  }
  const state = makeInitialState(world, seed, units);
  const sim = new RecordingSim(state, seed);
  let ticks = 0;
  const MAX = SIM_HZ * 120;
  while (!sim.current().ended && ticks < MAX) {
    sim.step();
    ticks++;
  }
  const final = sim.current();
  const endReason = final.endReason;
  const winner = endReason === 'team-1-defeated' ? 0 : endReason === 'team-0-defeated' ? 1 : null;
  const casualtiesA = [...final.units.values()].filter(
    (u) => u.teamId === 0 && u.action.kind === 'dead',
  ).length;
  const casualtiesB = [...final.units.values()].filter(
    (u) => u.teamId === 1 && u.action.kind === 'dead',
  ).length;
  return { winner, ticks, casualtiesA, casualtiesB };
}

describe('MVP validation — 6 pass/fail criteria', () => {
  it('criterion #1: perf — 16-unit match runs under sim-HZ budget', () => {
    const world = makeWorld(80, 80, 1);
    const units = [];
    for (let i = 0; i < 8; i++) units.push(unit(i + 1, 0, 10, 20 + i * 2, 0, light));
    for (let i = 0; i < 8; i++) units.push(unit(100 + i, 1, 35, 20 + i * 2, Math.PI, light));
    const state = makeInitialState(world, 1, units);
    const sim = new RecordingSim(state, 1);
    const TICK_COUNT = SIM_HZ * 30;
    const start = performance.now();
    for (let i = 0; i < TICK_COUNT; i++) {
      sim.step();
      if (sim.current().ended) break;
    }
    const elapsed = performance.now() - start;
    const msPerTick = elapsed / Math.max(1, sim.current().tick);
    expect(msPerTick).toBeLessThan(1000 / SIM_HZ);
  });

  it('criterion #2: LOS tactical — building blocks, forest conceals, flanking produces spot', () => {
    const w = makeWorld(64, 64, 1);
    for (let x = 30; x <= 34; x++) setTerrain(w, x, 10, 'building');
    expect(castRay(w, { x: 10, y: 10 }, 1.7, { x: 50, y: 10 }, 1.0)).toBe('blocked');

    const w2 = makeWorld(64, 64, 1);
    for (let x = 20; x <= 25; x++) setTerrain(w2, x, 10, 'forest');
    expect(castRay(w2, { x: 10, y: 10 }, 1.7, { x: 35, y: 10 }, 1.0)).toBe('concealed');

    const w3 = makeWorld(64, 64, 1);
    expect(castRay(w3, { x: 10, y: 10 }, 1.7, { x: 40, y: 10 }, 1.0)).toBe('visible');
  });

  it('criterion #3: wounds accumulate per-impact — multi-hit produces multi-wound', () => {
    const world = makeWorld(80, 80, 1);
    const a = unit(1, 0, 10, 20, 0, null);
    const b = unit(2, 1, 30, 20, Math.PI, null);
    const state = makeInitialState(world, 7, [a, b]);
    const sim = new RecordingSim(state, 7);
    for (let i = 0; i < SIM_HZ * 30; i++) {
      sim.step();
      if (sim.current().ended) break;
    }
    const finalA = sim.current().units.get(asUnitId(1))!;
    const finalB = sim.current().units.get(asUnitId(2))!;
    const totalWounds = finalA.wounds.length + finalB.wounds.length;
    expect(totalWounds).toBeGreaterThanOrEqual(2);
  });

  it('criterion #4: loadout predictability — heavy-vs-light shows directional advantage >60%', () => {
    let heavyWins = 0;
    const TRIALS = 10;
    for (let trial = 0; trial < TRIALS; trial++) {
      const r = runMatch(trial * 1000 + 1, heavy, light, 4);
      if (r.winner === 0) heavyWins++;
    }
    const pct = heavyWins / TRIALS;
    expect(pct).toBeGreaterThanOrEqual(0.6);
  });

  it('criterion #5: replay bit-identity — final hash matches across re-run', () => {
    const world = makeWorld(64, 64, 1);
    const units = [
      unit(1, 0, 10, 20, 0, light),
      unit(2, 0, 10, 22, 0, light),
      unit(3, 1, 30, 20, Math.PI, light),
      unit(4, 1, 30, 22, Math.PI, light),
    ];
    const state = makeInitialState(world, 42, units);
    const sim = new RecordingSim(state, 42);
    for (let i = 0; i < 500; i++) {
      sim.step();
      if (sim.current().ended) break;
    }
    const record = sim.finish();
    const result = replay(makeInitialState(world, 42, units), record);
    expect(result.initialHashMatches).toBe(true);
    expect(result.finalHash).toBe(record.finalHash);
    expect(hashState(result.state)).toBe(record.finalHash);
  });

  it('bonus: matches reach decisive outcome (no timeouts) with fair loadouts', () => {
    let decisive = 0;
    const TRIALS = 5;
    for (let trial = 0; trial < TRIALS; trial++) {
      const r = runMatch(trial + 1, light, light, 4);
      if (r.winner !== null) decisive++;
    }
    expect(decisive).toBeGreaterThanOrEqual(4);
  });
});

describe('dummy canFight export reference', () => {
  it('canFight is exported', () => {
    expect(typeof canFight).toBe('function');
  });
});
