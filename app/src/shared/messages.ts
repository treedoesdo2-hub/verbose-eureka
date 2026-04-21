export type RendererToWorker =
  | { type: 'ping'; nonce: number }
  | { type: 'startSim'; seed: number; contractId: string }
  | { type: 'stopSim' }
  | { type: 'setSpeed'; speed: number }
  | { type: 'pause' }
  | { type: 'resume' };

export type WorkerToRenderer =
  | { type: 'pong'; nonce: number }
  | { type: 'simStarted'; seed: number }
  | { type: 'simStopped' }
  | { type: 'tick'; tickNumber: number }
  | { type: 'error'; message: string };
