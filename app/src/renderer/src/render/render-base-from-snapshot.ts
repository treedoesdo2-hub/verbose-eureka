// P7.10 — shared helper: WorldSnapshot → RGBA Uint8ClampedArray.
//
// Pure, no Pixi. Used by:
//   - TerrainLayer (wraps result in a Sprite via Texture.from(canvas))
//   - integration-thumbnail-parity.test.ts (computes byte-identical
//     thumbnail vs. the Pixi renderer would)
//
// Single source of truth: if this function changes, both consumers see
// the update. Before this existed TerrainLayer had its own inline bake
// loop that diverged from the thumbnail pipeline, which is exactly the
// divergence the rework is stamping out.

import type { WorldSnapshot } from '@shared/snapshot';
import { terrainColor, pointColor } from '@sim/mapgen/palette';
import type { PaletteTier } from '@sim/mapgen/palette';

export type RenderBaseOptions = {
  readonly tier: PaletteTier;
  readonly applyShading: boolean;
  readonly applyContours: boolean;
};

export function renderBaseFromSnapshot(
  world: WorldSnapshot,
  options: RenderBaseOptions = { tier: 'battle', applyShading: true, applyContours: false },
): { pixels: Uint8ClampedArray; width: number; height: number } {
  const { width, height } = world;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const worldIdx = y * width + x;
      let r: number;
      let g: number;
      let b: number;
      if (world.buildingId[worldIdx] > 0) {
        r = 88;
        g = 80;
        b = 68;
      } else {
        const point = world.point[worldIdx];
        const pointRgb = point > 0 ? pointColor(point) : null;
        if (pointRgb) {
          [r, g, b] = pointRgb;
        } else {
          const baseRgb = terrainColor(world.base[worldIdx], options.tier);
          [r, g, b] = baseRgb;
        }
      }
      const shade = options.applyShading ? world.shadingBake[worldIdx] / 128 : 1;
      let fr = r * shade;
      let fg = g * shade;
      let fb = b * shade;
      if (options.applyContours && world.contours[worldIdx]) {
        fr *= 0.6;
        fg *= 0.6;
        fb *= 0.6;
      }
      const pi = worldIdx * 4;
      pixels[pi] = Math.min(255, Math.max(0, fr));
      pixels[pi + 1] = Math.min(255, Math.max(0, fg));
      pixels[pi + 2] = Math.min(255, Math.max(0, fb));
      pixels[pi + 3] = 255;
    }
  }
  return { pixels, width, height };
}
