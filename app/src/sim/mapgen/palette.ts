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

const TERRAIN_PALETTE_BATTLE: RGB[] = [
  [178, 164, 134], // 0 open — tan
  [150, 130, 94], //  1 road — dirt brown
  [53, 80, 102], //   2 water_shallow
  [20, 30, 46], //    3 water_deep
  [75, 58, 42], //    4 mud
  [102, 92, 78], //   5 rubble_ground
  [214, 221, 224], // 6 snow
  [208, 183, 132], // 7 sand
];

const TERRAIN_PALETTE_MINIMAP: RGB[] = [
  [200, 188, 148], // 0 open — lifted slightly
  [160, 138, 96], //  1 road
  [80, 110, 130], //  2 water_shallow
  [50, 75, 100], //   3 water_deep — lifted for visibility on thumbnails
  [90, 75, 55], //    4 mud
  [120, 110, 96], //  5 rubble_ground
  [230, 236, 240], // 6 snow
  [220, 198, 148], // 7 sand
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
  },
};
