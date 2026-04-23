import { asUnitId } from '@shared/ids';
import { makeContent, makeLightArmor, makeWeapon } from '@test-helpers/fixtures';
import { describe, expect, it } from 'vitest';
import { deriveCombatProfile } from './loadout';
import { RecordingSim } from './replay';
import { snapshotState, snapshotWorld } from './snapshot';
import { makeInitialState } from './tick';
import { makeUnit } from './unit';
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

describe('snapshotState', () => {
  it('exposes stance, suppression, morale, and aiState on snapshot units', () => {
    const world = makeWorld(64, 64, 1);
    const units = [spawnUnit(1, 0, 10, 20, 0), spawnUnit(2, 1, 30, 20, Math.PI)];
    const state = makeInitialState(world, 11, units);
    const snap = snapshotState(state);
    expect(snap.units).toHaveLength(2);
    for (const u of snap.units) {
      expect(typeof u.suppression).toBe('number');
      expect(typeof u.morale).toBe('number');
      expect(typeof u.aiState).toBe('string');
      expect(['standing', 'crouched', 'prone']).toContain(u.stance);
    }
  });

  it('preserves unit-hit outcome/zone/reason in the event stream', () => {
    const world = makeWorld(80, 80, 1);
    const units = [spawnUnit(1, 0, 10, 20, 0), spawnUnit(2, 1, 30, 20, Math.PI)];
    const state = makeInitialState(world, 23, units);
    const sim = new RecordingSim(state, 23);
    const seenOutcomes = new Set<string>();
    for (let i = 0; i < 30 * 60; i++) {
      sim.step();
      const snap = snapshotState(sim.current());
      for (const e of snap.events) {
        if (e.kind === 'unit-hit') {
          seenOutcomes.add(e.outcome);
          if (e.outcome === 'wound') {
            expect(e.zone).not.toBeNull();
            expect(e.woundId).not.toBeNull();
          } else if (e.outcome === 'miss') {
            expect(e.zone).toBeNull();
            expect(e.woundId).toBeNull();
            expect(e.reason).not.toBeNull();
          }
        }
      }
      if (sim.current().ended) break;
    }
    // At least one outcome kind should have fired in a 60s engagement.
    expect(seenOutcomes.size).toBeGreaterThan(0);
  });

  it('retains unit-pinned/broke/rallied events across the snapshot boundary', () => {
    const world = makeWorld(64, 64, 1);
    const units = [spawnUnit(1, 0, 10, 20, 0)];
    const state = makeInitialState(world, 5, units);
    const synthetic = {
      ...state,
      events: [
        { kind: 'unit-pinned' as const, unitId: asUnitId(1), tick: 1 },
        { kind: 'unit-broke' as const, unitId: asUnitId(1), tick: 2 },
        { kind: 'unit-rallied' as const, unitId: asUnitId(1), tick: 3 },
      ],
    };
    const snap = snapshotState(synthetic);
    const kinds = snap.events.map((e) => e.kind);
    expect(kinds).toContain('unit-pinned');
    expect(kinds).toContain('unit-broke');
    expect(kinds).toContain('unit-rallied');
  });
});

describe('snapshotWorld', () => {
  it('round-trips base terrain as a Uint8Array copy', () => {
    const world = makeWorld(16, 16, 1);
    const snap = snapshotWorld(world);
    expect(snap.width).toBe(16);
    expect(snap.height).toBe(16);
    expect(snap.base).toBeInstanceOf(Uint8Array);
    expect(snap.base.length).toBe(16 * 16);
    // Mutating snapshot should not mutate source.
    snap.base[0] = 99;
    expect(world.base[0]).not.toBe(99);
  });

  it('populates every non-base buffer with a Uint*Array copy', () => {
    const world = makeWorld(8, 8, 1);
    // Write one non-zero byte into each buffer so byte-equality is
    // observable post-snapshot.
    world.point[0] = 22;
    world.buildingId[1] = 7;
    world.edgeN[2] = 1;
    world.edgeW[3] = 3;
    world.elevationStep[4] = 5;
    world.structureHeight[5] = 2;
    const snap = snapshotWorld(world);
    expect(snap.point[0]).toBe(22);
    expect(snap.buildingId[1]).toBe(7);
    expect(snap.edgeN[2]).toBe(1);
    expect(snap.edgeW[3]).toBe(3);
    expect(snap.elevationStep[4]).toBe(5);
    expect(snap.structureHeight[5]).toBe(2);
    // shadingBake defaults to 128 (neutral) until P3.3 populates it.
    expect(snap.shadingBake[0]).toBe(128);
    expect(snap.contours.every((v) => v === 0)).toBe(true);
    // Copy semantics: snapshot mutation must not reach the World.
    snap.point[0] = 99;
    expect(world.point[0]).toBe(22);
  });

  it('survives structuredClone without reference leaks', () => {
    const world = makeWorld(4, 4, 1);
    world.base[0] = 3;
    world.point[0] = 22;
    world.elevationStep[0] = 7;
    const snap = snapshotWorld(world);
    const cloned = structuredClone(snap);
    expect(cloned.base[0]).toBe(3);
    expect(cloned.point[0]).toBe(22);
    expect(cloned.elevationStep[0]).toBe(7);
    expect(cloned.base).not.toBe(snap.base);
    expect(cloned.buildings).not.toBe(snap.buildings);
  });
});
