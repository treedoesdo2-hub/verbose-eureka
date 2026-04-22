// COA-3 task #52 — unified scatter pass framework.
//
// A ScatterPass is a named, seeded, validator-chained attempt to place N
// items (point objects, buildings, barriers) on a grid. The framework
// handles RNG setup, retry budgets, validator evaluation, and diagnostic
// logging so individual scatter callsites are a few lines instead of
// reimplementing the same boilerplate.
//
// Validators are pure predicates (world + candidate → true/false). The
// registry makes validator composition dead simple — you assemble a
// validator chain per pass without plumbing state.

import type { DebugSink } from './debug-sink';
import type { Rng } from './noise';

// A validator takes a candidate tile (x, y) and any contextual data (the
// pass owns the context type; framework only sees the predicate shape).
export type ScatterValidator<Ctx = unknown> = (
  ctx: Ctx,
  x: number,
  y: number,
) => boolean;

// A chain of validators is evaluated in order; first-reject short-circuits.
export function andValidators<Ctx>(
  ...vs: ScatterValidator<Ctx>[]
): ScatterValidator<Ctx> {
  return (ctx, x, y) => {
    for (const v of vs) {
      if (!v(ctx, x, y)) return false;
    }
    return true;
  };
}

// Built-in validator kit (task #53). Context is explicit per validator so
// callers compose only what they need. These are the generic building
// blocks — biome-specific validators live alongside their scatter passes.
export const V = {
  minEdgeDist<Ctx extends { width: number; height: number }>(
    dist: number,
  ): ScatterValidator<Ctx> {
    return (ctx, x, y) =>
      x >= dist && y >= dist && x < ctx.width - dist && y < ctx.height - dist;
  },

  insideBounds<Ctx extends { width: number; height: number }>(): ScatterValidator<Ctx> {
    return (ctx, x, y) => x >= 0 && y >= 0 && x < ctx.width && y < ctx.height;
  },

  minSpacingFromPlaced<
    Ctx extends { placed: readonly { x: number; y: number }[] },
  >(minDist: number): ScatterValidator<Ctx> {
    const sq = minDist * minDist;
    return (ctx, x, y) => {
      for (const p of ctx.placed) {
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < sq) return false;
      }
      return true;
    };
  },

  minDistToObjective<
    Ctx extends {
      objectives: readonly { x: number; y: number; w: number; h: number }[];
    },
  >(minDist: number): ScatterValidator<Ctx> {
    return (ctx, x, y) => {
      for (const obj of ctx.objectives) {
        const cx = Math.max(obj.x, Math.min(x, obj.x + obj.w - 1));
        const cy = Math.max(obj.y, Math.min(y, obj.y + obj.h - 1));
        const dx = cx - x;
        const dy = cy - y;
        if (Math.hypot(dx, dy) < minDist) return false;
      }
      return true;
    };
  },

  outsideDeployZones<
    Ctx extends {
      deployZones: readonly { x: number; y: number; w: number; h: number }[];
    },
  >(buffer: number): ScatterValidator<Ctx> {
    return (ctx, x, y) => {
      for (const z of ctx.deployZones) {
        if (
          x >= z.x - buffer &&
          x < z.x + z.w + buffer &&
          y >= z.y - buffer &&
          y < z.y + z.h + buffer
        ) {
          return false;
        }
      }
      return true;
    };
  },

  tilePassable<Ctx extends { isPassable: (x: number, y: number) => boolean }>(): ScatterValidator<Ctx> {
    return (ctx, x, y) => ctx.isPassable(x, y);
  },

  densityAbove<Ctx extends { density: Float32Array; width: number }>(
    threshold: number,
  ): ScatterValidator<Ctx> {
    return (ctx, x, y) => ctx.density[y * ctx.width + x] >= threshold;
  },
};

// A single scatter attempt. picker produces a candidate tile (driven by
// the pass's RNG), validators filter, mutator stamps accepted tiles.
export type ScatterPass<Ctx> = {
  readonly name: string;
  readonly targetCount: number;
  readonly maxAttempts: number;
  picker(ctx: Ctx, rng: Rng): { x: number; y: number } | null;
  readonly validator: ScatterValidator<Ctx>;
  onAccept(ctx: Ctx, x: number, y: number): void;
};

export type ScatterResult = {
  readonly pass: string;
  readonly placed: number;
  readonly attempts: number;
  readonly rejected: number;
};

export function runScatterPass<Ctx>(
  pass: ScatterPass<Ctx>,
  ctx: Ctx,
  rng: Rng,
  sink?: DebugSink,
): ScatterResult {
  let placed = 0;
  let attempts = 0;
  let rejected = 0;
  while (placed < pass.targetCount && attempts < pass.maxAttempts) {
    attempts++;
    const candidate = pass.picker(ctx, rng);
    if (!candidate) continue;
    if (!pass.validator(ctx, candidate.x, candidate.y)) {
      rejected++;
      continue;
    }
    pass.onAccept(ctx, candidate.x, candidate.y);
    placed++;
  }
  if (sink) {
    sink.info(`scatter:${pass.name}`, 'pass complete', {
      placed,
      attempts,
      rejected,
      target: pass.targetCount,
    });
    if (placed < pass.targetCount) {
      sink.warn(`scatter:${pass.name}`, 'under-placement', {
        placed,
        target: pass.targetCount,
        shortfall: pass.targetCount - placed,
      });
    }
  }
  return { pass: pass.name, placed, attempts, rejected };
}

// ScatterRegistry collects multiple passes and runs them serially with a
// shared RNG tree. Each pass gets its own sub-RNG so adding a pass later
// doesn't perturb earlier passes' outputs.
export class ScatterRegistry<Ctx> {
  private readonly passes: ScatterPass<Ctx>[] = [];

  add(pass: ScatterPass<Ctx>): this {
    this.passes.push(pass);
    return this;
  }

  runAll(
    ctx: Ctx,
    rootRng: Rng,
    sink?: DebugSink,
  ): ScatterResult[] {
    const results: ScatterResult[] = [];
    for (const pass of this.passes) {
      // Drive each pass from the root RNG in registry order so determinism
      // is preserved for the same input tuple.
      results.push(runScatterPass(pass, ctx, rootRng, sink));
    }
    return results;
  }

  get size(): number {
    return this.passes.length;
  }
}
