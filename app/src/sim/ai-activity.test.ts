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
import { RecordingSim } from './replay';
import { buildGeneratedMap, buildScenario } from './scenario';

// These tests prove the AI standstill bug is fixed — units on a generated
// map must actually move toward the objective within a few hundred ticks.
// Without the fixes (eliminate-ban + enemy waypoint regen + BT terminal
// fallback), units stand still forever on generated maps.

function extractContract(seed = 'ai-test'): Contract {
  return {
    id: `ai-test-${seed}`,
    name: 'AI Activity Test',
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

// Minimal sim harness: stub out content/faction/templates and run N ticks
// recording a trace. We're testing the integration — scenario → objectives
// → tick → BT — not the full deployment pipeline.
function runGeneratedScenario(ticks: number): UnitTraceRow[] {
  const contract = extractContract();
  const genReq = mapGenRequestFromContract(contract, 1.5, 1);
  const gen = buildGeneratedMap(genReq, contract.name, `gen:${contract.id}`, {
    team0: 2,
    team1: 2,
  });
  const result = runPipeline(genReq);
  const overrides = bindObjectivesToAnchors(contract, result.objectiveAnchors);

  // Stub content that won't fire any weapons — we just need units on the
  // board with waypoints so we can observe movement.
  const noopContent = {
    weapon: () => undefined,
    armor: () => undefined,
    utility: () => undefined,
  };
  const templates = new Map();
  // Empty deployments + faction — buildScenario will spawn zero units.
  // We need units; build a dummy faction+deployments the cheapest way.
  const dummyFaction = {
    id: 'f',
    name: 'f',
    ideology: 'x',
    roster: [
      {
        archetype: 'a',
        tier: 'regular' as const,
        loadoutTemplateId: 't',
      },
    ],
  };
  templates.set('t', {
    id: 't',
    name: 't',
    role: 'rifleman' as const,
    primaryWeaponId: null,
    sidearmId: null,
    armorId: null,
    utilityIds: [],
  });

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
  for (let i = 0; i < ticks && !sim.current().ended; i++) {
    sim.step();
    if (i % 10 === 0) trace.push(...captureTrace(sim.current()));
  }
  return trace;
}

describe('AI activity on generated maps', () => {
  // Regression guard on the pre-fix bug: on procedural maps without
  // authored waypoints, both teams used to spawn and idle forever because
  // the BT terminal branch returned idle when no target + no waypoints.
  // Post-fix: regenerateEnemyWaypoints feeds team-1, regeneratePlayerWaypoints
  // feeds team-0, and the BT terminal fallback advances toward the
  // opposing team's home centroid.
  //
  // Progress around scattered buildings is capped until real pathfinding
  // lands — the wall-slide + perpendicular-probe only resolves thin
  // obstacles, so raw displacement is modest. The point of these tests is
  // "not standing still", not "reaches the objective".

  it('team 0 units try to advance (non-zero path length + "advance" BT state)', () => {
    const trace = runGeneratedScenario(300);
    const summary = summarizeActivity(trace);
    const team0 = summary.filter((u) => u.teamId === 0);
    expect(team0.length).toBeGreaterThan(0);
    const everyoneTriedToAdvance = team0.every(
      (u) => u.distanceTraveled > 0.5 && u.aiStatesSeen.includes('advance'),
    );
    if (!everyoneTriedToAdvance) {
      console.log('[ai-activity] team 0 failure:\n', formatActivityTable(summary));
    }
    expect(everyoneTriedToAdvance).toBe(true);
  });

  it('team 1 units try to advance (non-zero path length + "advance" BT state)', () => {
    const trace = runGeneratedScenario(300);
    const summary = summarizeActivity(trace);
    const team1 = summary.filter((u) => u.teamId === 1);
    expect(team1.length).toBeGreaterThan(0);
    const everyoneTriedToAdvance = team1.every(
      (u) => u.distanceTraveled > 0.5 && u.aiStatesSeen.includes('advance'),
    );
    if (!everyoneTriedToAdvance) {
      console.log('[ai-activity] team 1 failure:\n', formatActivityTable(summary));
    }
    expect(everyoneTriedToAdvance).toBe(true);
  });

  it('both teams accumulate "moving" action ticks, not pure idle', () => {
    const trace = runGeneratedScenario(300);
    const summary = summarizeActivity(trace);
    for (const u of summary) {
      if (u.ticksMoving === 0) {
        console.log(`[ai-activity] unit ${u.unitId} never moved:\n`, formatActivityTable(summary));
      }
      expect(u.ticksMoving).toBeGreaterThan(0);
    }
  });
});
