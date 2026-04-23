// COA-3 #61 — scatter pass + validator chaining.

import { describe, expect, it } from 'vitest';
import { makeDebugSink } from './debug-sink';
import { makeRng } from './noise';
import {
  andValidators,
  ScatterRegistry,
  runScatterPass,
  V,
} from './scatter-framework';

describe('scatter-framework — runScatterPass + validators', () => {
  it('runs a pass until target count is reached', () => {
    type Ctx = { width: number; height: number; placed: { x: number; y: number }[] };
    const ctx: Ctx = { width: 16, height: 16, placed: [] };
    const pass = {
      name: 'test-pass',
      targetCount: 5,
      maxAttempts: 100,
      picker: (_c: Ctx, rng: () => number) => ({
        x: Math.floor(rng() * 16),
        y: Math.floor(rng() * 16),
      }),
      validator: V.insideBounds<Ctx>(),
      onAccept: (c: Ctx, x: number, y: number) => {
        c.placed.push({ x, y });
      },
    };
    const rng = makeRng(42);
    const result = runScatterPass(pass, ctx, rng);
    expect(result.placed).toBe(5);
    expect(ctx.placed.length).toBe(5);
  });

  it('andValidators short-circuits on first rejection', () => {
    const v1 = V.insideBounds<{ width: number; height: number }>();
    const v2: (ctx: { width: number; height: number }, x: number, y: number) => boolean =
      (_ctx, x) => x % 2 === 0;
    const chained = andValidators(v1, v2);
    expect(chained({ width: 10, height: 10 }, 4, 5)).toBe(true);
    expect(chained({ width: 10, height: 10 }, 3, 5)).toBe(false);
    expect(chained({ width: 10, height: 10 }, -1, 5)).toBe(false);
  });

  it('minSpacingFromPlaced rejects overlapping candidates', () => {
    type Ctx = { width: number; height: number; placed: { x: number; y: number }[] };
    const ctx: Ctx = { width: 20, height: 20, placed: [{ x: 10, y: 10 }] };
    const v = V.minSpacingFromPlaced<Ctx>(3);
    expect(v(ctx, 10, 10)).toBe(false);
    expect(v(ctx, 11, 10)).toBe(false);
    expect(v(ctx, 15, 10)).toBe(true);
  });

  it('ScatterRegistry runs passes in order and returns per-pass results', () => {
    type Ctx = { width: number; height: number; placed: { x: number; y: number }[] };
    const ctx: Ctx = { width: 16, height: 16, placed: [] };
    const reg = new ScatterRegistry<Ctx>();
    for (let i = 0; i < 3; i++) {
      reg.add({
        name: `p${i}`,
        targetCount: 2,
        maxAttempts: 50,
        picker: (_c: Ctx, rng: () => number) => ({
          x: Math.floor(rng() * 16),
          y: Math.floor(rng() * 16),
        }),
        validator: V.insideBounds<Ctx>(),
        onAccept: (c: Ctx, x: number, y: number) => {
          c.placed.push({ x, y });
        },
      });
    }
    const rng = makeRng(7);
    const results = reg.runAll(ctx, rng);
    expect(results.length).toBe(3);
    expect(ctx.placed.length).toBe(6);
  });

  it('sink captures under-placement warnings', () => {
    type Ctx = { width: number; height: number };
    const ctx: Ctx = { width: 4, height: 4 };
    const sink = makeDebugSink();
    const result = runScatterPass(
      {
        name: 'hopeless',
        targetCount: 10,
        maxAttempts: 5,
        picker: () => null,
        validator: () => true,
        onAccept: () => {},
      },
      ctx,
      makeRng(1),
      sink,
    );
    expect(result.placed).toBe(0);
    expect(sink.warnings).toBeGreaterThan(0);
  });
});
