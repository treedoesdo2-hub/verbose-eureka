import type { MapGenResult } from './types';

// Base-surface colors (indexed by world.ts BASE_KINDS order). COA-7 will
// replace this with palette.ts + overlay stack; keep MVP colors here so the
// briefing preview still renders.
const BASE_COLOR_HEX: Record<number, string> = {
  0: '#b2a486', // open — tan
  1: '#96825e', // road
  2: '#355066', // water_shallow
  3: '#141e2e', // water_deep
  4: '#4b3a2a', // mud
  5: '#665c4e', // rubble_ground
  6: '#d6dde0', // snow
  7: '#d0b784', // sand
};

// Quick point-object tint overlays — for now just mark foliage darker.
const POINT_TINT_HEX: Record<number, string> = {
  // Tree bytes (pointToByte is 1-based; tree_forest happens to map to 22).
  22: '#2e482c',
  23: '#2e482c',
  24: '#2e482c',
  25: '#2e482c',
  26: '#2e482c',
  27: '#2e482c',
};

// Downsample a generated map terrain buffer into a small RGBA ImageData-friendly
// array suitable for briefing preview. Pure function; no DOM access.
export type Thumbnail = {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray; // RGBA, row-major
};

export type ThumbnailOptions = {
  // COA-1 task #46 — dev-only heatmap overlay for debugging density fields.
  // Blends a red tint proportional to coverDensity; hotspots marked with
  // a 2x2 white pip. Ship-default: false.
  readonly showDensityHeatmap?: boolean;
};

export function generateThumbnail(
  result: MapGenResult,
  targetSize: number = 128,
  opts: ThumbnailOptions = {},
): Thumbnail {
  const tW = Math.min(targetSize, result.width);
  const tH = Math.min(targetSize, result.height);
  const pixels = new Uint8ClampedArray(tW * tH * 4);
  const scaleX = result.width / tW;
  const scaleY = result.height / tH;
  for (let ty = 0; ty < tH; ty++) {
    for (let tx = 0; tx < tW; tx++) {
      const sx = Math.floor(tx * scaleX);
      const sy = Math.floor(ty * scaleY);
      const baseByte = result.base[sy * result.width + sx];
      const pointByte = result.point[sy * result.width + sx];
      const hasBuilding = result.buildingId[sy * result.width + sx] !== 0;
      let color: string;
      if (hasBuilding) color = '#3a3a3e';
      else if (pointByte > 0 && POINT_TINT_HEX[pointByte]) color = POINT_TINT_HEX[pointByte];
      else color = BASE_COLOR_HEX[baseByte] ?? '#b2a486';
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const o = (ty * tW + tx) * 4;
      pixels[o + 0] = r;
      pixels[o + 1] = g;
      pixels[o + 2] = b;
      pixels[o + 3] = 255;
    }
  }
  // Overlay deploy zone tints (subtle) so the player sees the spawn layout.
  overlayZone(pixels, tW, tH, result, result.deployZones.team0, [85, 170, 255], scaleX, scaleY);
  overlayZone(pixels, tW, tH, result, result.deployZones.team1, [255, 90, 74], scaleX, scaleY);
  if (opts.showDensityHeatmap) {
    overlayDensityHeatmap(pixels, tW, tH, result, scaleX, scaleY);
    overlayHotspotPips(pixels, tW, tH, result, scaleX, scaleY);
  }
  return { width: tW, height: tH, pixels };
}

// Red-channel heatmap overlay driven by coverDensity. Density 0 → no change,
// density 1 → full red wash at alpha 0.6. Intended for dev / debug viewing;
// never enabled for shipped map previews.
function overlayDensityHeatmap(
  pixels: Uint8ClampedArray,
  tW: number,
  tH: number,
  result: MapGenResult,
  scaleX: number,
  scaleY: number,
): void {
  for (let ty = 0; ty < tH; ty++) {
    for (let tx = 0; tx < tW; tx++) {
      const sx = Math.floor(tx * scaleX);
      const sy = Math.floor(ty * scaleY);
      const d = result.coverDensity[sy * result.width + sx];
      if (d <= 0) continue;
      const alpha = Math.min(0.6, d * 0.8);
      const o = (ty * tW + tx) * 4;
      pixels[o + 0] = Math.round(pixels[o + 0] * (1 - alpha) + 255 * alpha);
      pixels[o + 1] = Math.round(pixels[o + 1] * (1 - alpha) + 20 * alpha);
      pixels[o + 2] = Math.round(pixels[o + 2] * (1 - alpha) + 20 * alpha);
    }
  }
}

function overlayHotspotPips(
  pixels: Uint8ClampedArray,
  tW: number,
  tH: number,
  result: MapGenResult,
  scaleX: number,
  scaleY: number,
): void {
  for (const h of result.hotspots) {
    const cx = Math.floor(h.x / scaleX);
    const cy = Math.floor(h.y / scaleY);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= tW || y >= tH) continue;
        const o = (y * tW + x) * 4;
        pixels[o + 0] = 255;
        pixels[o + 1] = 255;
        pixels[o + 2] = 255;
      }
    }
  }
}

function overlayZone(
  pixels: Uint8ClampedArray,
  tW: number,
  tH: number,
  result: MapGenResult,
  zone: { x: number; y: number; w: number; h: number },
  tint: readonly [number, number, number],
  scaleX: number,
  scaleY: number,
): void {
  const x0 = Math.max(0, Math.floor(zone.x / scaleX));
  const y0 = Math.max(0, Math.floor(zone.y / scaleY));
  const x1 = Math.min(tW, Math.ceil((zone.x + zone.w) / scaleX));
  const y1 = Math.min(tH, Math.ceil((zone.y + zone.h) / scaleY));
  void result;
  const alpha = 0.35;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * tW + x) * 4;
      pixels[o + 0] = Math.round(pixels[o + 0] * (1 - alpha) + tint[0] * alpha);
      pixels[o + 1] = Math.round(pixels[o + 1] * (1 - alpha) + tint[1] * alpha);
      pixels[o + 2] = Math.round(pixels[o + 2] * (1 - alpha) + tint[2] * alpha);
    }
  }
}
