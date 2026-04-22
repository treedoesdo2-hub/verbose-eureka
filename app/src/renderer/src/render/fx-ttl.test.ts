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

  it('explosion shock outlasts explosion core', () => {
    expect(TTL_MS['explosion-shock']).toBeGreaterThan(TTL_MS['explosion-core']);
  });

  it('smoke puff lingers longer than muzzle smoke', () => {
    expect(TTL_MS['smoke-puff']).toBeGreaterThan(TTL_MS['muzzle-smoke']);
  });

  it('shell casing decal outlasts the tumbling casing', () => {
    expect(TTL_MS['shell-casing-decal']).toBeGreaterThan(TTL_MS['shell-casing']);
  });

  it('shell casing resolves faster than smoke puff', () => {
    expect(TTL_MS['shell-casing']).toBeLessThan(TTL_MS['smoke-puff']);
  });
});
