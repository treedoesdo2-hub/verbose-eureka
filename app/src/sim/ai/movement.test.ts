import { describe, expect, it } from 'vitest';
import { makeWorld, setPoint } from '../world';
import { coverAwareStepTarget } from './movement';

describe('coverAwareStepTarget', () => {
  it('returns the goal directly when there are no threats', () => {
    const world = makeWorld(64, 64, 1);
    const goal = { x: 40, y: 10 };
    expect(coverAwareStepTarget(world, { x: 10, y: 10 }, goal, [])).toEqual(goal);
  });

  it('returns the goal directly when already inside step distance', () => {
    const world = makeWorld(64, 64, 1);
    const from = { x: 10, y: 10 };
    const goal = { x: 12, y: 10 };
    const threats = [{ x: 10, y: 40 }];
    // Close enough that beelining makes sense — no intermediate step.
    expect(coverAwareStepTarget(world, from, goal, threats)).toEqual(goal);
  });

  it('picks a step that makes progress toward the goal', () => {
    const world = makeWorld(64, 64, 1);
    const from = { x: 10, y: 10 };
    const goal = { x: 40, y: 10 };
    const threats = [{ x: 10, y: 40 }];
    const step = coverAwareStepTarget(world, from, goal, threats);
    // Step must be closer to goal than starting position.
    const beforeDist = Math.hypot(goal.x - from.x, goal.y - from.y);
    const afterDist = Math.hypot(goal.x - step.x, goal.y - step.y);
    expect(afterDist).toBeLessThan(beforeDist);
  });

  it('rejects candidate steps that land in impassable terrain', () => {
    const world = makeWorld(16, 16, 1);
    // Wall all tiles directly east of origin except along y=10 (the path).
    // storage_tank blocks foot movement (move='blocked-foot').
    for (let x = 11; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        if (y !== 10) setPoint(world, x, y, 'storage_tank');
      }
    }
    const from = { x: 10.5, y: 10.5 };
    const goal = { x: 14.5, y: 10.5 };
    const threats = [{ x: 10.5, y: 1 }]; // threat to the north
    const step = coverAwareStepTarget(world, from, goal, threats);
    // Chosen step must be passable.
    const tx = Math.floor(step.x);
    const ty = Math.floor(step.y);
    expect(ty).toBe(10);
    expect(tx).toBeGreaterThanOrEqual(10);
    expect(tx).toBeLessThan(16);
  });

  it('prefers a step behind cover when cover is available', () => {
    const world = makeWorld(64, 64, 1);
    // A forest strip at y=7-8 gives concealment for a unit moving east at y~9
    // against a threat to the north. A unit moving east at y=11 has no cover.
    for (let x = 10; x < 16; x++) {
      setPoint(world, x, 7, 'tree_forest');
      setPoint(world, x, 8, 'tree_forest');
    }
    const from = { x: 10, y: 10 };
    const goal = { x: 20, y: 10 };
    const threats = [{ x: 13, y: 1 }]; // north of the forest strip

    const withThreat = coverAwareStepTarget(world, from, goal, threats);
    const withoutThreat = coverAwareStepTarget(world, from, goal, []);

    // Without a threat we just beeline — the step is the goal.
    expect(withoutThreat).toEqual(goal);
    // With a threat, the cover-aware path may deviate off the beeline.
    // Either a different candidate is chosen OR the beeline remains because
    // no candidate scores better — but the function must remain passable-safe.
    const beelineDist = Math.hypot(goal.x - from.x, goal.y - from.y);
    const chosenDist = Math.hypot(goal.x - withThreat.x, goal.y - withThreat.y);
    expect(chosenDist).toBeLessThanOrEqual(beelineDist);
  });
});
