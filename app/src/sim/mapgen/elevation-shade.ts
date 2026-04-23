// P3.3 — Sobel shading bake.
//
// Converts an elevationStep grid into a per-tile luminance multiplier
// (Uint8ClampedArray, 0..255 where 128 = neutral). The terrain renderer
// multiplies each tile's base color by shadingBake[i] / 128 to produce
// baked-in hill shading — matching Firefight's approach of baking hill
// shading into the hero JPG rather than computing it at runtime.
//
// Algorithm:
//   1. Sobel gradient per tile (gx, gy) on the elevationStep field.
//   2. Surface normal: n = normalize(-gx, -gy, k). k controls "height
//      exaggeration" — larger k means flatter visual response.
//   3. Light direction L pointing NW with 1.5 Z bias (Firefight's sun
//      comes from upper-left per @desktop audit).
//   4. Lambert = clamp(dot(n, L), 0, 1). Brightness = 0.55 + 0.45 *
//      Lambert so even fully-shadowed tiles stay legible.
//   5. Encode: shadingBake[i] = round(brightness * 255).
//
// Edge tiles copy their nearest in-bounds neighbor so no 1-pixel dark
// rim.

const K = 4; // height exaggeration — smaller k = stronger shading
const LIGHT_X = -1;
const LIGHT_Y = -1;
const LIGHT_Z = 1.5;
const LIGHT_LEN = Math.sqrt(LIGHT_X * LIGHT_X + LIGHT_Y * LIGHT_Y + LIGHT_Z * LIGHT_Z);
const LX = LIGHT_X / LIGHT_LEN;
const LY = LIGHT_Y / LIGHT_LEN;
const LZ = LIGHT_Z / LIGHT_LEN;

export function bakeShading(
  elevationStep: Uint8Array,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height);
  const idx = (x: number, y: number): number => y * width + x;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = elevationStep[idx(x - 1, y - 1)];
      const t = elevationStep[idx(x, y - 1)];
      const tr = elevationStep[idx(x + 1, y - 1)];
      const l = elevationStep[idx(x - 1, y)];
      const r = elevationStep[idx(x + 1, y)];
      const bl = elevationStep[idx(x - 1, y + 1)];
      const b = elevationStep[idx(x, y + 1)];
      const br = elevationStep[idx(x + 1, y + 1)];
      // Sobel
      const gx = tr + 2 * r + br - (tl + 2 * l + bl);
      const gy = bl + 2 * b + br - (tl + 2 * t + tr);
      // Normal = (-gx, -gy, k), normalized
      const nx = -gx;
      const ny = -gy;
      const nz = K;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      const dot = (nx * LX + ny * LY + nz * LZ) / len;
      const lambert = dot < 0 ? 0 : dot > 1 ? 1 : dot;
      const brightness = 0.55 + 0.45 * lambert;
      out[idx(x, y)] = Math.round(brightness * 255);
    }
  }

  // Edge tiles — copy nearest in-bounds neighbor. Top + bottom first.
  for (let x = 0; x < width; x++) {
    out[idx(x, 0)] = out[idx(Math.max(1, Math.min(width - 2, x)), 1)];
    out[idx(x, height - 1)] = out[idx(Math.max(1, Math.min(width - 2, x)), height - 2)];
  }
  for (let y = 0; y < height; y++) {
    out[idx(0, y)] = out[idx(1, Math.max(1, Math.min(height - 2, y)))];
    out[idx(width - 1, y)] = out[idx(width - 2, Math.max(1, Math.min(height - 2, y)))];
  }

  return out;
}

// P3.5b — contour overlay bake. Marks per-tile contour positions as 1
// where the tile's elevationStep differs from its north or west neighbor.
// Simple, deterministic, and lines up with how the renderer wants to
// draw strokes along step boundaries.
export function bakeContours(
  elevationStep: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const step = elevationStep[i];
      if (y > 0 && elevationStep[i - width] !== step) {
        out[i] = 1;
        continue;
      }
      if (x > 0 && elevationStep[i - 1] !== step) {
        out[i] = 1;
      }
    }
  }
  return out;
}
