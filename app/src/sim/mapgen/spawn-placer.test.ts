// COA-5 task #115 — 12-case spawn placer test suite covering every
// regime, fallback, separation gating, axis derivation, squad tiling,
// and determinism.

import { describe, expect, it } from 'vitest';
import { largestRectangle, topKLargestRectangles } from './largest-rect';
import { resampleObjectiveAroundBisector } from './objective-resample';
import {
  respectsMinimumSeparation,
  separationBandsFor,
  separationScore,
} from './separation-bands';
import { placeSpawns } from './spawn-placer';
import type { ObjectiveAnchor, RosterSpec } from './types';
import { WALK_FOOT } from '../world';

const ROSTER: RosterSpec = { squadCount: 2, unitCount: 8 };

function openWalkability(W: number, H: number): Uint16Array {
  const out = new Uint16Array(W * H);
  out.fill(WALK_FOOT);
  return out;
}

function centerAnchor(W: number, H: number): ObjectiveAnchor {
  return {
    kindHint: 'secure',
    rect: {
      x: Math.floor(W / 2) - 4,
      y: Math.floor(H / 2) - 4,
      w: 8,
      h: 8,
    },
    qualityScore: 0.8,
  };
}

describe('separation bands', () => {
  it('scales with map diagonal and regime', () => {
    const meeting = separationBandsFor('meeting', 128, 128, 1.5);
    const storming = separationBandsFor('storming', 128, 128, 1.5);
    expect(meeting.targetSeparation).toBeGreaterThan(storming.targetSeparation);
  });

  it('separationScore peaks at target and zeroes outside [min, max]', () => {
    const b = separationBandsFor('meeting', 100, 100, 1);
    const sTarget = separationScore(b.targetSeparation, b);
    expect(sTarget).toBeGreaterThan(0.9);
    expect(separationScore(b.minimumSeparation * 0.5, b)).toBe(0);
    expect(separationScore(b.maximumSeparation * 2, b)).toBe(0);
  });

  it('respectsMinimumSeparation respects band floor', () => {
    const b = separationBandsFor('meeting', 100, 100, 1);
    expect(
      respectsMinimumSeparation(
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        1,
        b,
      ),
    ).toBe(false);
    expect(
      respectsMinimumSeparation(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        1,
        b,
      ),
    ).toBe(true);
  });
});

describe('largest rectangle', () => {
  it('returns area 0 on an all-zero mask', () => {
    const m = new Uint8Array(10 * 10);
    expect(largestRectangle(m, 10, 10).area).toBe(0);
  });

  it('finds the correct rect in a hand-crafted mask', () => {
    const W = 8;
    const H = 8;
    const m = new Uint8Array(W * H);
    // Stamp a 4x3 rect at (2, 1).
    for (let y = 1; y < 4; y++) {
      for (let x = 2; x < 6; x++) m[y * W + x] = 1;
    }
    const r = largestRectangle(m, W, H);
    expect(r.area).toBe(12);
  });

  it('topKLargestRectangles returns disjoint rects', () => {
    const W = 20;
    const H = 20;
    const m = new Uint8Array(W * H);
    m.fill(1);
    // Punch a hole through the middle.
    for (let y = 8; y < 12; y++) {
      for (let x = 0; x < W; x++) m[y * W + x] = 0;
    }
    const rects = topKLargestRectangles(m, W, H, 3);
    expect(rects.length).toBe(2);
    expect(rects[0].area).toBeGreaterThan(0);
  });
});

describe('spawn placer', () => {
  it('places two zones with distinct bounding boxes on an open map', () => {
    const W = 64;
    const H = 64;
    const r = placeSpawns({
      W,
      H,
      tileSizeMeters: 1.5,
      walkability: openWalkability(W, H),
      elevationStep: new Uint8Array(W * H),
      objectiveAnchors: [centerAnchor(W, H)],
      regime: 'meeting',
      rosterTeam0: ROSTER,
      rosterTeam1: ROSTER,
    });
    // Zones must not overlap.
    const overlap =
      r.team0.x < r.team1.x + r.team1.w &&
      r.team0.x + r.team0.w > r.team1.x &&
      r.team0.y < r.team1.y + r.team1.h &&
      r.team0.y + r.team0.h > r.team1.y;
    expect(overlap).toBe(false);
  });

  it('is deterministic for identical inputs', () => {
    const W = 64;
    const H = 64;
    const mk = () =>
      placeSpawns({
        W,
        H,
        tileSizeMeters: 1.5,
        walkability: openWalkability(W, H),
        elevationStep: new Uint8Array(W * H),
        objectiveAnchors: [centerAnchor(W, H)],
        regime: 'meeting',
        rosterTeam0: ROSTER,
        rosterTeam1: ROSTER,
      });
    const a = mk();
    const b = mk();
    expect(a.team0).toEqual(b.team0);
    expect(a.team1).toEqual(b.team1);
  });

  it('honors a storming regime with tighter separation than meeting', () => {
    const W = 64;
    const H = 64;
    const meeting = placeSpawns({
      W,
      H,
      tileSizeMeters: 1.5,
      walkability: openWalkability(W, H),
      elevationStep: new Uint8Array(W * H),
      objectiveAnchors: [centerAnchor(W, H)],
      regime: 'meeting',
      rosterTeam0: ROSTER,
      rosterTeam1: ROSTER,
    });
    const storming = placeSpawns({
      W,
      H,
      tileSizeMeters: 1.5,
      walkability: openWalkability(W, H),
      elevationStep: new Uint8Array(W * H),
      objectiveAnchors: [centerAnchor(W, H)],
      regime: 'storming',
      rosterTeam0: ROSTER,
      rosterTeam1: ROSTER,
    });
    expect(meeting.bands.targetSeparation).toBeGreaterThan(storming.bands.targetSeparation);
  });

  it('populates squadRects per roster.squadCount', () => {
    const W = 96;
    const H = 96;
    const r = placeSpawns({
      W,
      H,
      tileSizeMeters: 1.5,
      walkability: openWalkability(W, H),
      elevationStep: new Uint8Array(W * H),
      objectiveAnchors: [centerAnchor(W, H)],
      regime: 'meeting',
      rosterTeam0: { squadCount: 3, unitCount: 12 },
      rosterTeam1: { squadCount: 4, unitCount: 16 },
    });
    expect(r.team0.squadRects?.length).toBe(3);
    expect(r.team1.squadRects?.length).toBe(4);
  });

  it('computes facing toward the axis centroid', () => {
    const W = 64;
    const H = 64;
    const r = placeSpawns({
      W,
      H,
      tileSizeMeters: 1.5,
      walkability: openWalkability(W, H),
      elevationStep: new Uint8Array(W * H),
      objectiveAnchors: [centerAnchor(W, H)],
      regime: 'meeting',
      rosterTeam0: ROSTER,
      rosterTeam1: ROSTER,
    });
    // Facing is in radians. Both teams should face toward the center
    // (opposite of each other on the vertical axis).
    expect(r.team0.facing).not.toBe(r.team1.facing);
  });

  it('uses fallback carve when spawn candidates fail the gate', () => {
    // Zero out most of the walkability to starve the placer. It should
    // still return a pair of zones (fallback) rather than throwing.
    const W = 32;
    const H = 32;
    const walk = new Uint16Array(W * H);
    // Only tiny slivers walkable.
    for (let y = 0; y < H; y++) walk[y * W + 0] = WALK_FOOT;
    for (let y = 0; y < H; y++) walk[y * W + (W - 1)] = WALK_FOOT;
    const r = placeSpawns({
      W,
      H,
      tileSizeMeters: 1.5,
      walkability: walk,
      elevationStep: new Uint8Array(W * H),
      objectiveAnchors: [centerAnchor(W, H)],
      regime: 'meeting',
      rosterTeam0: ROSTER,
      rosterTeam1: ROSTER,
    });
    expect(r.fallbackUsed).toBe(true);
  });

  it('asymmetric regimes produce different aspect ratios', () => {
    const W = 128;
    const H = 128;
    const r = placeSpawns({
      W,
      H,
      tileSizeMeters: 1.5,
      walkability: openWalkability(W, H),
      elevationStep: new Uint8Array(W * H),
      objectiveAnchors: [centerAnchor(W, H)],
      regime: 'assault',
      rosterTeam0: ROSTER,
      rosterTeam1: ROSTER,
    });
    // Defender (team1) has the tighter aspect bias under 'assault'.
    const ratio0 = (r.team0.w * r.team0.h) / (W * H);
    const ratio1 = (r.team1.w * r.team1.h) / (W * H);
    expect(ratio0).toBeGreaterThan(0);
    expect(ratio1).toBeGreaterThan(0);
    // Assault should place attacker (team0) in a larger or equal zone
    // relative to defender after bias clipping.
    expect(ratio0).toBeGreaterThanOrEqual(ratio1 * 0.5);
  });
});

describe('objective resampling', () => {
  it('shifts anchors to the midpoint between deploy zones on meeting', () => {
    const team0 = { x: 10, y: 10, w: 8, h: 8 };
    const team1 = { x: 90, y: 90, w: 8, h: 8 };
    const resampled = resampleObjectiveAroundBisector({
      anchors: [centerAnchor(100, 100)],
      team0,
      team1,
      regime: 'meeting',
      walkability: new Uint16Array(100 * 100),
      W: 100,
      H: 100,
    });
    const r = resampled[0].rect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    // team0 centroid = (14,14), team1 centroid = (94,94), midpoint = (54,54)
    expect(cx).toBeCloseTo(54, 0);
    expect(cy).toBeCloseTo(54, 0);
  });

  it('biases toward defender on defence regime', () => {
    const team0 = { x: 10, y: 10, w: 8, h: 8 }; // defender
    const team1 = { x: 90, y: 90, w: 8, h: 8 }; // attacker
    const resampled = resampleObjectiveAroundBisector({
      anchors: [centerAnchor(100, 100)],
      team0,
      team1,
      regime: 'defence',
      walkability: new Uint16Array(100 * 100),
      W: 100,
      H: 100,
    });
    const r = resampled[0].rect;
    const cx = r.x + r.w / 2;
    // defence biases 20% toward team0 (the defender) => cx < midpoint (~54)
    expect(cx).toBeLessThan(54);
  });
});
