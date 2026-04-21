/**
 * Deterministic requestAnimationFrame / cancelAnimationFrame stub for
 * tests that exercise Pixi render loops, animation tweens, or any
 * RAF-driven timers. Replaces the globals with a queue the test drives
 * directly — no real frames fire, no microtask fuzz.
 *
 * Typical use:
 *   const raf = stubRaf();
 *   try {
 *     mountComponent();
 *     raf.tick(3);        // advance 3 frames
 *     expect(...).toBe(...);
 *   } finally {
 *     raf.restore();
 *   }
 */
type FrameCallback = (time: number) => void;

export type RafController = {
  tick: (frames?: number, deltaMs?: number) => void;
  flush: () => void;
  pending: () => number;
  currentTime: () => number;
  restore: () => void;
};

const DEFAULT_DELTA_MS = 1000 / 60;

export function stubRaf(options: { startTime?: number } = {}): RafController {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCaf = globalThis.cancelAnimationFrame;

  let nextId = 1;
  let time = options.startTime ?? 0;
  const queue = new Map<number, FrameCallback>();

  globalThis.requestAnimationFrame = (cb: FrameCallback): number => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    queue.delete(id);
  };

  function runOne(deltaMs: number): void {
    time += deltaMs;
    // Snapshot first: a callback may schedule another RAF which must NOT
    // fire until the next tick, matching browser behavior.
    const snapshot = [...queue.entries()];
    queue.clear();
    for (const [, cb] of snapshot) cb(time);
  }

  return {
    tick(frames = 1, deltaMs = DEFAULT_DELTA_MS): void {
      for (let i = 0; i < frames; i++) runOne(deltaMs);
    },
    flush(): void {
      // Drain until the queue stops scheduling new work. Caps at 1000
      // iterations to surface runaway reschedulers rather than hang.
      let guard = 0;
      while (queue.size > 0) {
        if (guard++ > 1000) throw new Error('stubRaf.flush: runaway RAF loop (>1000 frames)');
        runOne(DEFAULT_DELTA_MS);
      }
    },
    pending(): number {
      return queue.size;
    },
    currentTime(): number {
      return time;
    },
    restore(): void {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCaf;
      queue.clear();
    },
  };
}
