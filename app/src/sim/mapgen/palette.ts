// COA-7 tasks #117-121 — central palette + visibility-tier registry.
//
// Every color that ends up on the battle canvas or the minimap passes
// through this module. Two parallel palettes live here:
//  - battlePalette: full-saturation colors used by the live render.
//  - minimapPalette: desaturated, simplified colors used by the
//    briefing / commander-console thumbnails.
//
// Thresholds control which feature classes appear at which tier —
// strategic tier shows only terrain bands + deploy zones, briefing tier
// adds dominant lines + objectives, planning tier adds the grid +
// elevation contours. Subsumes the ad-hoc BASE_COLOR_HEX map that used
// to live in thumbnail.ts.

import type { LineKind } from './dominant-line';

export type RGB = readonly [number, number, number];
export type RGBA = readonly [number, number, number, number];

export type PaletteTier = 'battle' | 'strategic' | 'briefing' | 'planning';

// ---- Base-surface colors indexed by world.ts BASE_KINDS order -------------
// Firefight v9.0.2 authoritative palette per terrain-palette.json
// (D5 in AUDIT_INTEGRATION.md). Desaturated warm earth tones; water is
// olive-grey, not blue.

const TERRAIN_PALETTE_BATTLE: RGB[] = [
  [100, 96, 37], //   0 open — Firefight olive (#646025)
  [150, 138, 117], // 1 road — Firefight warm grey (#968A75)
  [95, 97, 29], //    2 water_shallow — Firefight olive-grey (#5F611D)
  [78, 80, 22], //    3 water_deep — deeper olive for contrast
  [106, 91, 42], //   4 mud — Firefight (#6A5B2A)
  [85, 75, 63], //    5 rubble_ground — darker greyer mud variant
  [220, 224, 220], // 6 snow — lightly warm bone (no Firefight sample)
  [150, 127, 81], //  7 sand — Firefight (#967F51)
];

// Minimap tier brightens the Firefight base values to keep small tiles
// legible, but preserves hue so the aesthetic stays continuous with the
// battle view.
const TERRAIN_PALETTE_MINIMAP: RGB[] = [
  [130, 125, 55], //  0 open — lifted Firefight olive
  [170, 158, 137], // 1 road
  [115, 117, 45], //  2 water_shallow
  [95, 98, 32], //    3 water_deep
  [130, 112, 60], //  4 mud
  [110, 98, 82], //   5 rubble_ground
  [232, 236, 232], // 6 snow
  [180, 155, 101], // 7 sand
];

export function terrainColor(baseByte: number, tier: PaletteTier): RGB {
  const palette = tier === 'battle' ? TERRAIN_PALETTE_BATTLE : TERRAIN_PALETTE_MINIMAP;
  return palette[baseByte] ?? palette[0];
}

// ---- Point-object colors (foliage + barrier kinds) ------------------------
// Indexed by pointToByte value. We only list the kinds worth colouring on
// the minimap — everything else falls through to the base color.

const POINT_COLOR: Record<number, RGB> = {
  // tree_forest byte = 22 (best-effort — schema migrations may bump).
  22: [46, 72, 44], // tree_forest / dense foliage dark green
  23: [54, 84, 50], // tree_scatter lighter green
  24: [58, 88, 56], // bush_medium
  25: [64, 96, 60], // bush_low
  // Rocks / boulders dark grey.
  26: [86, 82, 76],
  27: [68, 66, 62],
};

export function pointColor(pointByte: number): RGB | null {
  return POINT_COLOR[pointByte] ?? null;
}

// ---- Dominant line stroke colors per kind ---------------------------------

const LINE_STROKE: Record<LineKind, RGB> = {
  'road-straight': [90, 72, 52],
  'road-star': [90, 72, 52],
  rail: [60, 60, 60],
  river: [40, 80, 115],
  canal: [70, 110, 140],
  ridge: [140, 120, 90],
  highstreet: [110, 88, 60],
  'hedgerow-spine': [48, 70, 44],
};

export function lineStroke(kind: LineKind): RGB {
  return LINE_STROKE[kind];
}

// ---- Overlay palette — commander-console tokens + team colors -------------

export const OVERLAY_PALETTE = {
  team0: [85, 170, 255] as RGB, // friendly blue
  team1: [255, 90, 74] as RGB, //  hostile red
  objectiveExtract: [255, 195, 74] as RGB,
  objectiveDefend: [160, 220, 255] as RGB,
  objectiveSecure: [140, 255, 160] as RGB,
  heroLandmark: [255, 210, 120] as RGB,
  gridLine: [0, 0, 0, 40] as RGBA,
  frameBorder: [0, 0, 0, 220] as RGBA,
  legendChip: [0, 0, 0, 190] as RGBA,
  contour: [68, 56, 40, 95] as RGBA,
} as const;

// ---- Feature visibility thresholds per tier -------------------------------

export type FeatureVisibility = {
  readonly terrain: boolean;
  readonly points: boolean;
  readonly buildings: boolean;
  readonly dominantLines: boolean;
  readonly capillaries: boolean;
  readonly elevationContours: boolean;
  readonly deployZones: boolean;
  readonly objectiveGlyphs: boolean;
  readonly landmarkOutline: boolean;
  readonly grid: boolean;
  readonly legend: boolean;
  readonly frame: boolean;
  readonly labels: boolean;
  // Density-driven COA-1 scatter debugging — shows the coverDensity
  // field as a red heatmap and marks hotspots with white pips. Useful
  // when diagnosing "why did scatter land here" or "why is this biome
  // barren". Planning tier only (COA-1 #46).
  readonly densityHeatmap: boolean;
  // P3.6 — baked Sobel hill shading applied to every tile. Battle tier
  // always shows it; strategic/briefing/planning toggle based on tier
  // preference.
  readonly shadedRelief: boolean;
  // P3.7b — per-tile elevation-step contour strokes. Renderer shows
  // only at zoom-out; thumbnail always.
  readonly contours: boolean;
};

export const FEATURE_VISIBILITY: Record<PaletteTier, FeatureVisibility> = {
  battle: {
    terrain: true,
    points: true,
    buildings: true,
    dominantLines: false,
    capillaries: false,
    elevationContours: false,
    deployZones: false,
    objectiveGlyphs: false,
    landmarkOutline: false,
    grid: false,
    legend: false,
    frame: false,
    labels: false,
    densityHeatmap: false,
    shadedRelief: true,
    contours: false,
  },
  strategic: {
    terrain: true,
    points: false,
    buildings: true,
    dominantLines: true,
    capillaries: false,
    elevationContours: false,
    deployZones: true,
    objectiveGlyphs: true,
    landmarkOutline: false,
    grid: false,
    legend: false,
    frame: true,
    labels: false,
    densityHeatmap: false,
    shadedRelief: true,
    contours: true,
  },
  briefing: {
    terrain: true,
    points: true,
    buildings: true,
    dominantLines: true,
    capillaries: true,
    elevationContours: true,
    deployZones: true,
    objectiveGlyphs: true,
    landmarkOutline: true,
    grid: false,
    legend: true,
    frame: true,
    labels: true,
    densityHeatmap: false,
    shadedRelief: true,
    contours: true,
  },
  planning: {
    terrain: true,
    points: true,
    buildings: true,
    dominantLines: true,
    capillaries: true,
    elevationContours: true,
    deployZones: true,
    objectiveGlyphs: true,
    landmarkOutline: true,
    grid: true,
    legend: true,
    frame: true,
    labels: true,
    // Planning tier is dev/debug — enable the heatmap so map-gen
    // regressions are visible in the thumbnail (COA-1 #46).
    densityHeatmap: true,
    shadedRelief: true,
    contours: true,
  },
};
