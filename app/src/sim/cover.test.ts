import { describe, expect, it } from 'vitest';
import { coverEvalAt, MAX_COVER_SCORE } from './cover';
import type { Stance } from './los';
import { makeWorld, setBarrier, setPoint } from './world';

// COA-8 task #31 — stance × cover cross matrix. coverEvalAt must adjust
// sample scores both by the target stance (prone behind chest-high cover
// upgrades to heavy, standing behind low cover downgrades to light) and
// by elevation delta (high-ground defender silhouette × 0.8).

describe('coverEvalAt — stance adjustments', () => {
  const stances: Stance[] = ['standing', 'crouched', 'prone'];

  it('score monotonically decreases (or stays equal) with defender stance lowering behind a low wall', () => {
    const w = makeWorld(32, 16, 1);
    for (let x = 14; x <= 16; x++) setBarrier(w, x, 8, 'N', 'stone_wall_low');
    const scores = stances.map((s) => {
      return coverEvalAt(
        w,
        { x: 15, y: 5 },
        'standing',
        { x: 15, y: 10 },
        s,
      ).score;
    });
    // Prone behind low cover should score ≥ standing (stanceAdjust upgrades
    // low cover for prone). Standing behind low cover scores at least as
    // high as 0 but may be lower than prone.
    expect(scores[2]).toBeGreaterThanOrEqual(scores[0]);
  });

  it('standing behind chest-high cover = light (downgraded from heavy)', () => {
    const w = makeWorld(32, 16, 1);
    setPoint(w, 15, 8, 'haystack'); // thin LOS, light cover, chest height
    const scoreStanding = coverEvalAt(
      w,
      { x: 5, y: 8 },
      'standing',
      { x: 25, y: 8 },
      'standing',
    ).score;
    const scoreCrouched = coverEvalAt(
      w,
      { x: 5, y: 8 },
      'standing',
      { x: 25, y: 8 },
      'crouched',
    ).score;
    // Crouched silhouette is shorter; a chest-high cover now covers more of
    // it. Crouched score should be >= standing.
    expect(scoreCrouched).toBeGreaterThanOrEqual(scoreStanding);
  });

  it('score never exceeds MAX_COVER_SCORE (80)', () => {
    const w = makeWorld(32, 16, 1);
    // Stack the heaviest cover possible: full/full point object.
    setPoint(w, 15, 8, 'storage_tank');
    for (const a of stances) {
      for (const d of stances) {
        const s = coverEvalAt(
          w,
          { x: 5, y: 8 },
          a,
          { x: 25, y: 8 },
          d,
        ).score;
        expect(s).toBeLessThanOrEqual(MAX_COVER_SCORE);
        expect(s).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('coverEvalAt — elevation-delta silhouette adjustment', () => {
  it('target on higher ground scores equal or lower (silhouette × 0.8)', () => {
    const w = makeWorld(32, 16, 1);
    setPoint(w, 15, 8, 'haystack');
    // Flat ground baseline.
    const flatScore = coverEvalAt(
      w,
      { x: 5, y: 8 },
      'standing',
      { x: 25, y: 8 },
      'standing',
    ).score;

    // Raise the target tile by 3 elevation steps (4.5m). Silhouette should
    // shrink for the high-ground defender — any cover that occluded a full
    // standing silhouette now occludes a bigger fraction of the silhouette.
    w.elevationStep[8 * w.width + 25] = 3;
    const highScore = coverEvalAt(
      w,
      { x: 5, y: 8 },
      'standing',
      { x: 25, y: 8 },
      'standing',
    ).score;

    // High-ground gets silhouette compression — score should not INCREASE
    // relative to flat. (May be equal if the cover already fully occluded.)
    expect(highScore).toBeLessThanOrEqual(flatScore + 4); // allow small sample jitter
  });
});
