import { asUnitId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import { updateLastHeard } from './hearing';
import { HEARD_TTL_TICKS, type NoiseKind } from './noise';
import type { SimEvent } from './state';
import { makeUnit, type Unit } from './unit';
import { makeWorld } from './world';

function mkListener(overrides: Partial<Unit> = {}): Unit {
  const base = makeUnit({
    id: asUnitId(1),
    teamId: 0,
    operatorId: null,
    position: { x: 0, y: 0 },
    facing: 0,
  });
  return { ...base, ...overrides };
}

function noiseEvent(
  sourceId: number,
  x: number,
  y: number,
  tick = 1,
  kind: NoiseKind = 'weapon-fire',
): SimEvent {
  return {
    kind: 'noise-emitted',
    sourceUnitId: asUnitId(sourceId),
    pos: { x, y },
    noiseKind: kind,
    tick,
  };
}

describe('updateLastHeard', () => {
  const world = makeWorld(200, 200, 1);

  it('populates an entry for a shot within range', () => {
    const listener = mkListener();
    const events: SimEvent[] = [noiseEvent(2, 10, 0, 1)];
    const next = updateLastHeard(listener, events, world, 1);
    const entry = next.get(asUnitId(2));
    expect(entry).toBeDefined();
    expect(entry?.confidence).toBeGreaterThan(0);
    expect(entry?.bearing).not.toBeNull();
  });

  it('drops events outside effective range', () => {
    const listener = mkListener();
    const events: SimEvent[] = [noiseEvent(2, 500, 0, 1)];
    const next = updateLastHeard(listener, events, world, 1);
    expect(next.get(asUnitId(2))).toBeUndefined();
  });

  it('drops unreinforced entries past TTL', () => {
    const stale = new Map([
      [
        asUnitId(2),
        {
          sourcePos: { x: 10, y: 0 },
          approxPos: { x: 10, y: 0 },
          bearing: 0,
          confidence: 0.5,
          tick: 1,
          kind: 'weapon-fire' as const,
        },
      ],
    ]);
    const listener = mkListener({ lastHeard: stale });
    const next = updateLastHeard(listener, [], world, HEARD_TTL_TICKS + 2);
    expect(next.size).toBe(0);
  });

  it('refreshes tick on reinforcement', () => {
    const listener = mkListener();
    const first = updateLastHeard(listener, [noiseEvent(2, 10, 0, 5)], world, 5);
    const withFirst = { ...listener, lastHeard: first };
    const second = updateLastHeard(withFirst, [noiseEvent(2, 10, 0, 20)], world, 20);
    expect(second.get(asUnitId(2))?.tick).toBe(20);
  });

  it('clears all heard entries for panicked listener', () => {
    const stale = new Map([
      [
        asUnitId(2),
        {
          sourcePos: { x: 10, y: 0 },
          approxPos: { x: 10, y: 0 },
          bearing: 0,
          confidence: 0.5,
          tick: 1,
          kind: 'weapon-fire' as const,
        },
      ],
    ]);
    const listener = mkListener({ aiState: 'panic', lastHeard: stale });
    const next = updateLastHeard(listener, [noiseEvent(2, 10, 0, 2)], world, 2);
    expect(next.size).toBe(0);
  });

  it('ignores noise emitted by self', () => {
    const listener = mkListener({ id: asUnitId(2) });
    const events: SimEvent[] = [noiseEvent(2, 10, 0, 1)];
    const next = updateLastHeard(listener, events, world, 1);
    expect(next.size).toBe(0);
  });
});
