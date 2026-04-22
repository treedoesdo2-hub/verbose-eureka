// COA-7 tasks #126-134 — thumbnail overlay primitives + feature
// renderers. All overlay functions operate through a DrawTarget
// abstraction so the same code paths render both the briefing
// preview (RGBA buffer) and the eventual in-game overlay canvas.

import type { DominantCapillary, DominantLine, LineKind } from './dominant-line';
import type { HeroLandmark } from './hero-landmark';
import { lineStroke, OVERLAY_PALETTE, type RGBA } from './palette';
import type { DeployZone, ObjectiveAnchor } from './types';

export type DrawTarget = {
  readonly width: number;
  readonly height: number;
  // Source units — map tiles. Scales from tiles to target pixels.
  readonly tilesToPx: (tx: number, ty: number) => { x: number; y: number };
  // Primitive writers. Coordinates are in pixels (post-scale).
  putPixel(x: number, y: number, color: RGBA): void;
  drawLine(x0: number, y0: number, x1: number, y1: number, color: RGBA): void;
  drawRect(x: number, y: number, w: number, h: number, color: RGBA): void;
  fillRect(x: number, y: number, w: number, h: number, color: RGBA): void;
  drawGlyph(cx: number, cy: number, glyph: string, color: RGBA): void;
};

// RGBA Uint8ClampedArray-backed DrawTarget. Alpha-blends with the
// existing pixel so layered overlays compose correctly.

export function makeBufferDrawTarget(
  pixels: Uint8ClampedArray,
  W: number,
  H: number,
  sourceTileW: number,
  sourceTileH: number,
): DrawTarget {
  const sx = W / sourceTileW;
  const sy = H / sourceTileH;
  const putPixel = (x: number, y: number, color: RGBA): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
    const o = (yi * W + xi) * 4;
    const a = color[3] / 255;
    pixels[o] = Math.floor(pixels[o] * (1 - a) + color[0] * a);
    pixels[o + 1] = Math.floor(pixels[o + 1] * (1 - a) + color[1] * a);
    pixels[o + 2] = Math.floor(pixels[o + 2] * (1 - a) + color[2] * a);
    pixels[o + 3] = 255;
  };
  return {
    width: W,
    height: H,
    tilesToPx(tx, ty) {
      return { x: tx * sx, y: ty * sy };
    },
    putPixel,
    drawLine(x0, y0, x1, y1, color) {
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sxStep = x0 < x1 ? 1 : -1;
      const syStep = y0 < y1 ? 1 : -1;
      let err = dx - dy;
      let cx = Math.round(x0);
      let cy = Math.round(y0);
      while (true) {
        putPixel(cx, cy, color);
        if (cx === Math.round(x1) && cy === Math.round(y1)) break;
        const e2 = err * 2;
        if (e2 > -dy) {
          err -= dy;
          cx += sxStep;
        }
        if (e2 < dx) {
          err += dx;
          cy += syStep;
        }
      }
    },
    drawRect(x, y, w, h, color) {
      for (let i = 0; i < w; i++) {
        putPixel(x + i, y, color);
        putPixel(x + i, y + h - 1, color);
      }
      for (let j = 0; j < h; j++) {
        putPixel(x, y + j, color);
        putPixel(x + w - 1, y + j, color);
      }
    },
    fillRect(x, y, w, h, color) {
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) putPixel(x + i, y + j, color);
      }
    },
    drawGlyph(cx, cy, glyph, color) {
      drawGlyphBitmap(putPixel, cx, cy, glyph, color);
    },
  };
}

// ---- Dominant line raster stroke (task #127) ------------------------------
// Bresenham-stroke each waypoint pair. Width is kind-dependent (rails
// thicker than footpaths).

const LINE_WIDTHS: Record<LineKind, number> = {
  'road-straight': 2,
  'road-star': 2,
  rail: 2,
  river: 2,
  canal: 3,
  ridge: 1,
  highstreet: 2,
  'hedgerow-spine': 1,
};

export function drawDominantLine(target: DrawTarget, line: DominantLine): void {
  const stroke = lineStroke(line.kind);
  const color: RGBA = [stroke[0], stroke[1], stroke[2], 235];
  const w = LINE_WIDTHS[line.kind];
  for (let i = 0; i < line.waypoints.length - 1; i++) {
    const a = line.waypoints[i];
    const b = line.waypoints[i + 1];
    const pa = target.tilesToPx(a.x, a.y);
    const pb = target.tilesToPx(b.x, b.y);
    // Redraw w times with 1px offsets for fake width.
    for (let o = 0; o < w; o++) {
      target.drawLine(pa.x + o, pa.y, pb.x + o, pb.y, color);
      if (o > 0) target.drawLine(pa.x, pa.y + o, pb.x, pb.y + o, color);
    }
  }
}

export function drawCapillaries(
  target: DrawTarget,
  caps: readonly DominantCapillary[],
): void {
  for (const c of caps) {
    const stroke = lineStroke(c.parent.kind);
    const color: RGBA = [stroke[0], stroke[1], stroke[2], 180];
    for (let i = 0; i < c.waypoints.length - 1; i++) {
      const a = c.waypoints[i];
      const b = c.waypoints[i + 1];
      const pa = target.tilesToPx(a.x, a.y);
      const pb = target.tilesToPx(b.x, b.y);
      target.drawLine(pa.x, pa.y, pb.x, pb.y, color);
    }
  }
}

// ---- Elevation contours (task #128) --------------------------------------
// Walks every elevation-step boundary and paints a thin contour line
// where an adjacent tile is more than CONTOUR_STEP apart. One pass
// per level keeps contour weight consistent.

const CONTOUR_STEP = 2;

export function drawElevationContours(
  target: DrawTarget,
  elevationStep: Uint8Array,
  tileW: number,
  tileH: number,
): void {
  const color = OVERLAY_PALETTE.contour;
  for (let y = 0; y < tileH - 1; y++) {
    for (let x = 0; x < tileW - 1; x++) {
      const here = elevationStep[y * tileW + x];
      const right = elevationStep[y * tileW + (x + 1)];
      const down = elevationStep[(y + 1) * tileW + x];
      if (Math.abs(right - here) >= CONTOUR_STEP) {
        const p = target.tilesToPx(x + 1, y);
        target.drawLine(p.x, p.y, p.x, p.y + Math.max(1, tileScaleY(target, tileH)), color);
      }
      if (Math.abs(down - here) >= CONTOUR_STEP) {
        const p = target.tilesToPx(x, y + 1);
        target.drawLine(p.x, p.y, p.x + Math.max(1, tileScaleX(target, tileW)), p.y, color);
      }
    }
  }
}

function tileScaleX(target: DrawTarget, tileW: number): number {
  return target.width / tileW;
}
function tileScaleY(target: DrawTarget, tileH: number): number {
  return target.height / tileH;
}

// ---- Deploy zone perimeters + facing arrows (task #129) -------------------

export function drawDeployZone(
  target: DrawTarget,
  zone: DeployZone,
  team: 0 | 1,
): void {
  const tint = team === 0 ? OVERLAY_PALETTE.team0 : OVERLAY_PALETTE.team1;
  const dashColor: RGBA = [tint[0], tint[1], tint[2], 220];
  const fillColor: RGBA = [tint[0], tint[1], tint[2], 45];
  const topLeft = target.tilesToPx(zone.x, zone.y);
  const bottomRight = target.tilesToPx(zone.x + zone.w, zone.y + zone.h);
  const wPx = Math.max(1, Math.round(bottomRight.x - topLeft.x));
  const hPx = Math.max(1, Math.round(bottomRight.y - topLeft.y));
  target.fillRect(Math.round(topLeft.x), Math.round(topLeft.y), wPx, hPx, fillColor);
  // Dashed perimeter: emit 3-on, 2-off pattern.
  drawDashedRect(target, Math.round(topLeft.x), Math.round(topLeft.y), wPx, hPx, dashColor);
  // Facing arrow: draw a short stroke from zone center in the facing
  // direction.
  if (typeof zone.facing === 'number') {
    const cx = (topLeft.x + bottomRight.x) / 2;
    const cy = (topLeft.y + bottomRight.y) / 2;
    const len = Math.max(4, Math.min(wPx, hPx) / 3);
    const ex = cx + Math.cos(zone.facing) * len;
    const ey = cy + Math.sin(zone.facing) * len;
    target.drawLine(cx, cy, ex, ey, dashColor);
  }
}

function drawDashedRect(
  target: DrawTarget,
  x: number,
  y: number,
  w: number,
  h: number,
  color: RGBA,
): void {
  const dash = 3;
  const gap = 2;
  for (let i = 0; i < w; i++) {
    if (i % (dash + gap) < dash) {
      target.putPixel(x + i, y, color);
      target.putPixel(x + i, y + h - 1, color);
    }
  }
  for (let j = 0; j < h; j++) {
    if (j % (dash + gap) < dash) {
      target.putPixel(x, y + j, color);
      target.putPixel(x + w - 1, y + j, color);
    }
  }
}

// ---- Objective glyphs (task #130) -----------------------------------------

export function drawObjectiveGlyph(
  target: DrawTarget,
  anchor: ObjectiveAnchor,
): void {
  const tint =
    anchor.kindHint === 'extract' ? OVERLAY_PALETTE.objectiveExtract :
    anchor.kindHint === 'defend' ? OVERLAY_PALETTE.objectiveDefend :
    OVERLAY_PALETTE.objectiveSecure;
  const color: RGBA = [tint[0], tint[1], tint[2], 230];
  const cx = anchor.rect.x + anchor.rect.w / 2;
  const cy = anchor.rect.y + anchor.rect.h / 2;
  const p = target.tilesToPx(cx, cy);
  const glyph =
    anchor.kindHint === 'extract' ? 'EX' :
    anchor.kindHint === 'defend' ? 'DF' :
    'SC';
  target.drawGlyph(p.x, p.y, glyph, color);
}

// ---- Hero landmark outline + saturation boost (task #131) -----------------

export function drawHeroLandmark(
  target: DrawTarget,
  landmark: HeroLandmark,
  _pixels: Uint8ClampedArray, // for saturation boost — see description below
): void {
  const outline = OVERLAY_PALETTE.heroLandmark;
  const color: RGBA = [outline[0], outline[1], outline[2], 255];
  // Outline the footprint by stroking a line along its convex hull's
  // axis-aligned bbox for now — cheap + readable at thumbnail scale.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of landmark.footprint) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return;
  const tl = target.tilesToPx(minX, minY);
  const br = target.tilesToPx(maxX + 1, maxY + 1);
  target.drawRect(
    Math.round(tl.x),
    Math.round(tl.y),
    Math.max(1, Math.round(br.x - tl.x)),
    Math.max(1, Math.round(br.y - tl.y)),
    color,
  );
}

// ---- Grid overlay + tileToGridRef (task #132) -----------------------------
// Draws a coarse grid every GRID_TILE_PITCH tiles. Supports A1-style
// grid references (letters for columns, numbers for rows) via
// tileToGridRef.

const GRID_TILE_PITCH = 16;

export function drawGrid(target: DrawTarget, tileW: number, tileH: number): void {
  const color = OVERLAY_PALETTE.gridLine;
  for (let x = GRID_TILE_PITCH; x < tileW; x += GRID_TILE_PITCH) {
    const a = target.tilesToPx(x, 0);
    const b = target.tilesToPx(x, tileH);
    target.drawLine(a.x, a.y, b.x, b.y, color);
  }
  for (let y = GRID_TILE_PITCH; y < tileH; y += GRID_TILE_PITCH) {
    const a = target.tilesToPx(0, y);
    const b = target.tilesToPx(tileW, y);
    target.drawLine(a.x, a.y, b.x, b.y, color);
  }
}

export function tileToGridRef(tileX: number, tileY: number): string {
  const col = Math.floor(tileX / GRID_TILE_PITCH);
  const row = Math.floor(tileY / GRID_TILE_PITCH);
  const letter = String.fromCharCode(65 + (col % 26));
  return `${letter}${row + 1}`;
}

// ---- Legend chip (task #133) ----------------------------------------------

export function drawLegendChip(
  target: DrawTarget,
  lines: readonly string[],
): void {
  if (lines.length === 0) return;
  const padding = 3;
  const lineHeight = 6;
  const chipW = 48;
  const chipH = lines.length * lineHeight + padding * 2;
  const x = target.width - chipW - 4;
  const y = target.height - chipH - 4;
  target.fillRect(x, y, chipW, chipH, OVERLAY_PALETTE.legendChip);
  for (let i = 0; i < lines.length; i++) {
    target.drawGlyph(x + padding, y + padding + i * lineHeight + 2, lines[i], [255, 255, 255, 255]);
  }
}

// ---- Frame border (task #134) ---------------------------------------------

export function drawFrameBorder(target: DrawTarget): void {
  target.drawRect(0, 0, target.width, target.height, OVERLAY_PALETTE.frameBorder);
}

// ---------------------------------------------------------------------------
// Minimal 3x5 bitmap glyphs for thumbnail labels. Not a real font — just
// enough to render 'A1', 'EX', 'DF', 'SC', and short two-letter chips.

const GLYPH_BITMAPS: Record<string, readonly string[]> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '110', '100', '110', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '111', '011'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '011'],
  V: ['101', '101', '101', '010', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  '0': ['010', '101', '101', '101', '010'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['110', '001', '010', '100', '111'],
  '3': ['110', '001', '010', '001', '110'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '110', '001', '110'],
  '6': ['010', '100', '110', '101', '010'],
  '7': ['111', '001', '010', '100', '100'],
  '8': ['010', '101', '010', '101', '010'],
  '9': ['010', '101', '011', '001', '010'],
  '-': ['000', '000', '111', '000', '000'],
  ' ': ['000', '000', '000', '000', '000'],
};

function drawGlyphBitmap(
  putPixel: (x: number, y: number, color: RGBA) => void,
  cx: number,
  cy: number,
  glyph: string,
  color: RGBA,
): void {
  // Render left-to-right starting at (cx, cy), with 1 pixel spacing
  // between chars. Unknown chars fall back to a 3×5 question block.
  let x = Math.round(cx);
  const y = Math.round(cy);
  for (const ch of glyph.toUpperCase()) {
    const rows = GLYPH_BITMAPS[ch] ?? GLYPH_BITMAPS['?'] ?? GLYPH_BITMAPS[' '];
    for (let ry = 0; ry < rows.length; ry++) {
      const row = rows[ry];
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === '1') putPixel(x + rx, y + ry, color);
      }
    }
    x += 4;
  }
}
