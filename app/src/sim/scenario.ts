import type { Contract } from '@schema/contract';
import type { Faction } from '@schema/faction';
import type { GameMap } from '@schema/map';
import type { LoadoutTemplate } from '@schema/template';
import { asUnitId, type UnitId } from '@shared/ids';
import type { ContentLookup, Loadout } from './loadout';
import { deriveCombatProfile, loadoutFromTemplate } from './loadout';
import { runPipeline } from './mapgen/pipeline';
import type { MapGenRequest, MapGenResult } from './mapgen/types';
import { makeSquadRuntime, pickLeader, type SquadRuntimeState } from './squad';
import type { ObjectiveRect, ObjectiveRuntimeState, SimState } from './state';
import { makeInitialState } from './tick';
import type { Unit, UnitRole, UnitStats, Vec2 } from './unit';
import { DEFAULT_STATS, makeUnit } from './unit';
import { makeWorld, makeWorldFromBuffers, setTerrain, type World } from './world';

export type ScenarioDeployment = {
  readonly operatorId: string;
  readonly stats: UnitStats;
  readonly loadout: Loadout;
  readonly templateId?: string;
  // ADR 003 squad hierarchy — the player deploys squads, not loose
  // operators. Null/absent means "no squad" (enemies; training fixtures).
  readonly squadId?: string | null;
};

export type BuildScenarioInput = {
  readonly seed: number;
  readonly contract: Contract;
  readonly map: GameMap;
  readonly faction: Faction;
  readonly content: ContentLookup;
  readonly templates: ReadonlyMap<string, LoadoutTemplate>;
  readonly deployments: readonly ScenarioDeployment[];
  // Optional objective-id → zone overrides, supplied by the contract →
  // anchor binder after map generation so contracts with missing params
  // (like "extract" without a zone) resolve to generator-picked anchors.
  readonly objectiveZoneOverrides?: ReadonlyMap<string, ObjectiveRect>;
};

function buildWorld(map: GameMap): World {
  const w = makeWorld(map.width, map.height, map.tileSizeMeters);
  for (const tile of map.tiles) {
    setTerrain(w, tile.x, tile.y, tile.terrain);
    if (tile.groundHeight) {
      w.groundHeight[tile.y * w.width + tile.x] = tile.groundHeight;
    }
  }
  return w;
}

// Generate a procedural map from the contract seed + biome and package it
// with spawn points sampled from the deploy zones. Returns a GameMap-shaped
// view for the existing scenario builder; note the tile list is intentionally
// empty — tiles live in the returned world buffer, not a JSON array.
export function buildGeneratedMap(
  request: MapGenRequest,
  name: string,
  id: string,
  spawnCount: { team0: number; team1: number },
): { map: GameMap; world: World; result: MapGenResult } {
  const result = runPipeline(request);
  const world = makeWorldFromBuffers(
    result.width,
    result.height,
    request.tileSizeMeters,
    result.terrain,
    result.walkability,
  );
  const team0Spawns = sampleSpawns(result.deployZones.team0, spawnCount.team0);
  const team1Spawns = sampleSpawns(result.deployZones.team1, spawnCount.team1);
  const map: GameMap = {
    id,
    name,
    width: result.width,
    height: result.height,
    tileSizeMeters: request.tileSizeMeters,
    tiles: [],
    playerSpawns: team0Spawns,
    enemySpawns: team1Spawns,
    waypointRoutes: [],
    generationSeed: request.seed,
    generationVersion: request.generationVersion,
    biome: request.biome,
  };
  return { map, world, result };
}

function sampleSpawns(
  zone: { x: number; y: number; w: number; h: number },
  count: number,
): { x: number; y: number; facing: number }[] {
  const out: { x: number; y: number; facing: number }[] = [];
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const dx = zone.w / (cols + 1);
  const dy = zone.h / (rows + 1);
  for (let r = 0; r < rows && out.length < count; r++) {
    for (let c = 0; c < cols && out.length < count; c++) {
      out.push({
        x: Math.floor(zone.x + dx * (c + 1)),
        y: Math.floor(zone.y + dy * (r + 1)),
        facing: 0,
      });
    }
  }
  return out;
}

function waypointsFor(map: GameMap, role: string, behavior: string): readonly Vec2[] {
  const route = map.waypointRoutes.find((r) => r.role === role && r.behavior === behavior);
  if (!route) return [];
  return route.points;
}

function statsForTier(tier: 'green' | 'regular' | 'veteran'): UnitStats {
  switch (tier) {
    case 'green':
      return { aim: 45, move: 55, grit: 40, awareness: 50, medical: 25 };
    case 'regular':
      return { aim: 60, move: 55, grit: 55, awareness: 60, medical: 30 };
    case 'veteran':
      return { aim: 75, move: 55, grit: 70, awareness: 70, medical: 35 };
  }
}

function roleFromTemplate(
  templateId: string | undefined,
  templates: ReadonlyMap<string, LoadoutTemplate>,
): UnitRole {
  if (!templateId) return 'rifleman';
  const t = templates.get(templateId);
  if (!t) return 'rifleman';
  return t.role === 'sidearm-only' ? 'rifleman' : t.role;
}

function translateObjectives(
  contract: Contract,
  fallbackZone: ObjectiveRect,
  overrides: ReadonlyMap<string, ObjectiveRect> | undefined,
): ObjectiveRuntimeState[] {
  const out: ObjectiveRuntimeState[] = [];
  for (const o of contract.objectives) {
    const p = o.params ?? {};
    const zone = overrides?.get(o.id) ?? p.zone ?? fallbackZone;
    if (o.kind === 'extract') {
      out.push({
        id: o.id,
        kind: o.kind,
        description: o.description,
        params: { kind: 'extract', zone, minUnitsInside: p.minUnitsInside ?? 1 },
        status: 'active',
        progressTicks: 0,
      });
    } else {
      // defend / secure
      out.push({
        id: o.id,
        kind: o.kind,
        description: o.description,
        params: { kind: o.kind, zone, holdTicks: p.holdTicks ?? 300 },
        status: 'active',
        progressTicks: 0,
      });
    }
  }
  return out;
}

export function buildScenario(input: BuildScenarioInput): SimState {
  // Procedurally generated maps skip the per-tile authoring loop — tiles are
  // already materialized in the world buffer via makeWorldFromBuffers at
  // buildGeneratedMap time. Fall back to the tile-list loader for authored
  // fixture maps (training-yard, test fixtures).
  let world: World;
  if (input.map.generationSeed !== undefined && input.map.tiles.length === 0) {
    // Tile buffer was produced at buildGeneratedMap; the authored path
    // calls buildWorld. If a caller hands us a seed-tagged map with no
    // upfront world, regenerate on the fly so the two paths stay
    // interchangeable — and carry the walkability grid with it so the
    // pathfinder has something to query.
    const regen = runPipeline({
      seed: input.map.generationSeed,
      biome: input.map.biome ?? 'mixed',
      size: input.map.width,
      tileSizeMeters: input.map.tileSizeMeters,
      generationVersion: input.map.generationVersion ?? 1,
    });
    world = makeWorldFromBuffers(
      input.map.width,
      input.map.height,
      input.map.tileSizeMeters,
      regen.terrain,
      regen.walkability,
    );
  } else {
    world = buildWorld(input.map);
  }
  const units: Unit[] = [];
  let nextId = 1;

  const tileToMeters = (x: number, y: number): Vec2 => ({
    x: x * input.map.tileSizeMeters,
    y: y * input.map.tileSizeMeters,
  });

  // Track squad→memberIds so we can build SquadRuntimeState after all
  // player units are spawned. Order preserved (first member of the squad
  // in the deployment list becomes the initial leader via pickLeader's
  // "first combat-capable" rule).
  const squadMembers = new Map<string, UnitId[]>();

  for (let i = 0; i < input.deployments.length && i < input.map.playerSpawns.length; i++) {
    const deploy = input.deployments[i];
    const spawn = input.map.playerSpawns[i];
    const pos = tileToMeters(spawn.x, spawn.y);
    const combat = deriveCombatProfile(deploy.loadout, input.content);

    const role = roleFromTemplate(deploy.templateId, input.templates);
    const waypoints = waypointsFor(input.map, role, 'advance').map((p) => tileToMeters(p.x, p.y));

    const unitId = asUnitId(nextId++) as UnitId;
    units.push(
      makeUnit({
        id: unitId,
        teamId: 0,
        operatorId: deploy.operatorId,
        position: pos,
        facing: spawn.facing,
        combat,
        stats: deploy.stats,
        waypoints,
        squadId: deploy.squadId ?? null,
        role,
      }),
    );
    if (deploy.squadId) {
      const arr = squadMembers.get(deploy.squadId) ?? [];
      arr.push(unitId);
      squadMembers.set(deploy.squadId, arr);
    }
  }

  // Enemy squadding: each archetype block chunks into fireteams of up to
  // ENEMY_SQUAD_SIZE so a contract with "12 riflemen" fields three fireteams
  // rather than one unwieldy clump or twelve lone wolves. Squad ids are
  // deterministic per archetype/chunk so replays stay stable.
  const ENEMY_SQUAD_SIZE = 4;
  const enemySquadMembers = new Map<string, UnitId[]>();
  let enemyIndex = 0;
  for (const archetype of input.contract.enemies.archetypes) {
    const factionMember = input.faction.roster.find((m) => m.archetype === archetype.archetype);
    if (!factionMember) continue;
    const template = input.templates.get(factionMember.loadoutTemplateId);
    if (!template) continue;
    const loadout = loadoutFromTemplate(template, input.content);
    const combat = deriveCombatProfile(loadout, input.content);
    const stats = statsForTier(factionMember.tier);
    const role: UnitRole = template.role === 'sidearm-only' ? 'rifleman' : template.role;

    for (let i = 0; i < archetype.count; i++) {
      if (enemyIndex >= input.map.enemySpawns.length) break;
      const spawn = input.map.enemySpawns[enemyIndex++];
      const pos = tileToMeters(spawn.x, spawn.y);
      const waypoints = waypointsFor(input.map, role, 'advance')
        .slice()
        .reverse()
        .map((p) => tileToMeters(p.x, p.y));

      const chunk = Math.floor(i / ENEMY_SQUAD_SIZE);
      const squadId = `e-sq-${archetype.archetype}-${chunk}`;
      const unitId = asUnitId(nextId++) as UnitId;
      units.push(
        makeUnit({
          id: unitId,
          teamId: 1,
          operatorId: null,
          position: pos,
          facing: spawn.facing,
          combat,
          stats,
          waypoints,
          squadId,
          role,
        }),
      );
      const arr = enemySquadMembers.get(squadId) ?? [];
      arr.push(unitId);
      enemySquadMembers.set(squadId, arr);
    }
  }

  // Compute team home positions (centroids of spawn points in meters) so
  // the objective layer and BT fallback have anchor positions for waypoint
  // regeneration. Crucial on procedurally-generated maps where neither
  // team has authored waypoints and the old code left units standing still.
  const team0HomePos = centroidOfSpawns(input.map.playerSpawns, input.map.tileSizeMeters);
  const team1HomePos = centroidOfSpawns(input.map.enemySpawns, input.map.tileSizeMeters);

  // Map-center rect as the fallback when a contract objective has no
  // authored zone (generated maps in particular — the anchor is decided
  // at gen time but stays derived from map center here to keep the old
  // contract JSON tolerant). Deploy/sim passes can override via the
  // contract binder in future.
  const fallbackZone: ObjectiveRect = {
    x: Math.max(0, Math.floor(input.map.width / 2) - 8),
    y: Math.max(0, Math.floor(input.map.height / 2) - 8),
    w: 16,
    h: 16,
  };

  // Build squad runtime states from the collected membership. Done after
  // the unit list is finalized so pickLeader sees real units. Both player
  // (team 0) and enemy (team 1) squads flow through the same code path —
  // the BT leader-follow branch is team-agnostic.
  const unitMap = new Map<UnitId, Unit>();
  for (const u of units) unitMap.set(u.id, u);
  const squads = new Map<string, SquadRuntimeState>();
  for (const [squadId, memberIds] of squadMembers) {
    const leader = pickLeader(memberIds, unitMap);
    squads.set(squadId, makeSquadRuntime(squadId, 0, memberIds, leader));
  }
  for (const [squadId, memberIds] of enemySquadMembers) {
    const leader = pickLeader(memberIds, unitMap);
    squads.set(squadId, makeSquadRuntime(squadId, 1, memberIds, leader));
  }

  return makeInitialState(
    world,
    input.seed,
    units,
    translateObjectives(input.contract, fallbackZone, input.objectiveZoneOverrides),
    { team0: team0HomePos, team1: team1HomePos },
    squads,
  );
}

function centroidOfSpawns(
  spawns: readonly { x: number; y: number }[],
  tileSizeMeters: number,
): Vec2 {
  if (spawns.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const s of spawns) {
    sx += s.x;
    sy += s.y;
  }
  return {
    x: (sx / spawns.length) * tileSizeMeters,
    y: (sy / spawns.length) * tileSizeMeters,
  };
}

export function autoDeploy(
  content: ContentLookup,
  templates: ReadonlyMap<string, LoadoutTemplate>,
  operators: Iterable<{ id: string; defaultTemplateId: string; stats: UnitStats }>,
  max: number,
): ScenarioDeployment[] {
  const out: ScenarioDeployment[] = [];
  for (const op of operators) {
    if (out.length >= max) break;
    const tpl = templates.get(op.defaultTemplateId);
    if (!tpl) continue;
    out.push({
      operatorId: op.id,
      stats: op.stats ?? DEFAULT_STATS,
      loadout: loadoutFromTemplate(tpl, content),
      templateId: op.defaultTemplateId,
    });
  }
  return out;
}
