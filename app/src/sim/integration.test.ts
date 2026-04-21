import { asUnitId } from '@shared/ids';
import { makeContent, makeLightArmor, makeWeapon } from '@test-helpers/fixtures';
import { describe, expect, it } from 'vitest';
import { deriveCombatProfile, emptyCombatProfile } from './loadout';
import { RecordingSim } from './replay';
import { makeInitialState } from './tick';
import { canFight, makeUnit } from './unit';
import { makeWorld } from './world';

const ar = makeWeapon({ name: 'AR', baseAccuracy: 70 });
const light = makeLightArmor();
const content = makeContent([ar], [light]);

function spawnUnit(id: number, teamId: number, x: number, y: number, facing: number) {
  return makeUnit({
    id: asUnitId(id),
    teamId,
    operatorId: null,
    position: { x, y },
    facing,
    combat: deriveCombatProfile(
      {
        items: [
          { type: 'weapon', id: ar.id, zone: 'right_hand' },
          { type: 'armor', id: light.id, zone: 'torso_front' },
          { type: 'armor', id: light.id, zone: 'torso_back' },
        ],
      },
      content,
    ),
  });
}

describe('integration: 3v3 engagement', () => {
  it('terminates with one side defeated within 60 seconds of sim time', () => {
    const world = makeWorld(80, 80, 1);
    const units = [
      spawnUnit(1, 0, 10, 20, 0),
      spawnUnit(2, 0, 10, 22, 0),
      spawnUnit(3, 0, 10, 24, 0),
      spawnUnit(4, 1, 35, 20, Math.PI),
      spawnUnit(5, 1, 35, 22, Math.PI),
      spawnUnit(6, 1, 35, 24, Math.PI),
    ];
    const state = makeInitialState(world, 42, units);
    const sim = new RecordingSim(state, 42);

    let tickCount = 0;
    const MAX_TICKS = 30 * 60;
    while (!sim.current().ended && tickCount < MAX_TICKS) {
      sim.step();
      tickCount += 1;
    }

    const finalState = sim.current();
    expect(finalState.ended).toBe(true);
    const aliveTeam0 = [...finalState.units.values()].filter(
      (u) => u.teamId === 0 && canFight(u),
    ).length;
    const aliveTeam1 = [...finalState.units.values()].filter(
      (u) => u.teamId === 1 && canFight(u),
    ).length;
    expect(aliveTeam0 === 0 || aliveTeam1 === 0).toBe(true);
  });

  it('fires at least one shot', () => {
    const world = makeWorld(80, 80, 1);
    const units = [spawnUnit(1, 0, 10, 20, 0), spawnUnit(2, 1, 30, 20, Math.PI)];
    const state = makeInitialState(world, 7, units);
    const sim = new RecordingSim(state, 7);
    let fires = 0;
    for (let i = 0; i < 30 * 30; i++) {
      sim.step();
      fires += sim.current().events.filter((e) => e.kind === 'unit-fired').length;
      if (sim.current().ended) break;
    }
    expect(fires).toBeGreaterThan(0);
  });

  it('no-combat empty scenario runs without error', () => {
    const world = makeWorld(64, 64, 1);
    const unit = makeUnit({
      id: asUnitId(1),
      teamId: 0,
      operatorId: null,
      position: { x: 10, y: 10 },
      facing: 0,
      combat: emptyCombatProfile(),
    });
    const state = makeInitialState(world, 1, [unit]);
    const sim = new RecordingSim(state, 1);
    for (let i = 0; i < 100; i++) sim.step();
    expect(sim.current().tick).toBe(100);
  });
});
