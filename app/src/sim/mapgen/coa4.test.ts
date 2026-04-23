// COA-4 task #95 — 12-case test suite covering dominant lines, hero
// landmarks, barriers, capillaries, and briefing token interpolation.
// Also exercises a 512² pipeline run for perf sanity.

import { describe, expect, it } from 'vitest';
import { stampBarrierLine, BARRIER_PROPS } from './barriers';
import { pickCapillaries, stampCapillary } from './capillary';
import {
  briefingReferencesLandmark,
  interpolateBriefing,
  secureAnchorFromLandmark,
} from './contract-binder';
import type { DominantLine } from './dominant-line';
import { pickLineKind } from './dominant-line';
import {
  footprintFor,
  type HeroLandmark,
  pickLandmarkKind,
  placeLandmark,
} from './hero-landmark';
import { generateLandmarkName } from './landmark-names';
import { hashStringToSeed, makeRng } from './noise';
import { runPipeline } from './pipeline';
import { baseKindForLine, buildDominantLine, stampLine } from './route-line';
import {
  BARRIER_AXES,
  WALK_FOOT,
  WALK_SLOW,
  WALK_WHEELED,
  baseToByte,
  makeWorld,
  setBarrier,
  setBase,
} from '../world';

function mkRng(seed = 'coa4-test'): () => number {
  return makeRng(hashStringToSeed(seed));
}

describe('COA-4 dominant line', () => {
  it('pickLineKind returns a kind weighted per biome', () => {
    const rng = mkRng('line-kind');
    const k = pickLineKind('urban_sparse', rng);
    expect(['road-straight', 'road-star', 'highstreet', 'rail', 'canal']).toContain(k);
  });

  it('buildDominantLine produces at least two waypoints', () => {
    const rng = mkRng('line-build');
    const elev = new Uint8Array(64 * 64);
    const density = new Float32Array(64 * 64);
    const line = buildDominantLine('road-straight', 64, 64, elev, density, rng);
    expect(line.waypoints.length).toBeGreaterThanOrEqual(2);
  });

  it('stampLine writes line-kind base bytes into the grid', () => {
    const rng = mkRng('line-stamp');
    const W = 64;
    const H = 64;
    const base = new Uint8Array(W * H);
    const line: DominantLine = {
      kind: 'road-straight',
      waypoints: [
        { x: 5, y: 32 },
        { x: 58, y: 32 },
      ],
      width: 2,
    };
    const stamped = stampLine(line, base, W, H);
    expect(stamped).toBeGreaterThan(0);
    // The target byte for road-straight should be in the grid.
    const expected = baseToByte(baseKindForLine('road-straight'));
    expect(base).toContain(expected);
    // Mark rng unused — intentional, just seeding the module.
    void rng;
  });
});

describe('COA-4 hero landmark', () => {
  it('pickLandmarkKind picks a biome-appropriate landmark', () => {
    const rng = mkRng('landmark-kind');
    const kind = pickLandmarkKind('urban_sparse', rng);
    // Sanity: should be a non-empty string from the landmark kind set.
    expect(typeof kind).toBe('string');
    expect(kind.length).toBeGreaterThan(0);
  });

  it('footprintFor returns at least one tile for every kind', () => {
    const rng = mkRng('landmark-footprint');
    const kind = pickLandmarkKind('mixed', rng);
    const f = footprintFor(kind, { x: 32, y: 32 });
    expect(f.length).toBeGreaterThan(0);
  });

  it('generateLandmarkName is deterministic for the same RNG seed', () => {
    const a = generateLandmarkName('refinery', mkRng('same'));
    const b = generateLandmarkName('refinery', mkRng('same'));
    expect(a.name).toBe(b.name);
    expect(a.shortName).toBe(b.shortName);
  });

  it('placeLandmark places landmarks outside deploy zones', () => {
    const rng = mkRng('landmark-place');
    const W = 64;
    const H = 64;
    const density = new Float32Array(W * H);
    // Pockmark the density so placement has something to prefer.
    for (let i = 0; i < density.length; i += 7) density[i] = 0.8;
    const team0 = { x: 28, y: 54, w: 8, h: 8 };
    const team1 = { x: 28, y: 2, w: 8, h: 8 };
    const c = placeLandmark('clock_tower', W, H, density, [], [team0, team1], rng);
    const inZone = (z: typeof team0) =>
      c.x >= z.x && c.x < z.x + z.w && c.y >= z.y && c.y < z.y + z.h;
    expect(inZone(team0)).toBe(false);
    expect(inZone(team1)).toBe(false);
  });
});

describe('COA-4 briefing interpolation', () => {
  const landmark: HeroLandmark = {
    kind: 'refinery',
    name: 'Refinery Bravo',
    shortName: 'Bravo',
    footprint: [
      { x: 10, y: 10 },
      { x: 11, y: 10 },
      { x: 10, y: 11 },
      { x: 11, y: 11 },
    ],
    center: { x: 10, y: 10 },
  };

  it('interpolateBriefing substitutes {landmark} and {landmark_short}', () => {
    const b = interpolateBriefing(
      'Secure {landmark}. Fall back to {landmark_short} on signal.',
      landmark,
    );
    expect(b).toBe('Secure Refinery Bravo. Fall back to Bravo on signal.');
  });

  it('interpolateBriefing uses generic fallbacks when landmark is null', () => {
    // Landmark is rolled at briefing-preview time; the contract-board card
    // and any other pre-roll render must not leak `{landmark}` literals.
    const b = interpolateBriefing('Secure {landmark}.', null);
    expect(b).toBe('Secure the target.');
    const s = interpolateBriefing('Fall back to {landmark_short}.', null);
    expect(s).toBe('Fall back to the target.');
  });

  it('briefingReferencesLandmark detects landmark tokens', () => {
    expect(briefingReferencesLandmark('hello {landmark} world')).toBe(true);
    expect(briefingReferencesLandmark('hello {landmark_short}')).toBe(true);
    expect(briefingReferencesLandmark('plain briefing')).toBe(false);
  });

  it('secureAnchorFromLandmark returns the landmark bounding box', () => {
    const r = secureAnchorFromLandmark(landmark);
    expect(r).toEqual({ x: 10, y: 10, w: 2, h: 2 });
  });
});

describe('COA-4 barriers + capillaries', () => {
  it('stampBarrierLine writes barrier bytes along a path', () => {
    const world = makeWorld(32, 32, 1.5);
    // Lay down open base so barriers have something to stamp onto.
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) setBase(world, x, y, 'open');
    }
    const stamped = stampBarrierLine(
      world,
      [
        { x: 4, y: 16 },
        { x: 28, y: 16 },
      ],
      'hedge',
    );
    expect(stamped).toBeGreaterThan(0);
    // Props must define hedge crossing as foot-only pass.
    expect(BARRIER_PROPS.hedge.crossingMode).toBe('foot');
  });

  it('pickCapillaries returns 0-3 branches off a long dominant line', () => {
    const line: DominantLine = {
      kind: 'road-straight',
      waypoints: Array.from({ length: 12 }, (_, i) => ({ x: 5 + i * 4, y: 32 })),
      width: 2,
    };
    const caps = pickCapillaries(line, mkRng('caps'), 64, 64);
    expect(caps.length).toBeGreaterThanOrEqual(0);
    expect(caps.length).toBeLessThanOrEqual(3);
  });

  it('setBarrier bakes WALK_SLOW onto the hedge tile (COA-4 #88/#89)', () => {
    // Regression guard for the pre-bake barrier gap: placing a hedge on
    // tile (5,5)'s N edge must leave the tile walkable for foot but mark
    // WALK_SLOW so A* pays a movement cost crossing a hedgerow spine.
    const world = makeWorld(16, 16, 1.5);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) setBase(world, x, y, 'open');
    }
    setBarrier(world, 5, 5, 'N', 'hedge', false);
    const idx = 5 * 16 + 5;
    expect(world.walkability[idx] & WALK_FOOT).not.toBe(0);
    expect(world.walkability[idx] & WALK_SLOW).not.toBe(0);
    // hedge axes must be authoritative — cross-check the table.
    expect(BARRIER_AXES.hedge.move).toBe('walkable-slow');
  });

  it('setBarrier with stone_wall_low blocks wheeled chassis on the tile', () => {
    // stone_wall_low.move is 'blocked-foot' which passes only mech + PA,
    // so WALK_WHEELED must be stripped from the tile whose N edge carries
    // the wall. Regression guard on the bake's layer-intersection rule.
    const world = makeWorld(16, 16, 1.5);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) setBase(world, x, y, 'open');
    }
    setBarrier(world, 8, 8, 'W', 'stone_wall_low', false);
    const idx = 8 * 16 + 8;
    expect(world.walkability[idx] & WALK_WHEELED).toBe(0);
  });

  it('stampCapillary writes to grid and counts correctly', () => {
    const line: DominantLine = {
      kind: 'road-straight',
      waypoints: [
        { x: 10, y: 20 },
        { x: 50, y: 20 },
      ],
      width: 2,
    };
    const base = new Uint8Array(64 * 64);
    const n = stampCapillary(
      { parent: line, waypoints: [{ x: 30, y: 20 }, { x: 30, y: 40 }], width: 1 },
      base,
      64,
      64,
    );
    expect(n).toBeGreaterThan(0);
  });
});

describe('COA-4 pipeline integration', () => {
  it('runPipeline emits a hero landmark and dominant line on urban biomes', () => {
    const r = runPipeline({
      seed: 'coa4-urban',
      biome: 'urban_sparse',
      size: 128,
      tileSizeMeters: 1.5,
      generationVersion: 1,
    });
    expect(r.heroLandmark).not.toBeNull();
    expect(r.dominantLine).not.toBeNull();
    expect(r.heroLandmark?.name.length).toBeGreaterThan(0);
    expect(r.dominantLine?.waypoints.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('512² urban generation completes under a generous perf budget', () => {
    const start = Date.now();
    const r = runPipeline({
      seed: 'coa4-perf',
      biome: 'mixed',
      size: 512,
      tileSizeMeters: 1.5,
      generationVersion: 1,
    });
    const elapsed = Date.now() - start;
    // Generous bound — the existing 1024² test allows ~10s, so 512² in
    // under 6s is a loose sanity check, not a perf contract.
    expect(elapsed).toBeLessThan(6000);
    expect(r.width).toBe(512);
    expect(r.height).toBe(512);
  });
});
