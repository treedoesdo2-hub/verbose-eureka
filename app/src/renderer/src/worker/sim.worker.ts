import type {
  RendererToWorker,
  ScenarioRequest,
  WorkerLogCategory,
  WorkerLogLevel,
  WorkerToRenderer,
} from '@shared/messages';
import type { ContentLookup, Loadout } from '@sim/loadout';
import { loadoutFromTemplate } from '@sim/loadout';
import { bindObjectivesToAnchors, mapGenRequestFromContract } from '@sim/mapgen/contract-binder';
import { MatchStatsAccumulator } from '@sim/match-stats';
import { RecordingSim } from '@sim/replay';
import type { ScenarioDeployment } from '@sim/scenario';
import { buildGeneratedMap, buildScenario } from '@sim/scenario';
import { makeWorldFromBuffers } from '@sim/world';
import type { GameMap } from '@schema/map';
import { snapshotState, snapshotWorld } from '@sim/snapshot';
import type { SimState } from '@sim/state';
import type { UnitStats } from '@sim/unit';
import { loadWorkerContent, type WorkerContentBundle } from './content-loader';

const bundle = loadWorkerContent();

function post(msg: WorkerToRenderer): void {
  (self as unknown as Worker).postMessage(msg);
}

// Diagnostic log helper. Category 'sim' is for gameplay events the agent
// actually wants to grep after a bad run (scenario start, heartbeats, end);
// 'worker' is for worker-lifecycle warnings (missing content, bad requests).
function logEvt(
  level: WorkerLogLevel,
  category: WorkerLogCategory,
  msg: string,
  meta?: unknown,
): void {
  post({ type: 'log', level, category, msg, meta });
}

let sim: RecordingSim | null = null;
let stats: MatchStatsAccumulator | null = null;
let speedMultiplier = 4;
let paused = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let ticksSinceLastHeartbeat = 0;
const BASE_HZ = 30;
// Emit a heartbeat every N sim ticks so a long match leaves a breadcrumb
// trail in merc-sim.jsonl. 300 ticks = 10 seconds of sim time at SIM_HZ=30.
const HEARTBEAT_TICKS = 300;

function buildLookup(content: WorkerContentBundle): ContentLookup {
  return {
    weapon: (id) => content.weapons.get(id),
    armor: (id) => content.armor.get(id),
    utility: (id) => content.utility.get(id),
  };
}

function statsForOperator(opId: string): UnitStats {
  const op = bundle.operators.get(opId);
  if (!op) return { aim: 50, move: 50, grit: 50, awareness: 50, medical: 30 };
  return op.stats;
}

function buildDeployments(req: ScenarioRequest): ScenarioDeployment[] {
  const lookup = buildLookup(bundle);
  const squadIds = req.operatorSquadIds ?? {};
  const out: ScenarioDeployment[] = [];
  for (const opId of req.deployedOperatorIds) {
    const op = bundle.operators.get(opId);
    if (!op) continue;
    const wire = req.perOperatorLoadouts[opId];
    const squadId = squadIds[opId] ?? null;
    if (!wire) {
      const tpl = bundle.templates.get(op.defaultTemplateId);
      if (!tpl) continue;
      out.push({
        operatorId: opId,
        stats: statsForOperator(opId),
        loadout: loadoutFromTemplate(tpl, lookup),
        templateId: op.defaultTemplateId,
        squadId,
      });
    } else {
      const l: Loadout = { items: [...wire.items] };
      out.push({
        operatorId: opId,
        stats: statsForOperator(opId),
        loadout: l,
        templateId: wire.templateId,
        squadId,
      });
    }
  }
  return out;
}

function sliceSlotsForWorker(
  slots: readonly { readonly x: number; readonly y: number; readonly facing: number }[],
  count: number,
  zoneFallback: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
): { x: number; y: number; facing: number }[] {
  const out: { x: number; y: number; facing: number }[] = slots
    .slice(0, count)
    .map((s) => ({ x: s.x, y: s.y, facing: s.facing }));
  if (out.length >= count) return out;
  const missing = count - out.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(missing)));
  const rows = Math.max(1, Math.ceil(missing / cols));
  const dx = zoneFallback.w / (cols + 1);
  const dy = zoneFallback.h / (rows + 1);
  for (let r = 0; r < rows && out.length < count; r++) {
    for (let c = 0; c < cols && out.length < count; c++) {
      out.push({
        x: Math.floor(zoneFallback.x + dx * (c + 1)),
        y: Math.floor(zoneFallback.y + dy * (r + 1)),
        facing: 0,
      });
    }
  }
  return out;
}

function startSim(seed: number, req: ScenarioRequest): SimState | null {
  const contract = bundle.contracts.get(req.contractId);
  const faction = contract && bundle.factions.get(contract.enemies.factionId);
  if (!contract || !faction) {
    logEvt('error', 'worker', 'scenario: missing contract/faction', {
      contractId: req.contractId,
      hasFaction: Boolean(faction),
    });
    post({ type: 'error', message: 'scenario: missing contract/faction' });
    return null;
  }

  // Pillar A: contracts with a biomeHint generate a procedural map from the
  // contract seed. Contracts without the hint keep using the authored map
  // from the content pack. Generator anchors bind to contract objectives so
  // "extract" without an authored zone resolves to a generator-picked rect.
  let map: Parameters<typeof buildScenario>[0]['map'];
  let prebuiltWorld: Parameters<typeof buildScenario>[0]['prebuiltWorld'] = undefined;
  let prebuiltMapMeta: Parameters<typeof buildScenario>[0]['prebuiltMapMeta'] = undefined;
  let objectiveZoneOverrides:
    | ReadonlyMap<string, { x: number; y: number; w: number; h: number }>
    | undefined;
  if (contract.modifiers.biomeHint !== null) {
    if (req.prebuiltMap) {
      // P1.10 — briefing already ran the pipeline and cached the result.
      // Rehydrate directly into a World + stub GameMap instead of re-
      // running mapgen; otherwise the thumbnail and the battle map
      // diverge.
      const pm = req.prebuiltMap;
      prebuiltWorld = makeWorldFromBuffers({
        width: pm.width,
        height: pm.height,
        tileSizeMeters: pm.tileSizeMeters,
        base: pm.base,
        point: pm.point,
        edgeN: pm.edgeN,
        edgeW: pm.edgeW,
        edgeOverrideN: pm.edgeOverrideN,
        edgeOverrideW: pm.edgeOverrideW,
        buildingId: pm.buildingId,
        walkability: pm.walkability,
        coverProfile: pm.coverProfile,
        elevationStep: pm.elevationStep,
        structureHeight: pm.structureHeight,
        hpN: pm.hpN,
        hpW: pm.hpW,
        hpPoint: pm.hpPoint,
        buildings: pm.buildings.map((b) => ({
          id: b.id,
          family: b.family,
          floors: b.floors,
          footprintTiles: b.footprintTiles.map((t) => ({ x: t.x, y: t.y })),
          wallHpInitial: b.wallHpInitial,
        })),
        shadingBake: pm.shadingBake,
        contours: pm.contours,
      });
      prebuiltMapMeta = {
        dominantLine: null,
        heroLandmark: null,
      };
      // ADR 014 — unitSlots carry concrete per-unit spawn tiles produced
      // at pipeline time (team 0 marching-order, team 1 objective ring).
      // Slice to the actual roster size; fall back to grid-sampling the
      // deploy-zone rect for the remainder only if the planner ran short.
      const deployCount = req.deployedOperatorIds.length;
      const enemyCount = contract.enemies.archetypes.reduce((sum, a) => sum + a.count, 0);
      const team0Spawns = sliceSlotsForWorker(pm.unitSlots.team0, deployCount, pm.deployZones.team0);
      const team1Spawns = sliceSlotsForWorker(pm.unitSlots.team1, enemyCount, pm.deployZones.team1);
      const stubMap: GameMap = {
        schemaVersion: 2,
        id: `gen:${pm.seed}`,
        name: contract.name,
        width: pm.width,
        height: pm.height,
        tileSizeMeters: pm.tileSizeMeters,
        tiles: [],
        buildings: [],
        playerSpawns: team0Spawns,
        enemySpawns: team1Spawns,
        waypointRoutes: [],
        generationSeed: pm.seed,
        generationVersion: pm.generationVersion,
        biome: pm.biome as GameMap['biome'],
      };
      map = stubMap;
      objectiveZoneOverrides = bindObjectivesToAnchors(
        contract,
        pm.objectiveAnchors.map((a) => ({
          kindHint: a.kindHint,
          rect: { ...a.rect },
          qualityScore: a.qualityScore,
        })),
      );
    } else {
      const deployments = buildDeployments(req);
      // Mix the playthrough seed into the map seed so every Deploy
      // produces a fresh map for the same contract. Without this the
      // seed was `contract.id`, making every run of yard-assault play on
      // the identical map.
      const genReq = mapGenRequestFromContract(contract, 1.5, 1, seed);
      const enemyCount = contract.enemies.archetypes.reduce((sum, a) => sum + a.count, 0);
      const gen = buildGeneratedMap(genReq, contract.name, `gen:${genReq.seed}`, {
        team0: Math.max(1, deployments.length),
        team1: Math.max(1, enemyCount),
      });
      map = gen.map;
      prebuiltWorld = gen.world;
      prebuiltMapMeta = {
        dominantLine: gen.result.dominantLine,
        heroLandmark: gen.result.heroLandmark,
      };
      objectiveZoneOverrides = bindObjectivesToAnchors(contract, gen.result.objectiveAnchors);
    }
  } else {
    const authored = bundle.maps.get(req.mapId);
    if (!authored) {
      logEvt('error', 'worker', 'scenario: missing authored map', { mapId: req.mapId });
      post({ type: 'error', message: 'scenario: missing authored map' });
      return null;
    }
    map = authored;
  }

  const state = buildScenario({
    seed,
    contract,
    map,
    faction,
    content: buildLookup(bundle),
    templates: bundle.templates,
    deployments: buildDeployments(req),
    objectiveZoneOverrides,
    prebuiltWorld,
    prebuiltMapMeta,
  });

  // Scenario-start breadcrumb: team sizes, squad counts, objective summary,
  // generated-vs-authored map. This is the single most useful line when
  // diagnosing "why did nothing happen this run" complaints.
  let team0 = 0;
  let team1 = 0;
  const roleCounts: Record<string, number> = {};
  for (const u of state.units.values()) {
    if (u.teamId === 0) team0++;
    else if (u.teamId === 1) team1++;
    roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1;
  }
  let playerSquads = 0;
  let enemySquads = 0;
  for (const sq of state.squads.values()) {
    if (sq.teamId === 0) playerSquads++;
    else if (sq.teamId === 1) enemySquads++;
  }
  logEvt('info', 'sim', 'scenario started', {
    contractId: contract.id,
    contractName: contract.name,
    seed,
    map: {
      generated: contract.modifiers.biomeHint !== null,
      width: state.world.width,
      height: state.world.height,
      tileSizeMeters: state.world.tileSizeMeters,
    },
    team0,
    team1,
    roleCounts,
    playerSquads,
    enemySquads,
    objectives: state.objectives.map((o) => ({ id: o.id, kind: o.kind, status: o.status })),
  });
  return state;
}

function stopLoop(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

function startLoop(): void {
  stopLoop();
  intervalHandle = setInterval(
    () => {
      if (paused || !sim) return;
      const steps = Math.max(1, Math.round(speedMultiplier));
      for (let i = 0; i < steps; i++) {
        sim.step();
        // Fold this tick's events into the running match stats accumulator.
        if (stats) stats.ingest(sim.current().events);
        ticksSinceLastHeartbeat++;
        if (sim.current().ended) break;
      }
      post({ type: 'state', snapshot: snapshotState(sim.current()) });
      if (ticksSinceLastHeartbeat >= HEARTBEAT_TICKS && !sim.current().ended) {
        ticksSinceLastHeartbeat = 0;
        emitHeartbeat(sim.current());
      }
      if (sim.current().ended) {
        const final = sim.current();
        const endReason = final.endReason;
        const winner =
          endReason === 'primary-complete' || endReason === 'team-1-defeated'
            ? 0
            : endReason === 'primary-failed' || endReason === 'team-0-defeated'
              ? 1
              : null;
        const finalStats = stats
          ? stats.finalize(final.tick)
          : { totalTicks: final.tick, perUnit: [], highlights: [] };
        logEvt('info', 'sim', 'scenario ended', {
          tick: final.tick,
          durationSec: final.tick / BASE_HZ,
          winner,
          endReason,
          aliveTeam0: countAlive(final, 0),
          aliveTeam1: countAlive(final, 1),
          objectives: final.objectives.map((o) => ({ id: o.id, status: o.status })),
        });
        post({ type: 'simEnded', winner, endReason, stats: finalStats });
        stopLoop();
        sim = null;
        stats = null;
      }
    },
    Math.floor(1000 / BASE_HZ),
  );
}

function countAlive(state: SimState, teamId: number): number {
  let n = 0;
  for (const u of state.units.values()) {
    if (u.teamId !== teamId) continue;
    if (u.action.kind === 'dead' || u.action.kind === 'downed') continue;
    n++;
  }
  return n;
}

// Tick-time heartbeat. Captures the distribution of AI states plus alive
// counts per team. If a run goes quiet ("boys just stand there") the
// aiState histogram shows everyone stuck in 'hold' or 'idle', which is
// the fastest way to confirm the regression.
function emitHeartbeat(state: SimState): void {
  const aiStates: Record<string, number> = {};
  const actions: Record<string, number> = {};
  let team0Alive = 0;
  let team1Alive = 0;
  for (const u of state.units.values()) {
    if (u.action.kind === 'dead' || u.action.kind === 'downed') continue;
    if (u.teamId === 0) team0Alive++;
    else if (u.teamId === 1) team1Alive++;
    aiStates[u.aiState] = (aiStates[u.aiState] ?? 0) + 1;
    actions[u.action.kind] = (actions[u.action.kind] ?? 0) + 1;
  }
  logEvt('info', 'sim', 'heartbeat', {
    tick: state.tick,
    simTimeSec: state.tick / BASE_HZ,
    team0Alive,
    team1Alive,
    aiStates,
    actions,
    objectives: state.objectives.map((o) => ({ id: o.id, status: o.status })),
  });
}

self.onmessage = (e: MessageEvent<RendererToWorker>): void => {
  const msg = e.data;
  switch (msg.type) {
    case 'ping':
      post({ type: 'pong', nonce: msg.nonce });
      break;
    case 'startSim': {
      const state = startSim(msg.payload.seed, msg.payload.scenarioRequest);
      if (!state) return;
      sim = new RecordingSim(state, msg.payload.seed);
      stats = new MatchStatsAccumulator();
      stats.seed(state.units);
      speedMultiplier = msg.payload.simSpeedMultiplier;
      paused = false;
      ticksSinceLastHeartbeat = 0;
      post({ type: 'simStarted', world: snapshotWorld(state.world) });
      post({ type: 'state', snapshot: snapshotState(state) });
      startLoop();
      break;
    }
    case 'stopSim':
      logEvt('info', 'sim', 'sim stopped by renderer', {
        tick: sim?.current().tick ?? 0,
      });
      stopLoop();
      sim = null;
      stats = null;
      post({ type: 'simStopped' });
      break;
    case 'setSpeed':
      speedMultiplier = msg.multiplier;
      break;
    case 'pause':
      paused = true;
      break;
    case 'resume':
      paused = false;
      break;
    default: {
      const _exhaustive: never = msg;
      logEvt('error', 'worker', 'unknown renderer message', { msg: _exhaustive });
      post({ type: 'error', message: `unknown: ${JSON.stringify(_exhaustive)}` });
    }
  }
};
