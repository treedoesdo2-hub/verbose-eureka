import type { WorldSnapshot } from '@shared/snapshot';
import { Container, Graphics } from 'pixi.js';

const TERRAIN_COLORS: Record<number, number> = {
  0: 0x1a2b1a,
  1: 0x3a342b,
  2: 0x4a3e2f,
  3: 0x1b3a1f,
  4: 0x193352,
  5: 0x342c26,
};

const CHUNK_TILES = 32;

// Chunked terrain renderer: one Graphics per CHUNK_TILES×CHUNK_TILES block,
// baked once at scene init. Viewport culling hides off-screen chunks without
// re-rendering. At 4096² this is 16384 chunk graphics — still a lot, but
// tractable because each chunk is a single draw call and only visible chunks
// are rendered by Pixi each frame.
export class TerrainLayer {
  readonly container: Container;
  private chunks: { g: Graphics; x: number; y: number; w: number; h: number }[] = [];
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
        const g = new Graphics();
        // Group tiles by color within the chunk so each color is one fill call.
        const byColor = new Map<number, { x: number; y: number }[]>();
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            const i = (cy + y) * world.width + (cx + x);
            const color = TERRAIN_COLORS[world.terrain[i]] ?? 0x1a2b1a;
            let arr = byColor.get(color);
            if (!arr) {
              arr = [];
              byColor.set(color, arr);
            }
            arr.push({ x: (cx + x) * ts, y: (cy + y) * ts });
          }
        }
        for (const [color, tiles] of byColor) {
          for (const t of tiles) g.rect(t.x, t.y, ts, ts);
          g.fill({ color });
        }
        this.container.addChild(g);
        this.chunks.push({
          g,
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
      c.g.visible = visible;
    }
  }

  chunkCount(): number {
    return this.chunks.length;
  }

  dispose(): void {
    for (const c of this.chunks) c.g.destroy();
    this.chunks = [];
    this.container.destroy({ children: true });
  }

  get chunkSize(): number {
    return CHUNK_TILES * this.tileSize;
  }
}
