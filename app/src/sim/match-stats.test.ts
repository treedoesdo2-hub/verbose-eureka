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
        tick: 3,
      },
      { kind: 'unit-died', unitId: asUnitId(11), tick: 4 },
      { kind: 'unit-stabilized', medicId: asUnitId(2), targetId: asUnitId(1), tick: 5 },
    ]);
    const stats = acc.finalize(5);
    expect(stats.highlights.some((h) => h.kind === 'ace' && h.unitId === 1)).toBe(true);
    expect(stats.highlights.some((h) => h.kind === 'medic' && h.unitId === 2)).toBe(true);
  });
});
