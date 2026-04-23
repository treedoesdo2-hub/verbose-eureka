import type { WorldSnapshot } from '@shared/snapshot';
import { Container, Sprite, Texture } from 'pixi.js';
import { terrainColor, pointColor } from '@sim/mapgen/palette';

const CHUNK_TILES = 32;

// Sprite-per-chunk terrain renderer (P1.4).
//
// Previous design used Pixi Graphics (one rect per tile per color). This
// version bakes each chunk to an offscreen Canvas2D ImageData and wraps it
// in a Sprite. Result: one draw call per chunk, per-tile tint-capable
// (enables the P3.5 shaded-relief pass), and the ImageData path gives us
// direct per-pixel control for subsequent baked effects like contours.
export class TerrainLayer {
  readonly container: Container;
  private chunks: { sprite: Sprite; x: number; y: number; w: number; h: number }[] = [];
  private tileSize: number;

  constructor(world: WorldSnapshot) {
    this.container = new Container();
    this.tileSize = world.tileSizeMeters;
    this.bake(world);
  }

  private bake(world: WorldSnapshot): void {
    const ts = world.tileSizeMeters;
    for (let cy = 0; cy < world.height; cy += CHUNK_TILES) {
      for (let cx = 0; cx < world.width; cx += CHUNK_TILES) {
        const cw = Math.min(CHUNK_TILES, world.width - cx);
        const ch = Math.min(CHUNK_TILES, world.height - cy);
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        if (!ctx) throw new Error('2d context unavailable');
        const imageData = ctx.createImageData(cw, ch);
        const pixels = imageData.data;
        // shadingBake: 128 = neutral; <128 darkens, >128 brightens. Applied
        // as a multiplier (shade / 128).
        const shading = world.shadingBake;
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            const worldIdx = (cy + y) * world.width + (cx + x);
            // Feature priority at bake-time: buildings > point-objects >
            // base. Edges paint on top as 1px strokes after the base fill.
            let r: number;
            let g: number;
            let b: number;
            const buildingId = world.buildingId[worldIdx];
            if (buildingId > 0) {
              // Flat building fill — darker warm grey so sprite+shadow
              // overlays (P5+) read clearly against it. Same tone for all
              // families until family-specific sprites land.
              r = 88;
              g = 80;
              b = 68;
            } else {
              const point = world.point[worldIdx];
              const pointRgb = point > 0 ? pointColor(point) : null;
              if (pointRgb) {
                r = pointRgb[0];
                g = pointRgb[1];
                b = pointRgb[2];
              } else {
                const baseRgb = terrainColor(world.base[worldIdx], 'battle');
                r = baseRgb[0];
                g = baseRgb[1];
                b = baseRgb[2];
              }
            }
            const shade = shading[worldIdx] / 128;
            const pi = (y * cw + x) * 4;
            pixels[pi] = Math.min(255, Math.max(0, r * shade));
            pixels[pi + 1] = Math.min(255, Math.max(0, g * shade));
            pixels[pi + 2] = Math.min(255, Math.max(0, b * shade));
            pixels[pi + 3] = 255;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        // Edges paint after the base fill via Canvas2D fillRect. Hedge
        // (kind 1) + bocage (kind 2) → dark green; stone_wall_low (kind
        // 3) → grey; wood_fence (kind 4) → brown. The kind occupies the
        // low 4 bits; state/material the high 4 bits are ignored at this
        // tier.
        const edgeColorFor = (kind: number): string | null => {
          if (kind === 1 || kind === 2) return '#303e22';
          if (kind === 3) return '#6a6660';
          if (kind === 4) return '#5a4a32';
          return null;
        };
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            const worldIdx = (cy + y) * world.width + (cx + x);
            const colorN = edgeColorFor(world.edgeN[worldIdx] & 0x0f);
            if (colorN) {
              ctx.fillStyle = colorN;
              ctx.fillRect(x, y, 1, 1);
            }
            const colorW = edgeColorFor(world.edgeW[worldIdx] & 0x0f);
            if (colorW) {
              ctx.fillStyle = colorW;
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
        const tex = Texture.from(canvas);
        const sprite = new Sprite(tex);
        sprite.position.set(cx * ts, cy * ts);
        sprite.scale.set(ts, ts);
        // Sprites default to bilinear; nearest keeps tile edges crisp when
        // zoomed in.
        tex.source.scaleMode = 'nearest';
        this.container.addChild(sprite);
        this.chunks.push({
          sprite,
          x: cx * ts,
          y: cy * ts,
          w: cw * ts,
          h: ch * ts,
        });
      }
    }
  }

  // Hide chunks whose bounds don't intersect the viewport rect (in world
  // space). Called on camera move/zoom/resize.
  cull(viewMinX: number, viewMinY: number, viewMaxX: number, viewMaxY: number): void {
    for (const c of this.chunks) {
      const visible =
        c.x + c.w >= viewMinX && c.x <= viewMaxX && c.y + c.h >= viewMinY && c.y <= viewMaxY;
      c.sprite.visible = visible;
    }
  }

  chunkCount(): number {
    return this.chunks.length;
  }

  dispose(): void {
    for (const c of this.chunks) {
      c.sprite.texture.destroy(true);
      c.sprite.destroy();
    }
    this.chunks = [];
    this.container.destroy({ children: true });
  }

  get chunkSize(): number {
    return CHUNK_TILES * this.tileSize;
  }
}
