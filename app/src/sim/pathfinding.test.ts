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
import { findPathTiles, simplifyPath } from './pathfinding';
import { RecordingSim } from './replay';
import { buildGeneratedMap, buildScenario } from './scenario';
import { makeWorld, makeWorldFromBuffers, setTerrain } from './world';

describe('pathfinding — findPathTiles', () => {
  it('routes around a central wall', () => {
    const world = makeWorld(10, 10, 1);
    // Wall at x=5 from y=0..8 (leaves gap at y=9).
    for (let y = 0; y <= 8; y++) setTerrain(world, 5, y, 'building');
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
      setTerrain(world, 8 + d, 4, 'building');
      setTerrain(world, 8 + d, 6, 'building');
    }
    setTerrain(world, 7, 5, 'building');
    setTerrain(world, 9, 5, 'building');
    const path = findPathTiles(world, 1, 1, 8, 5, { partial: false });
    expect(path.length).toBe(0);
  });

  it('returns a best-effort partial path when goal is unreachable and partial=true', () => {
    const world = makeWorld(10, 10, 1);
    for (let d = -1; d <= 1; d++) {
      setTerrain(world, 8 + d, 4, 'building');
      setTerrain(world, 8 + d, 6, 'building');
    }
    setTerrain(world, 7, 5, 'building');
    setTerrain(world, 9, 5, 'building');
    const path = findPathTiles(world, 1, 1, 8, 5, { partial: true });
    // Should approach but not reach — last waypoint is outside the wall.
    expect(path.length).toBeGreaterThan(0);
    const last = path[path.length - 1];
    expect(Math.floor(last.x)).not.toBe(8);
  });

  it('is deterministic for the same inputs', () => {
    const world = makeWorld(16, 16, 1);
    setTerrain(world, 8, 5, 'building');
    setTerrain(world, 8, 6, 'building');
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

describe('pathfinding — generated-map integration', () => {
  it('produces a routed multi-waypoint path on a generated urban map', () => {
    const result = runPipeline({
      seed: 'pathfind-integration',
      biome: 'urban_sparse',
      size: 128,
      tileSizeMeters: 1.5,
      generationVersion: 1,
    });
    const world = makeWorldFromBuffers(
      result.width,
      result.height,
      1.5,
      result.terrain,
      result.walkability,
    );
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
