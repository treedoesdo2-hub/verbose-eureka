// COA-7 tasks #137-138 — thumbnail renderer + LiveMinimapFrame contract.
//
// generateThumbnail runs the full COA-7 pipeline: modal downsample →
// cluster gate → median smoothing → base colorization → overlay stack
// (lines, zones, objectives, landmark, grid, legend, frame, labels).
// The tier argument selects which overlays are active via the palette's
// FEATURE_VISIBILITY map.
//
// renderThumbnail is a thin React-friendly wrapper around
// generateThumbnail that returns a plain Uint8ClampedArray so consumers
// can hand it to ImageData.set() directly. LiveMinimapFrame is the
// type-level stretch goal: a frozen data contract that an eventual
// in-game minimap component will subscribe to.

import { OVERLAY_PALETTE, FEATURE_VISIBILITY, type PaletteTier, pointColor, terrainColor } from './palette';
import {
  clusterGate,
  downsampleClamped,
  medianFilter3x3,
  modalDownsample,
} from './thumbnail-passes';
import {
  drawCapillaries,
  drawDominantLine,
  drawElevationContours,
  drawFrameBorder,
  drawGrid,
  drawHeroLandmark,
  drawLegendChip,
  drawObjectiveGlyph,
  drawSpawnMarkers,
  makeBufferDrawTarget,
} from './thumbnail-overlays';
import { placeLabels, type LabelRequest } from './thumbnail-labels';
import type { MapGenResult } from './types';

export type Thumbnail = {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
};

export type ThumbnailOptions = {
  readonly tier?: PaletteTier;
  readonly showDensityHeatmap?: boolean;
  // Cluster-gate floor in downsampled pixels. Setting this higher
  // smooths the minimap more aggressively. Default 3.
  readonly clusterMinSize?: number;
};

export function generateThumbnail(
  result: MapGenResult,
  targetSize: number = 128,
  opts: ThumbnailOptions = {},
): Thumbnail {
  const tier: PaletteTier = opts.tier ?? 'briefing';
  const visibility = FEATURE_VISIBILITY[tier];
  const tW = Math.min(targetSize, result.width);
  const tH = Math.min(targetSize, result.height);

  // ---- Pass 1: modal downsample of per-tile byte grids ----
  const baseD = modalDownsample(result.base, result.width, result.height, tW, tH);
  const pointD = visibility.points
    ? modalDownsample(result.point, result.width, result.height, tW, tH)
    : new Uint8Array(tW * tH);
  const buildingD = visibility.buildings
    ? modalDownsample(result.buildingId, result.width, result.height, tW, tH)
    : new Uint8Array(tW * tH);
  const elevationD = visibility.elevationContours
    ? modalDownsample(result.elevationStep, result.width, result.height, tW, tH)
    : new Uint8Array(tW * tH);
  // P3.7 / P3.7b — downsampled shadingBake + contours for per-tile visual
  // fidelity in the thumbnail. Tier's shadedRelief flag gates whether
  // shading actually applies; contours tier flag gates drawing strokes
  // (the downsampled buffer is cheap to produce regardless).
  const shadingD = visibility.shadedRelief
    ? downsampleClamped(result.shadingBake, result.width, result.height, tW, tH)
    : null;
  const contoursD = visibility.contours
    ? modalDownsample(result.contours, result.width, result.height, tW, tH)
    : null;

  // ---- Pass 2: cluster gate + median smoothing on base ----
  const minCluster = opts.clusterMinSize ?? 3;
  clusterGate(baseD, tW, tH, minCluster);
  const baseSmooth = medianFilter3x3(baseD, tW, tH);

  // ---- Pass 3: base colorization ----
  const pixels = new Uint8ClampedArray(tW * tH * 4);
  for (let i = 0; i < tW * tH; i++) {
    const o = i * 4;
    let color = terrainColor(baseSmooth[i], tier);
    if (visibility.buildings && buildingD[i] !== 0) {
      color = [58, 58, 62];
    } else if (visibility.points) {
      const p = pointColor(pointD[i]);
      if (p) color = p;
    }
    // P3.7 — apply shading multiplier before committing.
    const shade = shadingD ? shadingD[i] / 128 : 1;
    pixels[o] = Math.min(255, Math.max(0, color[0] * shade));
    pixels[o + 1] = Math.min(255, Math.max(0, color[1] * shade));
    pixels[o + 2] = Math.min(255, Math.max(0, color[2] * shade));
    pixels[o + 3] = 255;
    // P3.7b — contour stroke. Dark-stipple per-tile wherever the
    // downsampled contours flag is 1. Drawn on top of the shaded base
    // so the stroke contrasts cleanly.
    if (contoursD?.[i]) {
      pixels[o] = Math.round(pixels[o] * 0.6);
      pixels[o + 1] = Math.round(pixels[o + 1] * 0.6);
      pixels[o + 2] = Math.round(pixels[o + 2] * 0.6);
    }
  }

  // ---- Pass 4: density heatmap + hotspot pips ----
  // Driven by the tier's FeatureVisibility flag (planning tier enables
  // it); opts.showDensityHeatmap kept as an explicit per-call override
  // for tests. COA-1 #46.
  if (opts.showDensityHeatmap ?? visibility.densityHeatmap) {
    overlayDensityHeatmap(pixels, tW, tH, result);
    overlayHotspotPips(pixels, tW, tH, result);
  }

  // ---- Pass 5: vector overlays via DrawTarget ----
  const target = makeBufferDrawTarget(pixels, tW, tH, result.width, result.height);

  if (visibility.dominantLines && result.dominantLine) {
    drawDominantLine(target, result.dominantLine);
  }
  if (visibility.capillaries && result.capillaries.length > 0) {
    drawCapillaries(target, result.capillaries);
  }
  if (visibility.elevationContours) {
    // Use the downsampled elevation grid so contour costs scale to
    // thumbnail resolution, not source resolution.
    drawElevationContours(target, elevationD, tW, tH);
  }
  if (visibility.spawnMarkers) {
    drawSpawnMarkers(target, result.unitSlots);
  }
  if (visibility.objectiveGlyphs) {
    for (const a of result.objectiveAnchors) drawObjectiveGlyph(target, a);
  }
  if (visibility.landmarkOutline && result.heroLandmark) {
    drawHeroLandmark(target, result.heroLandmark, pixels);
  }
  if (visibility.grid) {
    drawGrid(target, result.width, result.height);
  }

  // ---- Pass 6: labels ----
  if (visibility.labels) {
    const requests: LabelRequest[] = [];
    if (result.heroLandmark) {
      const p = target.tilesToPx(
        result.heroLandmark.center.x,
        result.heroLandmark.center.y,
      );
      requests.push({
        anchorPx: p,
        text: result.heroLandmark.shortName,
        color: [255, 255, 255, 255],
        priority: 10,
      });
    }
    for (const a of result.objectiveAnchors) {
      const cx = a.rect.x + a.rect.w / 2;
      const cy = a.rect.y + a.rect.h / 2;
      const p = target.tilesToPx(cx, cy);
      const tint =
        a.kindHint === 'extract' ? OVERLAY_PALETTE.objectiveExtract :
        a.kindHint === 'defend' ? OVERLAY_PALETTE.objectiveDefend :
        OVERLAY_PALETTE.objectiveSecure;
      requests.push({
        anchorPx: p,
        text: a.kindHint.toUpperCase().slice(0, 3),
        color: [tint[0], tint[1], tint[2], 255],
        priority: 5,
      });
    }
    placeLabels(target, requests);
  }

  // ---- Pass 7: chrome ----
  if (visibility.legend) {
    drawLegendChip(target, [
      `T0 ${result.deployZones.team0.w}X${result.deployZones.team0.h}`,
      `T1 ${result.deployZones.team1.w}X${result.deployZones.team1.h}`,
    ]);
  }
  if (visibility.frame) {
    drawFrameBorder(target);
  }

  return { width: tW, height: tH, pixels };
}

// ---------------------------------------------------------------------------
// renderThumbnail — thin wrapper with an API that matches React's
// ImageData consumer pattern. Identical to generateThumbnail for now;
// the split exists so consumers can upgrade to a caching variant later
// without touching the pure generator.

export function renderThumbnail(
  result: MapGenResult,
  targetSize: number,
  opts: ThumbnailOptions = {},
): Thumbnail {
  return generateThumbnail(result, targetSize, opts);
}

// ---------------------------------------------------------------------------
// LiveMinimapFrame — type-only stretch. Data an eventual in-game minimap
// component subscribes to each tick. Carries per-tile diff payloads
// instead of the whole grid so the render loop stays cheap.

export type LiveMinimapFrame = {
  readonly tick: number;
  readonly tier: PaletteTier;
  readonly width: number;
  readonly height: number;
  readonly dirtyTiles: readonly { x: number; y: number; base: number; point: number; buildingId: number }[];
  readonly teamPositions: readonly { team: 0 | 1; x: number; y: number }[];
  readonly objectiveStatuses: readonly { id: string; status: 'active' | 'complete' | 'failed' }[];
};

// ---------------------------------------------------------------------------
// Density heatmap + hotspot pips preserved from the pre-COA-7 thumbnail.

function overlayDensityHeatmap(
  pixels: Uint8ClampedArray,
  tW: number,
  tH: number,
  result: MapGenResult,
): void {
  const scaleX = result.width / tW;
  const scaleY = result.height / tH;
  for (let ty = 0; ty < tH; ty++) {
    for (let tx = 0; tx < tW; tx++) {
      const sx = Math.floor(tx * scaleX);
      const sy = Math.floor(ty * scaleY);
      const d = result.coverDensity[sy * result.width + sx];
      if (d <= 0) continue;
      const alpha = Math.min(0.6, d * 0.8);
      const o = (ty * tW + tx) * 4;
      pixels[o] = Math.round(pixels[o] * (1 - alpha) + 255 * alpha);
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
): void {
  const scaleX = result.width / tW;
  const scaleY = result.height / tH;
  for (const h of result.hotspots) {
    const cx = Math.floor(h.x / scaleX);
    const cy = Math.floor(h.y / scaleY);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= tW || y >= tH) continue;
        const o = (y * tW + x) * 4;
        pixels[o] = 255;
        pixels[o + 1] = 255;
        pixels[o + 2] = 255;
      }
    }
  }
}
