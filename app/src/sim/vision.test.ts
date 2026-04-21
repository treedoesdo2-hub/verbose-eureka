import { asUnitId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import { makeUnit } from './unit';
import { checkSight } from './vision';
import { makeWorld } from './world';

describe('three-tier vision', () => {
  it('detects target in focused cone directly ahead', () => {
    const w = makeWorld(64, 64, 1);
    const observer = {
      ...makeUnit({
        id: asUnitId(1),
        teamId: 0,
        operatorId: null,
        position: { x: 10, y: 10 },
        facing: 0,
      }),
    };
    const target = makeUnit({
      id: asUnitId(2),
      teamId: 1,
      operatorId: null,
      position: { x: 30, y: 10 },
      facing: Math.PI,
    });
    const r = checkSight(w, observer, target);
    expect(r.tier).toBe('focused');
    expect(r.detected).toBe(true);
  });

  it('misses target far outside cone and peripheral range', () => {
    const w = makeWorld(256, 256, 1);
    const observer = makeUnit({
      id: asUnitId(1),
      teamId: 0,
      operatorId: null,
      position: { x: 10, y: 10 },
      facing: 0,
    });
    const target = makeUnit({
      id: asUnitId(2),
      teamId: 1,
      operatorId: null,
      position: { x: 10, y: 200 },
      facing: 0,
    });
    const r = checkSight(w, observer, target);
    expect(r.tier).toBe('none');
    expect(r.detected).toBe(false);
  });

  it('peripheral bubble catches close targets even behind', () => {
    const w = makeWorld(64, 64, 1);
    const observer = makeUnit({
      id: asUnitId(1),
      teamId: 0,
      operatorId: null,
      position: { x: 20, y: 20 },
      facing: 0,
    });
    const target = makeUnit({
      id: asUnitId(2),
      teamId: 1,
      operatorId: null,
      position: { x: 15, y: 20 },
      facing: 0,
    });
    const r = checkSight(w, observer, target);
    expect(r.tier).toBe('peripheral');
  });

  it('alerted state extends range to 360°', () => {
    const w = makeWorld(256, 256, 1);
    const observer = {
      ...makeUnit({
        id: asUnitId(1),
        teamId: 0,
        operatorId: null,
        position: { x: 100, y: 100 },
        facing: 0,
      }),
      alerted: true,
    };
    const target = makeUnit({
      id: asUnitId(2),
      teamId: 1,
      operatorId: null,
      position: { x: 100, y: 200 },
      facing: 0,
    });
    const r = checkSight(w, observer, target);
    expect(r.tier).toBe('alerted');
  });
});
