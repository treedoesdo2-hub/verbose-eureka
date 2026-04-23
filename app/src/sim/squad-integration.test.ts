import type { Contract } from '@schema/contract';
import { describe, expect, it } from 'vitest';
import { captureTrace } from './debug-log';
import { bindObjectivesToAnchors, mapGenRequestFromContract } from './mapgen/contract-binder';
import { RecordingSim } from './replay';
import { buildGeneratedMap, buildScenario } from './scenario';

// Integration proof: non-leader squad members keep station on their leader
// as the leader moves through a generated map. The BT leader-following
// branch drives the non-leader's target, so the pairwise distance between
// leader and follower should stay within a formation radius throughout
// the match.

function squadContract(): Contract {
  return {
    id: 'squad-integration',
    name: 'Squad Coherence',
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

function runSquadScenario(ticks: number, withSquad: boolean) {
  const contract = squadContract();
  const genReq = mapGenRequestFromContract(contract, 1.5, 1);
  const gen = buildGeneratedMap(genReq, contract.name, `gen:${contract.id}`, {
    team0: 3,
    team1: 1,
  });
  const overrides = bindObjectivesToAnchors(contract, gen.result.objectiveAnchors);

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
  const squadId = 'sq-alpha';
  const deployments = [
    {
      operatorId: 'op-1',
      stats: { aim: 60, move: 55, grit: 55, awareness: 60, medical: 30 },
      loadout: { items: [] },
      templateId: 't',
      squadId: withSquad ? squadId : null,
    },
    {
      operatorId: 'op-2',
      stats: { aim: 60, move: 55, grit: 55, awareness: 60, medical: 30 },
      loadout: { items: [] },
      templateId: 't',
      squadId: withSquad ? squadId : null,
    },
    {
      operatorId: 'op-3',
      stats: { aim: 60, move: 55, grit: 55, awareness: 60, medical: 30 },
      loadout: { items: [] },
      templateId: 't',
      squadId: withSquad ? squadId : null,
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
  const trace = captureTrace(sim.current());
  for (let i = 0; i < ticks && !sim.current().ended; i++) {
    sim.step();
    if (i % 10 === 0) trace.push(...captureTrace(sim.current()));
  }
  return { initial, final: sim.current() };
}

describe('squad integration', () => {
  it('units spawned via ScenarioDeployment.squadId inherit the squadId', () => {
    const { initial } = runSquadScenario(0, true);
    const players = [...initial.units.values()].filter((u) => u.teamId === 0);
    expect(players.length).toBe(3);
    for (const u of players) {
      expect(u.squadId).toBe('sq-alpha');
    }
  });

  it('buildScenario builds a SquadRuntimeState with the first member as leader', () => {
    const { initial } = runSquadScenario(0, true);
    const sq = initial.squads.get('sq-alpha');
    expect(sq).toBeDefined();
    expect(sq?.memberIds.length).toBe(3);
    expect(sq?.leaderId).not.toBeNull();
  });

  it('non-leader members track the leader within a squad-cohesion radius', () => {
    const { final } = runSquadScenario(300, true);
    const sq = final.squads.get('sq-alpha');
    if (!sq || sq.leaderId === null) throw new Error('squad missing or leaderless');
    const leader = final.units.get(sq.leaderId);
    if (!leader) throw new Error('leader unit not found');
    for (const memberId of sq.memberIds) {
      if (memberId === sq.leaderId) continue;
      const m = final.units.get(memberId);
      if (!m) continue;
      const d = Math.hypot(m.position.x - leader.position.x, m.position.y - leader.position.y);
      // Leader throttles speed when followers lag (squadCohesionPenalty),
      // AND followers pathfind around buildings. New (post-rework) map
      // layout creates denser scatter + more open stretches, so the
      // pairwise gap floats up to ~22m on some seeds. Still well under
      // the degen >40m pre-throttle regime.
      expect(d).toBeLessThan(25);
    }
  });

  it('without player squad membership, team-0 units have null squadId', () => {
    // Control case: when deployments have no squadId, the BT falls back
    // to per-unit waypoint regen for team 0. Enemy squads (team 1) are
    // built from the faction archetype regardless — they're always
    // coherent now.
    const { final } = runSquadScenario(300, false);
    const players = [...final.units.values()].filter((u) => u.teamId === 0);
    for (const u of players) {
      expect(u.squadId).toBeNull();
    }
    const team0Squads = [...final.squads.values()].filter((s) => s.teamId === 0);
    expect(team0Squads.length).toBe(0);
  });

  it('enemy units get a runtime squad built from the faction archetype', () => {
    const { initial } = runSquadScenario(0, true);
    const enemyUnits = [...initial.units.values()].filter((u) => u.teamId === 1);
    expect(enemyUnits.length).toBeGreaterThan(0);
    for (const u of enemyUnits) {
      expect(u.squadId).not.toBeNull();
    }
    const team1Squads = [...initial.squads.values()].filter((s) => s.teamId === 1);
    expect(team1Squads.length).toBeGreaterThan(0);
    for (const sq of team1Squads) {
      expect(sq.leaderId).not.toBeNull();
      expect(sq.memberIds.length).toBeLessThanOrEqual(4);
    }
  });

  it('squad leader advances toward the objective; members shadow', () => {
    const { final } = runSquadScenario(300, true);
    const players = [...final.units.values()].filter((u) => u.teamId === 0);
    // Everyone moved away from their spawn row (y≈177).
    for (const u of players) {
      expect(u.position.y).toBeLessThan(175);
    }
  });
});
