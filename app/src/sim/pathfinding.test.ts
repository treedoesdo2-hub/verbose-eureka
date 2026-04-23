import type { Contract } from '@schema/contract';
import { describe, expect, it } from 'vitest';
import {
  captureTrace,
  formatActivityTable,
  summarizeActivity,
  type UnitTraceRow,
} from './debug-log';
import { bindObjectivesToAnchors, mapGenRequestFromContract } from './mapgen/contract-binder';
import { runPipeline } from './mapgen/pipeline';
import { findPathTiles, hasLineOfWalk, simplifyPath } from './pathfinding';
import { RecordingSim } from './replay';
import { buildGeneratedMap, buildScenario } from './scenario';
import { makeWorld, makeWorldFromBuffers, setPoint } from './world';

describe('pathfinding — findPathTiles', () => {
  it('routes around a central wall', () => {
    const world = makeWorld(10, 10, 1);
    // Wall at x=5 from y=0..8 (leaves gap at y=9).
    for (let y = 0; y <= 8; y++) setPoint(world, 5, y, 'storage_tank');
    const path = findPathTiles(world, 1, 1, 8, 1);
    expect(path.length).toBeGreaterThan(0);
    // Last waypoint should reach the goal tile (tile center is at goal+0.5).
    const last = path[path.length - 1];
    expect(Math.floor(last.x)).toBe(8);
    expect(Math.floor(last.y)).toBe(1);
    // Path must include y >= 9 somewhere since that's the only gap.
    const routedSouth = path.some((p) => Math.floor(p.y) >= 9);
    expect(routedSouth).toBe(true);
  });

  it('returns empty when goal is fully walled off and partial=false', () => {
    const world = makeWorld(10, 10, 1);
    // Box the goal in with buildings on all four sides.
    for (let d = -1; d <= 1; d++) {
      setPoint(world, 8 + d, 4, 'storage_tank');
      setPoint(world, 8 + d, 6, 'storage_tank');
    }
    setPoint(world, 7, 5, 'storage_tank');
    setPoint(world, 9, 5, 'storage_tank');
    const path = findPathTiles(world, 1, 1, 8, 5, { partial: false });
    expect(path.length).toBe(0);
  });

  it('returns a best-effort partial path when goal is unreachable and partial=true', () => {
    const world = makeWorld(10, 10, 1);
    for (let d = -1; d <= 1; d++) {
      setPoint(world, 8 + d, 4, 'storage_tank');
      setPoint(world, 8 + d, 6, 'storage_tank');
    }
    setPoint(world, 7, 5, 'storage_tank');
    setPoint(world, 9, 5, 'storage_tank');
    const path = findPathTiles(world, 1, 1, 8, 5, { partial: true });
    // Should approach but not reach — last waypoint is outside the wall.
    expect(path.length).toBeGreaterThan(0);
    const last = path[path.length - 1];
    expect(Math.floor(last.x)).not.toBe(8);
  });

  it('is deterministic for the same inputs', () => {
    const world = makeWorld(16, 16, 1);
    setPoint(world, 8, 5, 'storage_tank');
    setPoint(world, 8, 6, 'storage_tank');
    const a = findPathTiles(world, 2, 2, 14, 10);
    const b = findPathTiles(world, 2, 2, 14, 10);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x).toBe(b[i].x);
      expect(a[i].y).toBe(b[i].y);
    }
  });
});

describe('pathfinding — simplifyPath', () => {
  it('collapses collinear waypoints on a straight run', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    const s = simplifyPath(path);
    expect(s.length).toBe(2);
    expect(s[0]).toEqual({ x: 0, y: 0 });
    expect(s[1]).toEqual({ x: 3, y: 0 });
  });

  it('preserves turn waypoints', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ];
    const s = simplifyPath(path);
    expect(s.length).toBe(3);
  });
});

describe('pathfinding — hasLineOfWalk', () => {
  it('returns true for a clear straight shot', () => {
    const world = makeWorld(10, 10, 1);
    expect(hasLineOfWalk(world, { x: 1.5, y: 1.5 }, { x: 8.5, y: 1.5 })).toBe(true);
  });

  it('returns false when a building sits on the line', () => {
    const world = makeWorld(10, 10, 1);
    setPoint(world, 5, 1, 'storage_tank');
    expect(hasLineOfWalk(world, { x: 1.5, y: 1.5 }, { x: 8.5, y: 1.5 })).toBe(false);
  });

  it('returns true for same-tile endpoints', () => {
    const world = makeWorld(10, 10, 1);
    expect(hasLineOfWalk(world, { x: 2.2, y: 2.8 }, { x: 2.9, y: 2.1 })).toBe(true);
  });
});

// COA-8 task #32 — slope cost + cliff guard regression. A*'s step cost
// ramps with elevation delta (SLOPE_COST_PER_STEP = 0.5) and a single-step
// delta > MAX_STEP_ELEV_DELTA = 2 cannot be crossed at all.

describe('pathfinding — slope cost + cliff guard', () => {
  it('routes around a cliff wall (delta > 2) rather than climbing over', () => {
    const world = makeWorld(20, 10, 1);
    // Vertical cliff at x=10 from y=0..y=7: elevationStep=7 (high plateau).
    // Leaves a 2-row corridor y=8..9 at ground level (step=0) for a route.
    for (let y = 0; y <= 7; y++) {
      world.elevationStep[y * world.width + 10] = 7;
    }
    const path = findPathTiles(world, 5, 4, 15, 4, { partial: false });
    expect(path.length).toBeGreaterThan(0);
    // Path must route south through the open corridor (y >= 8) since
    // climbing the cliff would violate MAX_STEP_ELEV_DELTA = 2.
    const routedSouth = path.some((p) => Math.floor(p.y) >= 8);
    expect(routedSouth).toBe(true);
  });

  it('traverses a symmetric ramp (0→5→0, delta=1 per step) without blocking', () => {
    const world = makeWorld(24, 10, 1);
    // Ramp up then down across x=8..19: steps 0,1,2,3,4,5,5,4,3,2,1,0.
    const ramp = [1, 2, 3, 4, 5, 5, 4, 3, 2, 1];
    for (let i = 0; i < ramp.length; i++) {
      for (let y = 0; y < 10; y++) {
        world.elevationStep[y * world.width + (8 + i)] = ramp[i];
      }
    }
    const path = findPathTiles(world, 2, 5, 22, 5, { partial: false });
    expect(path.length).toBeGreaterThan(0);
  });

  it('cannot cross a 3-step cliff edge in a single move', () => {
    const world = makeWorld(10, 10, 1);
    // Half the map at step=0, half at step=3 (4.5m drop). Only way across
    // is via a tile with intermediate elevation — not provided here.
    for (let y = 0; y < 10; y++) {
      for (let x = 5; x < 10; x++) {
        world.elevationStep[y * world.width + x] = 3;
      }
    }
    const path = findPathTiles(world, 2, 5, 8, 5, { partial: false });
    // With a hard 3-step delta and no ramp, path should fail (empty under
    // partial:false).
    expect(path.length).toBe(0);
  });

  it('partial=true returns best-effort prefix when blocked by cliffs', () => {
    const world = makeWorld(10, 10, 1);
    for (let y = 0; y < 10; y++) {
      for (let x = 5; x < 10; x++) {
        world.elevationStep[y * world.width + x] = 3;
      }
    }
    const path = findPathTiles(world, 2, 5, 8, 5, { partial: true });
    expect(path.length).toBeGreaterThan(0);
    // Must not cross into the high plateau.
    const lastInMeters = path[path.length - 1];
    const lastTileX = Math.floor(lastInMeters.x / world.tileSizeMeters);
    expect(lastTileX).toBeLessThan(5);
  });
});

describe('pathfinding — generated-map integration', () => {
  it('produces a routed multi-waypoint path on a generated urban map', () => {
    const result = runPipeline({
      seed: 'pathfind-integration',
      biome: 'urban_sparse',
      size: 128,
      tileSizeMeters: 1.5,
      generationVersion: 1,
    });
    const world = makeWorldFromBuffers({
      width: result.width,
      height: result.height,
      tileSizeMeters: 1.5,
      base: result.base,
      point: result.point,
      buildingId: result.buildingId,
      walkability: result.walkability,
      elevationStep: result.elevationStep,
    });
    expect(world.walkability).not.toBeNull();
    const path = findPathTiles(world, 63, 118, 64, 8, { partial: true });
    const simp = simplifyPath(path.map((p) => ({ x: p.x, y: p.y })));
    // Even with partial, zero waypoints would mean the start tile is
    // unreachable — a real bug worth shouting about.
    expect(simp.length).toBeGreaterThan(0);
    // Last waypoint should be reasonably close to the goal tile center.
    const last = simp[simp.length - 1];
    expect(Math.abs(last.x - (64 + 0.5) * 1.5)).toBeLessThan(5);
    expect(Math.abs(last.y - (8 + 0.5) * 1.5)).toBeLessThan(5);
  });
});

describe('pathfinding — end-to-end sim integration', () => {
  // The pre-pathfinding regression (committed as 4c3f7da) left units at
  // roughly 3m of travel after 300 ticks on a generated urban_sparse map
  // because they pinned against building walls. With pathfinding they
  // route around and travel far more. This test is the acceptance gate.

  function testContract(): Contract {
    return {
      id: 'pathfind-integration',
      name: 'Pathfinding Integration',
      mapId: 'unused',
      payout: {
        cash: 100,
        salvagePriorityPicks: 0,
        reputationDelta: 0,
        secondaryBonusCash: 0,
        goodFaithFraction: 0,
      },
      deployCost: { fixedPerContract: 10 },
      recommendedOperators: { green: 1, regular: 1, veteran: 0 },
      difficultyRating: 1,
      modifiers: {
        extractionSeats: null,
        requiredRoleTags: [],
        biomeHint: 'urban_sparse',
        sizeHint: 'small',
      },
      briefing: 'b',
      objectives: [
        {
          id: 'obj-extract',
          kind: 'extract',
          description: 'extract at cache',
          params: { minUnitsInside: 1 },
        },
      ],
      enemies: { factionId: 'f', archetypes: [{ archetype: 'a', count: 1 }] },
      minOperators: 1,
      maxOperators: 4,
    } as Contract;
  }

  it('units travel meaningful distance on a generated urban map', () => {
    const contract = testContract();
    const genReq = mapGenRequestFromContract(contract, 1.5, 1);
    const gen = buildGeneratedMap(genReq, contract.name, `gen:${contract.id}`, {
      team0: 2,
      team1: 2,
    });
    const result = runPipeline(genReq);
    const overrides = bindObjectivesToAnchors(contract, result.objectiveAnchors);

    const noopContent = {
      weapon: () => undefined,
      armor: () => undefined,
      utility: () => undefined,
    };
    const templates = new Map();
    templates.set('t', {
      id: 't',
      name: 't',
      role: 'rifleman' as const,
      primaryWeaponId: null,
      sidearmId: null,
      armorId: null,
      utilityIds: [],
    });
    const dummyFaction = {
      id: 'f',
      name: 'f',
      ideology: 'x',
      roster: [{ archetype: 'a', tier: 'regular' as const, loadoutTemplateId: 't' }],
    };
    const deployments = [
      {
        operatorId: 'op-1',
        stats: { aim: 60, move: 55, grit: 55, awareness: 60, medical: 30 },
        loadout: { items: [] },
        templateId: 't',
      },
      {
        operatorId: 'op-2',
        stats: { aim: 60, move: 55, grit: 55, awareness: 60, medical: 30 },
        loadout: { items: [] },
        templateId: 't',
      },
    ];

    const initial = buildScenario({
      seed: 42,
      contract,
      map: gen.map,
      faction: dummyFaction,
      content: noopContent,
      templates,
      deployments,
      objectiveZoneOverrides: overrides,
      prebuiltWorld: gen.world,
      prebuiltMapMeta: {
        dominantLine: gen.result.dominantLine,
        heroLandmark: gen.result.heroLandmark,
      },
    });
    const sim = new RecordingSim(initial, 42);
    const trace: UnitTraceRow[] = [];
    trace.push(...captureTrace(sim.current()));
    const TICKS = 600;
    for (let i = 0; i < TICKS && !sim.current().ended; i++) {
      sim.step();
      if (i % 20 === 0) trace.push(...captureTrace(sim.current()));
    }
    const summary = summarizeActivity(trace);
    // Pre-fix baseline: ~3m of path length. Pathfinding should get both
    // teams well past that — even a conservative threshold catches the
    // regression if pathfinding breaks.
    const minExpected = 15;
    const atLeastOneUnitMovedFar = summary.some((u) => u.distanceTraveled > minExpected);
    if (!atLeastOneUnitMovedFar) {
      console.log('[pathfinding] nobody moved far:\n', formatActivityTable(summary));
    }
    expect(atLeastOneUnitMovedFar).toBe(true);
  });
});
