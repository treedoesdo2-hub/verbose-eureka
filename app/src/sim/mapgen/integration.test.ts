import { describe, expect, it } from 'vitest';
import { buildGeneratedMap } from '../scenario';
import type { MapGenRequest } from './types';

function req(size = 128): MapGenRequest {
  return {
    seed: 'integration-seed',
    biome: 'mixed',
    size,
    tileSizeMeters: 1.5,
    generationVersion: 1,
  };
}

describe('generated map → scenario world', () => {
  it('produces a world with the requested dimensions and walkable deploy zones', () => {
    const { map, world, result } = buildGeneratedMap(req(), 'Test Map', 'test-map', {
      team0: 4,
      team1: 6,
    });

    expect(world.width).toBe(128);
    expect(world.height).toBe(128);
    expect(world.base).toBe(result.base);
    expect(map.playerSpawns.length).toBe(4);
    expect(map.enemySpawns.length).toBe(6);
    expect(map.generationSeed).toBe('integration-seed');
    expect(map.biome).toBe('mixed');
  });

  it('places spawn points inside their deploy zones', () => {
    const { map, result } = buildGeneratedMap(req(), 'Test', 'test', {
      team0: 5,
      team1: 5,
    });
    for (const s of map.playerSpawns) {
      expect(s.x).toBeGreaterThanOrEqual(result.deployZones.team0.x);
      expect(s.x).toBeLessThan(result.deployZones.team0.x + result.deployZones.team0.w);
      expect(s.y).toBeGreaterThanOrEqual(result.deployZones.team0.y);
      expect(s.y).toBeLessThan(result.deployZones.team0.y + result.deployZones.team0.h);
    }
    for (const s of map.enemySpawns) {
      expect(s.x).toBeGreaterThanOrEqual(result.deployZones.team1.x);
      expect(s.x).toBeLessThan(result.deployZones.team1.x + result.deployZones.team1.w);
    }
  });

  it('is deterministic: same seed produces identical world buffer', () => {
    const a = buildGeneratedMap(req(), 'A', 'a', { team0: 2, team1: 2 });
    const b = buildGeneratedMap(req(), 'B', 'b', { team0: 2, team1: 2 });
    expect(a.result.hash).toBe(b.result.hash);
    expect(a.world.base.length).toBe(b.world.base.length);
    for (let i = 0; i < a.world.base.length; i++) {
      expect(a.world.base[i]).toBe(b.world.base[i]);
    }
  });
});
