// COA-4 task #67 — dominant-line types and route picker.
//
// A dominant line is the map-scale feature that gives the battlefield
// its unmistakable spatial identity: a paved road bisecting a village,
// a river winding through a valley, a rail line with an industrial
// siding, a hedgerow spine carving farm plots. Each generated map has
// exactly one dominant line and 0-3 capillary branches.
//
// This file defines the types + biome×kind weight table + the picker.
// Route-generating algorithms live in route-line.ts.

import type { BiomeId } from '@schema/map';
import type { Rng } from './noise';

export type LineKind =
  | 'road-straight'
  | 'road-star'
  | 'rail'
  | 'river'
  | 'canal'
  | 'ridge'
  | 'highstreet'
  | 'hedgerow-spine';

export type DominantLine = {
  readonly kind: LineKind;
  // Ordered waypoint list in tile coordinates. At least 2 entries; stampLine
  // walks between consecutive pairs via Bresenham / curve interpolation.
  readonly waypoints: readonly { x: number; y: number }[];
  readonly width: number; // authored base-tile width
  // Per-line metadata for stampLine + downstream renderers.
  readonly metadata?: LineMetadata;
};

export type LineMetadata = {
  readonly crossings?: readonly { x: number; y: number }[];
  readonly stations?: readonly { x: number; y: number }[]; // for rail only
  readonly locks?: readonly { x: number; y: number }[]; // for canal only
  readonly villageCenter?: { x: number; y: number }; // for highstreet
};

export type DominantCapillary = {
  readonly parent: DominantLine;
  readonly waypoints: readonly { x: number; y: number }[];
  readonly width: number;
};

// Biome × line-kind weights. Sum doesn't need to equal 1 — pickLineKind
// normalizes. A 0 weight means the combo is illegal (rails don't belong
// in rural_open, canals don't belong in urban_sparse).
const BIOME_LINE_WEIGHTS: Record<BiomeId, Partial<Record<LineKind, number>>> = {
  urban_sparse: {
    'road-straight': 5,
    'road-star': 3,
    rail: 2,
    river: 1,
    canal: 0.5,
    highstreet: 4,
    'hedgerow-spine': 0,
    ridge: 0.5,
  },
  rural_open: {
    'road-straight': 2,
    'road-star': 0.5,
    rail: 0.5,
    river: 4,
    canal: 0.5,
    highstreet: 0.5,
    'hedgerow-spine': 5,
    ridge: 3,
  },
  mixed: {
    'road-straight': 4,
    'road-star': 2,
    rail: 1.5,
    river: 3,
    canal: 1,
    highstreet: 2,
    'hedgerow-spine': 3,
    ridge: 2,
  },
  // Biomes deferred in COA-2 scoping — empty weights keep the picker safe.
  urban_dense: { 'road-straight': 5, 'road-star': 4, highstreet: 5, rail: 3 },
  industrial: { rail: 6, 'road-straight': 4, canal: 3 },
  forest: { river: 4, 'hedgerow-spine': 3, ridge: 3 },
  arid: { 'road-straight': 3, ridge: 4, river: 0.5 },
  rural_village: { highstreet: 5, 'road-straight': 3, 'hedgerow-spine': 3 },
};

export function pickLineKind(biome: BiomeId, rng: Rng): LineKind {
  const weights = BIOME_LINE_WEIGHTS[biome] ?? BIOME_LINE_WEIGHTS.mixed;
  const entries = Object.entries(weights) as [LineKind, number][];
  let total = 0;
  for (const [, w] of entries) total += w;
  if (total <= 0) return 'road-straight';
  const roll = rng() * total;
  let acc = 0;
  for (const [kind, w] of entries) {
    acc += w;
    if (roll < acc) return kind;
  }
  return entries[entries.length - 1][0];
}
