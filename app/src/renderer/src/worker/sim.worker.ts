import type { RendererToWorker, WorkerToRenderer } from '@shared/messages';

function post(msg: WorkerToRenderer): void {
  (self as unknown as Worker).postMessage(msg);
}

self.onmessage = (e: MessageEvent<RendererToWorker>): void => {
  const msg = e.data;
  switch (msg.type) {
    case 'ping':
      post({ type: 'pong', nonce: msg.nonce });
      break;
    case 'startSim':
      post({ type: 'simStarted', seed: msg.seed });
      break;
    case 'stopSim':
      post({ type: 'simStopped' });
      break;
    case 'setSpeed':
    case 'pause':
    case 'resume':
      break;
    default: {
      const _exhaustive: never = msg;
      post({ type: 'error', message: `unknown message: ${JSON.stringify(_exhaustive)}` });
    }
  }
};
