import { asUnitId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import { MatchStatsAccumulator } from './match-stats';
import type { SimEvent } from './state';
import { makeUnit } from './unit';

function makeMatchUnits() {
  const a = makeUnit({
    id: asUnitId(1),
    teamId: 0,
    operatorId: 'callsign-alpha',
    position: { x: 0, y: 0 },
    facing: 0,
  });
  const b = makeUnit({
    id: asUnitId(2),
    teamId: 0,
    operatorId: 'callsign-bravo',
    position: { x: 0, y: 0 },
    facing: 0,
  });
  const x = makeUnit({
    id: asUnitId(10),
    teamId: 1,
    operatorId: null,
    position: { x: 0, y: 0 },
    facing: 0,
  });
  return new Map([
    [a.id, a],
    [b.id, b],
    [x.id, x],
  ]);
}

describe('match stats accumulator', () => {
  it('tallies shots, hits, wounds, and kills', () => {
    const acc = new MatchStatsAccumulator();
    acc.seed(makeMatchUnits());
    const events: SimEvent[] = [
      { kind: 'unit-fired', shooter: asUnitId(1), target: asUnitId(10), tick: 1 },
      {
        kind: 'unit-hit',
        shooter: asUnitId(1),
        target: asUnitId(10),
        outcome: 'wound',
        zone: 'torso_front',
        woundId: 1,
        reason: null,
        woundType: 'gunshot',
        tick: 2,
      },
      { kind: 'unit-fired', shooter: asUnitId(1), target: asUnitId(10), tick: 3 },
      {
        kind: 'unit-hit',
        shooter: asUnitId(1),
        target: asUnitId(10),
        outcome: 'wound',
        zone: 'torso_front',
        woundId: 2,
        reason: null,
        woundType: 'gunshot',
        tick: 4,
      },
      { kind: 'unit-died', unitId: asUnitId(10), tick: 5 },
    ];
    acc.ingest(events);
    const stats = acc.finalize(5);
    const alpha = stats.perUnit.find((u) => u.unitId === 1);
    const enemy = stats.perUnit.find((u) => u.unitId === 10);
    expect(alpha?.shotsFired).toBe(2);
    expect(alpha?.hitsLanded).toBe(2);
    expect(alpha?.kills).toBe(1);
    expect(enemy?.woundsReceived).toBe(2);
    expect(enemy?.survived).toBe(false);
  });

  it('tallies blocks and misses distinctly from wounds', () => {
    const acc = new MatchStatsAccumulator();
    acc.seed(makeMatchUnits());
    acc.ingest([
      { kind: 'unit-fired', shooter: asUnitId(1), target: asUnitId(10), tick: 1 },
      {
        kind: 'unit-hit',
        shooter: asUnitId(1),
        target: asUnitId(10),
        outcome: 'block',
        zone: 'torso_front',
        woundId: null,
        reason: null,
        woundType: null,
        tick: 1,
      },
      { kind: 'unit-fired', shooter: asUnitId(1), target: asUnitId(10), tick: 2 },
      {
        kind: 'unit-hit',
        shooter: asUnitId(1),
        target: asUnitId(10),
        outcome: 'miss',
        zone: null,
        woundId: null,
        reason: 'cover',
        woundType: null,
        tick: 2,
      },
    ]);
    const stats = acc.finalize(2);
    const alpha = stats.perUnit.find((u) => u.unitId === 1);
    const enemy = stats.perUnit.find((u) => u.unitId === 10);
    expect(alpha?.shotsFired).toBe(2);
    expect(alpha?.hitsLanded).toBe(0);
    expect(alpha?.shotsBlocked).toBe(1);
    expect(alpha?.shotsMissed).toBe(1);
    expect(enemy?.woundsReceived).toBe(0);
  });

  it('attributes downs to the last shooter', () => {
    const acc = new MatchStatsAccumulator();
    acc.seed(makeMatchUnits());
    acc.ingest([
      {
        kind: 'unit-hit',
        shooter: asUnitId(2),
        target: asUnitId(10),
        outcome: 'wound',
        zone: 'torso_front',
        woundId: 1,
        reason: null,
        woundType: 'gunshot',
        tick: 1,
      },
      { kind: 'unit-downed', unitId: asUnitId(10), cause: 'combat', tick: 2 },
    ]);
    const stats = acc.finalize(2);
    const bravo = stats.perUnit.find((u) => u.unitId === 2);
    expect(bravo?.downs).toBe(1);
    expect(bravo?.kills).toBe(0);
  });

  it('builds ace and medic highlights for player-side only', () => {
    const acc = new MatchStatsAccumulator();
    acc.seed(makeMatchUnits());
    // Alpha gets two kills → ace highlight.
    acc.ingest([
      {
        kind: 'unit-hit',
        shooter: asUnitId(1),
        target: asUnitId(10),
        outcome: 'wound',
        zone: 'torso_front',
        woundId: 1,
        reason: null,
        woundType: 'gunshot',
        tick: 1,
      },
      { kind: 'unit-died', unitId: asUnitId(10), tick: 2 },
    ]);
    // Invent a second enemy on the fly via a fresh ingestion after seeding.
    const units2 = makeMatchUnits();
    units2.set(
      asUnitId(11),
      makeUnit({
        id: asUnitId(11),
        teamId: 1,
        operatorId: null,
        position: { x: 0, y: 0 },
        facing: 0,
      }),
    );
    acc.seed(units2);
    acc.ingest([
      {
        kind: 'unit-hit',
        shooter: asUnitId(1),
        target: asUnitId(11),
        outcome: 'wound',
        zone: 'torso_front',
        woundId: 2,
        reason: null,
        woundType: 'gunshot',
        tick: 3,
      },
      { kind: 'unit-died', unitId: asUnitId(11), tick: 4 },
      { kind: 'unit-stabilized', medicId: asUnitId(2), targetId: asUnitId(1), tick: 5 },
    ]);
    const stats = acc.finalize(5);
    expect(stats.highlights.some((h) => h.kind === 'ace' && h.unitId === 1)).toBe(true);
    expect(stats.highlights.some((h) => h.kind === 'medic' && h.unitId === 2)).toBe(true);
  });

  it('captures squad-position snapshots at the sample interval (#292.09)', () => {
    const acc = new MatchStatsAccumulator();
    const units = makeMatchUnits();
    acc.seed(units);
    // Distinct positions for friendlies so the squad center has signal.
    // `Unit.position` is readonly; rebuild each unit with the new position
    // rather than mutating in place.
    units.set(asUnitId(1), { ...units.get(asUnitId(1))!, position: { x: 10, y: 10 } });
    units.set(asUnitId(2), { ...units.get(asUnitId(2))!, position: { x: 14, y: 14 } });
    units.set(asUnitId(10), { ...units.get(asUnitId(10))!, position: { x: 50, y: 50 } });
    const squadOf = (opId: string): string | null =>
      opId === 'callsign-alpha' || opId === 'callsign-bravo' ? 'sq-1' : null;

    // Tick 0 → first sample. Tick 100 inside same interval → no new sample.
    acc.sample(0, units, squadOf);
    acc.sample(100, units, squadOf);
    // Tick 900 (= SNAPSHOT_INTERVAL_TICKS) → second sample.
    acc.sample(900, units, squadOf);

    const stats = acc.finalize(900);
    expect(stats.snapshots).toHaveLength(2);
    const first = stats.snapshots[0];
    expect(first.tick).toBe(0);
    expect(first.squads).toHaveLength(1);
    expect(first.squads[0].squadId).toBe('sq-1');
    expect(first.squads[0].aliveCount).toBe(2);
    expect(first.squads[0].centerX).toBeCloseTo(12);
    expect(first.squads[0].centerY).toBeCloseTo(12);
    expect(first.hostileCenter?.x).toBeCloseTo(50);
  });
});
