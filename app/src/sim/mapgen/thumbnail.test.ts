import { describe, expect, it } from 'vitest';
import { runPipeline } from './pipeline';
import { generateThumbnail } from './thumbnail';
import type { MapGenRequest } from './types';

function req(size = 128): MapGenRequest {
  return {
    seed: 'thumb-seed',
    biome: 'mixed',
    size,
    tileSizeMeters: 1.5,
    generationVersion: 1,
  };
}

describe('thumbnail', () => {
  it('produces a 128x128 RGBA buffer from a 256-tile map', () => {
    const r = runPipeline(req(256));
    const t = generateThumbnail(r, 128);
    expect(t.width).toBe(128);
    expect(t.height).toBe(128);
    expect(t.pixels.length).toBe(128 * 128 * 4);
    // Alpha channel is fully opaque.
    for (let i = 3; i < t.pixels.length; i += 4) {
      expect(t.pixels[i]).toBe(255);
    }
  });

  it('clamps size when source map is smaller than target', () => {
    const r = runPipeline(req(64));
    const t = generateThumbnail(r, 128);
    expect(t.width).toBe(64);
    expect(t.height).toBe(64);
  });

  it('tints the deploy zones with team colors', () => {
    const r = runPipeline(req(128));
    const t = generateThumbnail(r, 64);
    const team0 = r.deployZones.team0;
    const scaleX = r.width / 64;
    const scaleY = r.height / 64;
    const tx = Math.floor((team0.x + team0.w / 2) / scaleX);
    const ty = Math.floor((team0.y + team0.h / 2) / scaleY);
    const o = (ty * 64 + tx) * 4;
    // Team 0 tint is blue-heavy (85, 170, 255) — expect blue > red at the
    // tinted pixel center.
    expect(t.pixels[o + 2]).toBeGreaterThan(t.pixels[o + 0]);
  });
});
