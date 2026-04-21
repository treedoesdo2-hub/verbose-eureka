import type { SimSnapshot, WorldSnapshot } from '@shared/snapshot';
import { useEffect, useState } from 'react';
import { getSimBridge } from '../sim-bridge';

export type SimEndedEvent = {
  winner: number | null;
  endReason: string | undefined;
};

export function useSimSnapshot(): {
  snapshot: SimSnapshot | null;
  world: WorldSnapshot | null;
  ended: SimEndedEvent | null;
} {
  const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null);
  const [world, setWorld] = useState<WorldSnapshot | null>(null);
  const [ended, setEnded] = useState<SimEndedEvent | null>(null);

  useEffect(() => {
    const bridge = getSimBridge();
    return bridge.subscribe((msg) => {
      if (msg.type === 'state') setSnapshot(msg.snapshot);
      else if (msg.type === 'simStarted') {
        setWorld(msg.world);
        setEnded(null);
      } else if (msg.type === 'simEnded') {
        setEnded({ winner: msg.winner, endReason: msg.endReason });
      } else if (msg.type === 'simStopped') {
        setSnapshot(null);
        setWorld(null);
        setEnded(null);
      }
    });
  }, []);

  return { snapshot, world, ended };
}
