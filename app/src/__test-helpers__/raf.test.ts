import { afterEach, describe, expect, it } from 'vitest';
import { stubRaf } from './raf';

describe('stubRaf', () => {
  let raf: ReturnType<typeof stubRaf> | null = null;

  afterEach(() => {
    raf?.restore();
    raf = null;
  });

  it('invokes queued callbacks on tick, not before', () => {
    raf = stubRaf();
    let called = 0;
    requestAnimationFrame(() => {
      called += 1;
    });
    expect(called).toBe(0);
    raf.tick();
    expect(called).toBe(1);
  });

  it('passes advancing timestamps to callbacks', () => {
    raf = stubRaf({ startTime: 100 });
    const stamps: number[] = [];
    const loop = (t: number): void => {
      stamps.push(t);
      if (stamps.length < 3) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    raf.tick(3);
    expect(stamps).toHaveLength(3);
    // Each tick advances ~16.67ms; timestamps should be strictly increasing.
    expect(stamps[1]).toBeGreaterThan(stamps[0]);
    expect(stamps[2]).toBeGreaterThan(stamps[1]);
  });

  it('cancelAnimationFrame removes pending callbacks', () => {
    raf = stubRaf();
    let called = false;
    const id = requestAnimationFrame(() => {
      called = true;
    });
    cancelAnimationFrame(id);
    raf.tick();
    expect(called).toBe(false);
  });

  it('callbacks scheduled during a tick fire on the NEXT tick (browser semantics)', () => {
    raf = stubRaf();
    const order: string[] = [];
    requestAnimationFrame(() => {
      order.push('a');
      requestAnimationFrame(() => order.push('b'));
    });
    raf.tick();
    expect(order).toEqual(['a']);
    raf.tick();
    expect(order).toEqual(['a', 'b']);
  });

  it('flush drains a bounded loop', () => {
    raf = stubRaf();
    let n = 0;
    const loop = (): void => {
      n += 1;
      if (n < 5) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    raf.flush();
    expect(n).toBe(5);
    expect(raf.pending()).toBe(0);
  });

  it('flush bails out of runaway RAF loops', () => {
    raf = stubRaf();
    const loop = (): void => {
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    expect(() => raf?.flush()).toThrow(/runaway/);
  });

  it('restore reinstates the originals', () => {
    const originalRaf = globalThis.requestAnimationFrame;
    raf = stubRaf();
    expect(globalThis.requestAnimationFrame).not.toBe(originalRaf);
    raf.restore();
    expect(globalThis.requestAnimationFrame).toBe(originalRaf);
    raf = null;
  });
});
