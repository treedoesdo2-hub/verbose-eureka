import type { RendererToWorker, WorkerToRenderer } from '@shared/messages';
import SimWorker from '../worker/sim.worker?worker';

export type SimEventListener = (msg: WorkerToRenderer) => void;

export class SimBridge {
  private readonly worker: Worker;
  private readonly listeners = new Set<SimEventListener>();

  constructor() {
    this.worker = new SimWorker();
    this.worker.onmessage = (e: MessageEvent<WorkerToRenderer>): void => {
      for (const l of this.listeners) l(e.data);
    };
  }

  send(msg: RendererToWorker): void {
    this.worker.postMessage(msg);
  }

  subscribe(l: SimEventListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  ping(nonce: number): Promise<number> {
    return new Promise((resolve) => {
      const unsub = this.subscribe((msg) => {
        if (msg.type === 'pong' && msg.nonce === nonce) {
          unsub();
          resolve(msg.nonce);
        }
      });
      this.send({ type: 'ping', nonce });
    });
  }

  dispose(): void {
    this.listeners.clear();
    this.worker.terminate();
  }
}

let instance: SimBridge | null = null;

export function getSimBridge(): SimBridge {
  if (!instance) instance = new SimBridge();
  return instance;
}
