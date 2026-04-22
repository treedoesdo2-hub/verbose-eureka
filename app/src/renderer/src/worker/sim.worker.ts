import type { RendererToWorker, ScenarioRequest, WorkerToRenderer } from '@shared/messages';
import type { ContentLookup, Loadout } from '@sim/loadout';
import { loadoutFromTemplate } from '@sim/loadout';
import { bindObjectivesToAnchors, mapGenRequestFromContract } from '@sim/mapgen/contract-binder';
import { MatchStatsAccumulator } from '@sim/match-stats';
import { RecordingSim } from '@sim/replay';
import type { ScenarioDeployment } from '@sim/scenario';
import { buildGeneratedMap, buildScenario } from '@sim/scenario';
import { snapshotState, snapshotWorld } from '@sim/snapshot';
import type { SimState } from '@sim/state';
import type { UnitStats } from '@sim/unit';
import { loadWorkerContent, type WorkerContentBundle } from './content-loader';

const bundle = loadWorkerContent();

function post(msg: WorkerToRenderer): void {
  (self as unknown as Worker).postMessage(msg);
}

let sim: RecordingSim | null = null;
let stats: MatchStatsAccumulator | null = null;
let speedMultiplier = 4;
let paused = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
const BASE_HZ = 30;

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
  const out: ScenarioDeployment[] = [];
  for (const opId of req.deployedOperatorIds) {
    const op = bundle.operators.get(opId);
    if (!op) continue;
    const wire = req.perOperatorLoadouts[opId];
    if (!wire) {
      const tpl = bundle.templates.get(op.defaultTemplateId);
      if (!tpl) continue;
      out.push({
        operatorId: opId,
        stats: statsForOperator(opId),
        loadout: loadoutFromTemplate(tpl, lookup),
        templateId: op.defaultTemplateId,
      });
    } else {
      const l: Loadout = { items: [...wire.items] };
      out.push({
        operatorId: opId,
        stats: statsForOperator(opId),
        loadout: l,
        templateId: wire.templateId,
      });
    }
  }
  return out;
}

function startSim(seed: number, req: ScenarioRequest): SimState | null {
  const contract = bundle.contracts.get(req.contractId);
  const faction = contract && bundle.factions.get(contract.enemies.factionId);
  if (!contract || !faction) {
    post({ type: 'error', message: 'scenario: missing contract/faction' });
    return null;
  }

  // Pillar A: contracts with a biomeHint generate a procedural map from the
  // contract seed. Contracts without the hint keep using the authored map
  // from the content pack. Generator anchors bind to contract objectives so
  // "extract" without an authored zone resolves to a generator-picked rect.
  let map: Parameters<typeof buildScenario>[0]['map'];
  let objectiveZoneOverrides:
    | ReadonlyMap<string, { x: number; y: number; w: number; h: number }>
    | undefined;
  if (contract.modifiers.biomeHint !== null) {
    const deployments = buildDeployments(req);
    const genReq = mapGenRequestFromContract(contract, 1.5, 1);
    const enemyCount = contract.enemies.archetypes.reduce((sum, a) => sum + a.count, 0);
    const gen = buildGeneratedMap(genReq, contract.name, `gen:${contract.id}`, {
      team0: Math.max(1, deployments.length),
      team1: Math.max(1, enemyCount),
    });
    map = gen.map;
    objectiveZoneOverrides = bindObjectivesToAnchors(contract, gen.result.objectiveAnchors);
  } else {
    const authored = bundle.maps.get(req.mapId);
    if (!authored) {
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
        if (sim.current().ended) break;
      }
      post({ type: 'state', snapshot: snapshotState(sim.current()) });
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
        post({ type: 'simEnded', winner, endReason, stats: finalStats });
        stopLoop();
        sim = null;
        stats = null;
      }
    },
    Math.floor(1000 / BASE_HZ),
  );
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
      post({ type: 'simStarted', world: snapshotWorld(state.world) });
      post({ type: 'state', snapshot: snapshotState(state) });
      startLoop();
      break;
    }
    case 'stopSim':
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
      post({ type: 'error', message: `unknown: ${JSON.stringify(_exhaustive)}` });
    }
  }
};
