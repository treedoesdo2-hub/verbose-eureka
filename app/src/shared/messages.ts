import type { BodyZone } from '@schema/common';
import type { MatchStats, SimSnapshot, SnapshotBuildingRecord, WorldSnapshot } from './snapshot';

// P1.7 — full pipeline output in a worker-transferable shape.
//
// Rendered-once-then-simulated maps are generated on the briefing screen
// (so the thumbnail shows the true terrain the player is about to fight
// on), cached in renderer state, and handed to the worker on Deploy.
// Fields mirror MapGenResult minus the transient diagnostics/pipeline
// internals that the worker doesn't need.
export type MapGenResultTransfer = {
  readonly seed: string;
  readonly biome: string;
  readonly size: number;
  readonly tileSizeMeters: number;
  readonly generationVersion: number;
  readonly width: number;
  readonly height: number;
  readonly base: Uint8Array;
  readonly point: Uint8Array;
  readonly edgeN: Uint8Array;
  readonly edgeW: Uint8Array;
  readonly edgeOverrideN: Uint8Array;
  readonly edgeOverrideW: Uint8Array;
  readonly buildingId: Uint16Array;
  readonly walkability: Uint16Array;
  readonly coverProfile: Uint8Array;
  readonly elevationStep: Uint8Array;
  readonly structureHeight: Uint8Array;
  readonly hpN: Uint16Array;
  readonly hpW: Uint16Array;
  readonly hpPoint: Uint16Array;
  readonly buildings: readonly SnapshotBuildingRecord[];
  readonly shadingBake: Uint8ClampedArray;
  readonly contours: Uint8Array;
  // Lightweight metadata — full mapgen diagnostics are renderer-side only.
  readonly deployZones: {
    readonly team0: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
    readonly team1: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  };
  // ADR 014 — per-unit spawn tiles computed at pipeline time. Worker slices
  // these to the actual roster size when populating the stub GameMap.
  readonly unitSlots: {
    readonly team0: readonly { readonly x: number; readonly y: number; readonly facing: number }[];
    readonly team1: readonly { readonly x: number; readonly y: number; readonly facing: number }[];
  };
  readonly objectiveAnchors: readonly {
    readonly kindHint: 'extract' | 'defend' | 'secure';
    readonly rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
    readonly qualityScore: number;
  }[];
};

export type StartSimPayload = {
  readonly seed: number;
  readonly contractId: string;
  readonly simSpeedMultiplier: number;
  readonly scenarioRequest: ScenarioRequest;
};

export type WireLoadoutItem = {
  readonly type: 'weapon' | 'armor' | 'utility' | 'ammo';
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
  // P1.7 — optional cache-and-deliver payload. When present, the worker
  // uses this map buffer instead of re-running runPipeline. The renderer
  // builds it once on the briefing screen so the thumbnail and the
  // battle render the same terrain.
  readonly prebuiltMap?: MapGenResultTransfer;
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
