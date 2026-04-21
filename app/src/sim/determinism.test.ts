import { asUnitId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import { hashState } from './hash';
import { RecordingSim, replay } from './replay';
import { makeInitialState } from './tick';
import { makeUnit } from './unit';
import { makeWorld, setTerrain } from './world';

function buildScenario(seed: number): ReturnType<typeof makeInitialState> {
  const world = makeWorld(64, 64, 1);
  setTerrain(world, 20, 20, 'building');
  setTerrain(world, 21, 20, 'building');
  setTerrain(world, 10, 10, 'forest');

  const units = [
    makeUnit({
      id: asUnitId(1),
      teamId: 0,
      operatorId: null,
      position: { x: 5, y: 5 },
      facing: 0,
    }),
    makeUnit({
      id: asUnitId(2),
      teamId: 0,
      operatorId: null,
      position: { x: 6, y: 7 },
      facing: 0.5,
    }),
    makeUnit({
      id: asUnitId(3),
      teamId: 1,
      operatorId: null,
      position: { x: 50, y: 50 },
      facing: Math.PI,
    }),
  ];

  return makeInitialState(world, seed, units);
}

describe('sim determinism', () => {
  it('same seed produces bit-identical state hash after 1000 ticks', () => {
    const a = new RecordingSim(buildScenario(42), 42);
    const b = new RecordingSim(buildScenario(42), 42);
    for (let i = 0; i < 1000; i++) {
      a.step();
      b.step();
    }
    expect(hashState(a.current())).toBe(hashState(b.current()));
  });

  it('different seeds diverge state hash', () => {
    const a = new RecordingSim(buildScenario(1), 1);
    const b = new RecordingSim(buildScenario(2), 2);
    for (let i = 0; i < 100; i++) {
      a.step();
      b.step();
    }
    expect(a.current().rngSnapshot).not.toEqual(b.current().rngSnapshot);
  });

  it('replay produces same final hash as recording', () => {
    const sim = new RecordingSim(buildScenario(7), 7);
    for (let i = 0; i < 500; i++) sim.step();
    const record = sim.finish();

    const result = replay(buildScenario(7), record);
    expect(result.initialHashMatches).toBe(true);
    expect(result.finalHash).toBe(record.finalHash);
  });

  it('initial state hash is stable across constructions', () => {
    const a = buildScenario(100);
    const b = buildScenario(100);
    expect(hashState(a)).toBe(hashState(b));
  });

  it('adds motion: unit moves toward target over ticks', () => {
    const world = makeWorld(32, 32, 1);
    const start = makeUnit({
      id: asUnitId(1),
      teamId: 0,
      operatorId: null,
      position: { x: 0, y: 0 },
      facing: 0,
    });
    const withMoving = {
      ...start,
      action: { kind: 'moving' as const, target: { x: 10, y: 0 } },
    };
    const state = makeInitialState(world, 1, [withMoving]);
    const sim = new RecordingSim(state, 1);
    for (let i = 0; i < 100; i++) sim.step();
    const unit = sim.current().units.get(asUnitId(1))!;
    expect(unit.position.x).toBeGreaterThan(5);
  });
});
