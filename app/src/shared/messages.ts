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
};

export type RendererToWorker =
  | { type: 'ping'; nonce: number }
  | { type: 'startSim'; payload: StartSimPayload }
  | { type: 'stopSim' }
  | { type: 'setSpeed'; multiplier: number }
  | { type: 'pause' }
  | { type: 'resume' };

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
  | { type: 'error'; message: string };
