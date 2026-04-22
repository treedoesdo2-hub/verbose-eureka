import type { MapGenResult } from './types';

const TERRAIN_COLOR_HEX: Record<number, string> = {
  0: '#1a2b1a', // open
  1: '#3a342b', // road
  2: '#4a3e2f', // building
  3: '#1b3a1f', // forest
  4: '#193352', // water
  5: '#342c26', // rubble
};

// Downsample a generated map terrain buffer into a small RGBA ImageData-friendly
// array suitable for briefing preview. Pure function; no DOM access.
export type Thumbnail = {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray; // RGBA, row-major
};

export function generateThumbnail(result: MapGenResult, targetSize: number = 128): Thumbnail {
  const tW = Math.min(targetSize, result.width);
  const tH = Math.min(targetSize, result.height);
  const pixels = new Uint8ClampedArray(tW * tH * 4);
  const scaleX = result.width / tW;
  const scaleY = result.height / tH;
  for (let ty = 0; ty < tH; ty++) {
    for (let tx = 0; tx < tW; tx++) {
      const sx = Math.floor(tx * scaleX);
      const sy = Math.floor(ty * scaleY);
      const terrainByte = result.terrain[sy * result.width + sx];
      const color = TERRAIN_COLOR_HEX[terrainByte] ?? '#1a2b1a';
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
  return { width: tW, height: tH, pixels };
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
