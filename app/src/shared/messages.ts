import type { BodyZone } from '@schema/common';
import type { MatchStats, SimSnapshot, WorldSnapshot } from './snapshot';

export type StartSimPayload = {
  readonly seed: number;
  readonly contractId: string;
  readonly simSpeedMultiplier: number;
  readonly scenarioRequest: ScenarioRequest;
};

export type WireLoadoutItem = {
  readonly type: 'weapon' | 'armor' | 'utility';
  readonly id: string;
  readonly zone: BodyZone;
};

export type WireLoadout = {
  readonly items: readonly WireLoadoutItem[];
  readonly templateId?: string;
};

export type ScenarioRequest = {
  readonly seed: number;
  readonly contractId: string;
  readonly mapId: string;
  readonly deployedOperatorIds: readonly string[];
  readonly perOperatorLoadouts: Record<string, WireLoadout>;
  // ADR 003 squad hierarchy — operatorId → squadId. Missing entries mean
  // the operator deploys loose (no squad). Usually every player operator
  // belongs to exactly one squad.
  readonly operatorSquadIds?: Record<string, string>;
};

export type RendererToWorker =
  | { type: 'ping'; nonce: number }
  | { type: 'startSim'; payload: StartSimPayload }
  | { type: 'stopSim' }
  | { type: 'setSpeed'; multiplier: number }
  | { type: 'pause' }
  | { type: 'resume' };

export type WorkerLogLevel = 'info' | 'warn' | 'error';
export type WorkerLogCategory = 'sim' | 'worker';

export type WorkerToRenderer =
  | { type: 'pong'; nonce: number }
  | { type: 'simStarted'; world: WorldSnapshot }
  | { type: 'simStopped' }
  | {
      type: 'simEnded';
      winner: number | null;
      endReason: string | undefined;
      stats: MatchStats;
    }
  | { type: 'state'; snapshot: SimSnapshot }
  | { type: 'error'; message: string }
  // Out-of-band diagnostic log. The renderer forwards these to the main-
  // process log pipeline so merc-sim.jsonl / merc-worker.jsonl actually
  // have content to read after a play session. Without this the category
  // files sit at 0 bytes and I can't diagnose bad runs post-hoc.
  | {
      type: 'log';
      level: WorkerLogLevel;
      category: WorkerLogCategory;
      msg: string;
      meta?: unknown;
    };
