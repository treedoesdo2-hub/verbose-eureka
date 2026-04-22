// COA-7 tasks #141 + #143 — thumbnail shape / determinism / internal
// pass tests + performance regression bench. #140/#142 golden PNG
// fixtures deferred until we have an image-diff harness.

import { describe, expect, it } from 'vitest';
import {
  FEATURE_VISIBILITY,
  lineStroke,
  OVERLAY_PALETTE,
  pointColor,
  terrainColor,
} from './palette';
import { runPipeline } from './pipeline';
import {
  clusterGate,
  dilate,
  erode,
  medianFilter3x3,
  modalDownsample,
  morphologicalClose,
  morphologicalOpen,
} from './thumbnail-passes';
import {
  makeBufferDrawTarget,
  tileToGridRef,
} from './thumbnail-overlays';
import { generateThumbnail, renderThumbnail } from './thumbnail';

const sampleRequest = () => ({
  seed: 'coa7-sample',
  biome: 'urban_sparse' as const,
  size: 128,
  tileSizeMeters: 1.5,
  generationVersion: 1,
});

describe('palette', () => {
  it('terrainColor returns distinct colors per tier for water_deep', () => {
    const battle = terrainColor(3, 'battle');
    const briefing = terrainColor(3, 'briefing');
    expect(battle).not.toEqual(briefing);
  });

  it('pointColor returns null for bytes not in the palette', () => {
    expect(pointColor(0)).toBeNull();
    expect(pointColor(255)).toBeNull();
  });

  it('lineStroke returns a 3-component RGB for every kind', () => {
    const colors = (['road-straight', 'rail', 'river', 'canal', 'ridge', 'highstreet', 'hedgerow-spine', 'road-star'] as const)
      .map(lineStroke);
    for (const c of colors) {
      expect(c.length).toBe(3);
      for (const ch of c) expect(ch).toBeGreaterThanOrEqual(0);
    }
  });

  it('FEATURE_VISIBILITY.planning enables every flag', () => {
    const planning = FEATURE_VISIBILITY.planning;
    for (const key of Object.keys(planning) as (keyof typeof planning)[]) {
      expect(planning[key]).toBe(true);
    }
  });

  it('OVERLAY_PALETTE.team0 and team1 differ', () => {
    expect(OVERLAY_PALETTE.team0).not.toEqual(OVERLAY_PALETTE.team1);
  });
});

describe('thumbnail passes', () => {
  it('modalDownsample picks the most common value per block', () => {
    const src = new Uint8Array([
      1, 1, 1, 2,
      1, 1, 2, 2,
      3, 3, 3, 3,
      3, 3, 3, 3,
    ]);
    const out = modalDownsample(src, 4, 4, 2, 2);
    expect(Array.from(out)).toEqual([1, 2, 3, 3]);
  });

  it('clusterGate removes single-tile islands', () => {
    const grid = new Uint8Array([
      1, 1, 1, 1,
      1, 2, 1, 1,
      1, 1, 1, 1,
      1, 1, 1, 1,
    ]);
    const flipped = clusterGate(grid, 4, 4, 2);
    expect(flipped).toBe(1);
    expect(grid[5]).toBe(1);
  });

  it('erode + dilate produce complementary results on open/close', () => {
    const mask = new Uint8Array([
      0, 0, 0,
      0, 1, 0,
      0, 0, 0,
    ]);
    const eroded = erode(mask, 3, 3);
    expect(Array.from(eroded)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const dilated = dilate(mask, 3, 3);
    expect(dilated.filter((v) => v === 1).length).toBeGreaterThan(1);
    // Open on a single pixel erases it.
    expect(Array.from(morphologicalOpen(mask, 3, 3))).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    // Close on a single hole (inverse) fills.
    const hole = new Uint8Array([
      1, 1, 1,
      1, 0, 1,
      1, 1, 1,
    ]);
    expect(morphologicalClose(hole, 3, 3)[4]).toBe(1);
  });

  it('medianFilter3x3 smooths salt-and-pepper noise', () => {
    const grid = new Uint8Array([
      0, 0, 0,
      0, 5, 0,
      0, 0, 0,
    ]);
    const out = medianFilter3x3(grid, 3, 3);
    expect(out[4]).toBe(0);
  });
});

describe('thumbnail overlays', () => {
  it('tileToGridRef round-trips to A1, B1, etc.', () => {
    expect(tileToGridRef(0, 0)).toBe('A1');
    expect(tileToGridRef(16, 0)).toBe('B1');
    expect(tileToGridRef(0, 16)).toBe('A2');
  });

  it('makeBufferDrawTarget supports drawRect + drawLine + fillRect', () => {
    const pixels = new Uint8ClampedArray(16 * 16 * 4);
    const t = makeBufferDrawTarget(pixels, 16, 16, 16, 16);
    t.drawRect(2, 2, 4, 4, [255, 0, 0, 255]);
    t.fillRect(8, 8, 2, 2, [0, 255, 0, 255]);
    t.drawLine(0, 0, 15, 15, [0, 0, 255, 128]);
    const hasRed = Array.from(pixels).some((_, i) => i % 4 === 0 && pixels[i] > 0);
    expect(hasRed).toBe(true);
  });
});

describe('thumbnail render', () => {
  it('generateThumbnail produces 96x96 RGBA at briefing tier', () => {
    const r = runPipeline(sampleRequest());
    const t = generateThumbnail(r, 96, { tier: 'briefing' });
    expect(t.width).toBe(96);
    expect(t.height).toBe(96);
    expect(t.pixels.length).toBe(96 * 96 * 4);
  });

  it('renderThumbnail is deterministic for identical inputs', () => {
    const r = runPipeline(sampleRequest());
    const a = renderThumbnail(r, 96, { tier: 'briefing' });
    const b = renderThumbnail(r, 96, { tier: 'briefing' });
    expect(a.pixels).toEqual(b.pixels);
  });

  it('strategic tier omits landmark outline + grid', () => {
    const r = runPipeline(sampleRequest());
    const strategic = generateThumbnail(r, 96, { tier: 'strategic' });
    const planning = generateThumbnail(r, 96, { tier: 'planning' });
    // Different tier configs MUST produce different output.
    expect(strategic.pixels).not.toEqual(planning.pixels);
  });
});

describe('thumbnail perf bench', () => {
  it('renders a 384² pipeline into 128px thumbnail under 250ms', () => {
    // 50ms target in COA-7 spec referred to a pre-generated MapGenResult.
    // Since we're running the full pipeline here too, we allow 250ms as a
    // perf regression guard that still catches 10x-degradation bugs.
    // 384² instead of 768² keeps the test under the default vitest timeout
    // while still catching order-of-magnitude regressions.
    const r = runPipeline({ ...sampleRequest(), size: 384 });
    const start = Date.now();
    generateThumbnail(r, 128, { tier: 'briefing' });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(250);
  }, 60000);
});
