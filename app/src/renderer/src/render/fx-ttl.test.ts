import { describe, expect, it } from 'vitest';
import { ALL_FX_KINDS, TTL_MS } from './fx-ttl';

describe('fx TTL table', () => {
  it('has a positive integer TTL for every FxKind', () => {
    for (const kind of ALL_FX_KINDS) {
      const ttl = TTL_MS[kind];
      expect(ttl).toBeGreaterThan(0);
      expect(Number.isFinite(ttl)).toBe(true);
    }
  });

  it('orders muzzle layers from shortest to longest', () => {
    expect(TTL_MS['muzzle-core']).toBeLessThan(TTL_MS['muzzle-bloom']);
    expect(TTL_MS['muzzle-bloom']).toBeLessThan(TTL_MS['muzzle-smoke']);
  });

  it('lingers wound pool longer than the spray', () => {
    expect(TTL_MS['wound-pool']).toBeGreaterThan(TTL_MS['wound-spray']);
  });

  it('lingers wound spray longer than the tracer', () => {
    expect(TTL_MS['wound-spray']).toBeGreaterThan(TTL_MS.tracer);
  });
});
