// Hedge-network generator (#277).
//
// Bocage countryside: rural biomes are not "empty fields with scatter" —
// they're patchwork of small fields divided by hedgerow boundaries. The
// Firefight panel rural_open exemplars measure ~43% hedge_pct and ~25%
// open_pct: hedges dominate the visible tile-edge budget. This module
// stamps a perturbed-grid hedgerow network onto the map's edge buffers,
// turning tiles "into" field boundaries via the priority classifier.
//
// Layout: each biome supplies a target field-cell size in tiles; we walk
// the N edge of every cell-row and the W edge of every cell-column,
// stamping hedge bytes onto the corresponding tile edges. Per-cell
// jitter perturbs the line position by ±2 tiles so the network reads
// organic instead of parade-square. Random gaps (gates / breaks) puncture
// the lines so units can pass without carving.

import { BARRIER_KINDS } from '../world';
import { makeRng } from './noise';
import type { BiomeId } from '@schema/map';

// Hedge byte: low nibble = barrier-kind index. World.ts encodes barriers
// as kind | (state<<4); fresh hedge has state=0. BARRIER_KINDS lookup is
// 1-indexed per the encoding (0 = no barrier).
const HEDGE_KIND_IDX = BARRIER_KINDS.indexOf('hedge') + 1;
const HEDGE_BYTE = HEDGE_KIND_IDX & 0x0f;
const HEDGE_HP = 80;

// Field-cell size per biome. Tighter cells = more hedges = more
// hedge_pct. Tuned against Firefight panel targets:
//   rural_open: target hedge_pct ~43% → cells ~6 tiles
//   forest:     target hedge_pct ~35% → cells ~7 tiles
//   rural_village: target ~23% → cells ~10 tiles
//   mixed:      target ~varies → cells ~9 tiles
//   urban_sparse: target ~30% → cells ~8 tiles
//
// Biomes not listed get no network (hedges aren't a feature there).
const FIELD_CELL_TILES: Partial<Record<BiomeId, number>> = {
  rural_open: 4,
  rural_village: 10,
  forest: 7,
  mixed: 5,
  urban_sparse: 8,
};

// Probability per edge-tile that the hedge "breaks" (gate / track gap).
// 8% means ~12 unbroken tiles between gaps on average — long enough to
// read as a continuous boundary, short enough that units find passage.
const GAP_PROBABILITY = 0.08;

// Per-line jitter in tiles. Each axis-line (a single hedgerow) gets a
// ±JITTER offset, drawn once per line. Keeps fields rectangular but
// prevents the network from reading as a perfect grid.
const LINE_JITTER = 2;

export type HedgeNetworkInput = {
  readonly biome: BiomeId;
  readonly W: number;
  readonly H: number;
  readonly edgeN: Uint8Array;
  readonly edgeW: Uint8Array;
  readonly hpN: Uint16Array;
  readonly hpW: Uint16Array;
  // Tiles already occupied by buildings or trees should not have their
  // edges stamped — the hedge would cut through a wall or trunk. The
  // pipeline passes its current buildingId + point grids.
  readonly buildingId: Uint16Array;
  readonly point: Uint8Array;
  readonly seed: number;
};

export function stampHedgeNetwork(input: HedgeNetworkInput): void {
  const cell = FIELD_CELL_TILES[input.biome];
  if (cell === undefined || cell <= 0) return;
  const { W, H, edgeN, edgeW, hpN, hpW, buildingId, point, seed } = input;

  const rng = makeRng(seed ^ 0x4d36ed72);

  // ---- Horizontal lines (each stamps the N edge of a row of tiles).
  for (let y0 = cell; y0 < H; y0 += cell) {
    const jitter = Math.floor((rng() - 0.5) * 2 * LINE_JITTER);
    const y = Math.max(1, Math.min(H - 1, y0 + jitter));
    for (let x = 0; x < W; x++) {
      if (rng() < GAP_PROBABILITY) continue;
      const i = y * W + x;
      // Skip building footprints + tree tiles + tile north of either
      // (the hedge sits between this tile and y-1).
      if (buildingId[i] !== 0 || point[i] !== 0) continue;
      const ni = i - W;
      if (ni >= 0 && (buildingId[ni] !== 0 || point[ni] !== 0)) continue;
      // Don't overwrite an existing barrier (e.g. a dominantLine hedgerow).
      if ((edgeN[i] & 0x0f) !== 0) continue;
      edgeN[i] = HEDGE_BYTE;
      hpN[i] = HEDGE_HP;
    }
  }

  // ---- Vertical lines (each stamps the W edge of a column of tiles).
  for (let x0 = cell; x0 < W; x0 += cell) {
    const jitter = Math.floor((rng() - 0.5) * 2 * LINE_JITTER);
    const x = Math.max(1, Math.min(W - 1, x0 + jitter));
    for (let y = 0; y < H; y++) {
      if (rng() < GAP_PROBABILITY) continue;
      const i = y * W + x;
      if (buildingId[i] !== 0 || point[i] !== 0) continue;
      const wi = i - 1;
      if (wi >= 0 && (buildingId[wi] !== 0 || point[wi] !== 0)) continue;
      if ((edgeW[i] & 0x0f) !== 0) continue;
      edgeW[i] = HEDGE_BYTE;
      hpW[i] = HEDGE_HP;
    }
  }
}
