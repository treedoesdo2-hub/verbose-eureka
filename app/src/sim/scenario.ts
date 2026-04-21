import type { Contract } from '@schema/contract';
import type { Faction } from '@schema/faction';
import type { GameMap } from '@schema/map';
import type { LoadoutTemplate } from '@schema/template';
import { asUnitId, type UnitId } from '@shared/ids';
import type { ContentLookup, Loadout } from './loadout';
import { deriveCombatProfile, loadoutFromTemplate } from './loadout';
import type { SimState } from './state';
import { makeInitialState } from './tick';
import type { Unit, UnitStats, Vec2 } from './unit';
import { DEFAULT_STATS, makeUnit } from './unit';
import { makeWorld, setTerrain, type World } from './world';

export type ScenarioDeployment = {
  readonly operatorId: string;
  readonly stats: UnitStats;
  readonly loadout: Loadout;
  readonly templateId?: string;
};

export type BuildScenarioInput = {
  readonly seed: number;
  readonly contract: Contract;
  readonly map: GameMap;
  readonly faction: Faction;
  readonly content: ContentLookup;
  readonly templates: ReadonlyMap<string, LoadoutTemplate>;
  readonly deployments: readonly ScenarioDeployment[];
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
): string {
  if (!templateId) return 'rifleman';
  const t = templates.get(templateId);
  if (!t) return 'rifleman';
  return t.role === 'sidearm-only' ? 'rifleman' : t.role;
}

export function buildScenario(input: BuildScenarioInput): SimState {
  const world = buildWorld(input.map);
  const units: Unit[] = [];
  let nextId = 1;

  const tileToMeters = (x: number, y: number): Vec2 => ({
    x: x * input.map.tileSizeMeters,
    y: y * input.map.tileSizeMeters,
  });

  for (let i = 0; i < input.deployments.length && i < input.map.playerSpawns.length; i++) {
    const deploy = input.deployments[i];
    const spawn = input.map.playerSpawns[i];
    const pos = tileToMeters(spawn.x, spawn.y);
    const combat = deriveCombatProfile(deploy.loadout, input.content);

    const role = roleFromTemplate(deploy.templateId, input.templates);
    const waypoints = waypointsFor(input.map, role, 'advance').map((p) =>
      tileToMeters(p.x, p.y),
    );

    units.push(
      makeUnit({
        id: asUnitId(nextId++) as UnitId,
        teamId: 0,
        operatorId: deploy.operatorId,
        position: pos,
        facing: spawn.facing,
        combat,
        stats: deploy.stats,
        waypoints,
      }),
    );
  }

  let enemyIndex = 0;
  for (const archetype of input.contract.enemies.archetypes) {
    const factionMember = input.faction.roster.find((m) => m.archetype === archetype.archetype);
    if (!factionMember) continue;
    const template = input.templates.get(factionMember.loadoutTemplateId);
    if (!template) continue;
    const loadout = loadoutFromTemplate(template, input.content);
    const combat = deriveCombatProfile(loadout, input.content);
    const stats = statsForTier(factionMember.tier);
    const role = template.role === 'sidearm-only' ? 'rifleman' : template.role;

    for (let i = 0; i < archetype.count; i++) {
      if (enemyIndex >= input.map.enemySpawns.length) break;
      const spawn = input.map.enemySpawns[enemyIndex++];
      const pos = tileToMeters(spawn.x, spawn.y);
      const waypoints = waypointsFor(input.map, role, 'advance')
        .slice()
        .reverse()
        .map((p) => tileToMeters(p.x, p.y));

      units.push(
        makeUnit({
          id: asUnitId(nextId++) as UnitId,
          teamId: 1,
          operatorId: null,
          position: pos,
          facing: spawn.facing,
          combat,
          stats,
          waypoints,
        }),
      );
    }
  }

  return makeInitialState(world, input.seed, units);
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
