// Road-network generator (#277).
//
// Replaces the random-rng "road tile here, road tile there" noise in
// base-paint with a deliberate connected network. Two regimes:
//
// 1. Urban regime (urban_dense, urban_sparse, industrial): stamp a
//    perpendicular street grid. Each map gets ~3-5 horizontal + 3-5
//    vertical roads spanning edge-to-edge. Produces:
//      - largest_road_component_fraction → ≥0.5 (network is unified)
//      - road_reaches_edge → true (every line touches both edges)
//      - road_pct → ~5-12% depending on grid spacing
//
// 2. Rural regime (rural_open, rural_village, forest, mixed): stamp ONE
//    march road that crosses the map edge-to-edge with an fBm S-curve.
//    Avoids the chicken-pox scatter the user complained about; rural
//    Firefight panels show 1-2 visible roads, not networks.
//
// Stamps onto base buffer with `road` byte. Skips tiles where buildings
// already exist (the road threads around them naturally).

import type { BiomeId } from '@schema/map';
import { baseToByte, byteToBase } from '../world';
import { fbm2D, makeRng } from './noise';

const ROAD_BYTE = baseToByte('road');

type Regime = 'urban' | 'rural' | 'none';

const REGIME_BY_BIOME: Record<BiomeId, Regime> = {
  urban_dense: 'urban',
  urban_sparse: 'urban',
  industrial: 'urban',
  rural_village: 'rural',
  rural_open: 'rural',
  forest: 'rural',
  mixed: 'rural',
  arid: 'rural',
};

// Grid spacing in tiles (urban regime). Targets:
//   urban_dense: ~25-tile blocks → 10 lines on 256² → ~12% road_pct
//   urban_sparse: ~50-tile blocks → 5 lines → ~3.5% road_pct
//   industrial: ~35-tile blocks → 7 lines → ~7% road_pct
const URBAN_GRID_SPACING: Record<'urban_dense' | 'urban_sparse' | 'industrial', number> = {
  urban_dense: 25,
  urban_sparse: 60,
  industrial: 35,
};

export type RoadNetworkInput = {
  readonly biome: BiomeId;
  readonly W: number;
  readonly H: number;
  readonly base: Uint8Array;
  readonly buildingId: Uint16Array;
  readonly seed: number;
};

export function stampRoadNetwork(input: RoadNetworkInput): void {
  const regime = REGIME_BY_BIOME[input.biome];
  if (regime === 'urban') stampUrbanGrid(input);
  else if (regime === 'rural') stampMarchRoad(input);
}

function stampUrbanGrid(input: RoadNetworkInput): void {
  const { biome, W, H, base, buildingId, seed } = input;
  const spacing = URBAN_GRID_SPACING[biome as 'urban_dense' | 'urban_sparse' | 'industrial'];
  const rng = makeRng(seed ^ 0x4ab19);

  // Horizontal streets (each spans x=0..W-1 at a y-row).
  for (let y0 = spacing; y0 < H; y0 += spacing) {
    const jitter = Math.floor((rng() - 0.5) * 6);
    const y = clamp(y0 + jitter, 1, H - 2);
    stampStraightRoad(base, buildingId, W, H, 0, y, W - 1, y, seed ^ y);
  }
  // Vertical streets.
  for (let x0 = spacing; x0 < W; x0 += spacing) {
    const jitter = Math.floor((rng() - 0.5) * 6);
    const x = clamp(x0 + jitter, 1, W - 2);
    stampStraightRoad(base, buildingId, W, H, x, 0, x, H - 1, seed ^ (x << 8));
  }
}

function stampMarchRoad(input: RoadNetworkInput): void {
  const { W, H, base, buildingId, seed } = input;
  const rng = makeRng(seed ^ 0x4109d12);
  // Pick an axis + entry / exit edges. Roughly half horizontal, half
  // vertical. Entry y (or x) is drawn from the middle 60% of the cross
  // axis so the road doesn't graze the deploy zones.
  const horizontal = rng() < 0.5;
  if (horizontal) {
    const yEntry = Math.floor(H * (0.2 + rng() * 0.6));
    const yExit = Math.floor(H * (0.2 + rng() * 0.6));
    stampStraightRoad(base, buildingId, W, H, 0, yEntry, W - 1, yExit, seed ^ 0xa5);
  } else {
    const xEntry = Math.floor(W * (0.2 + rng() * 0.6));
    const xExit = Math.floor(W * (0.2 + rng() * 0.6));
    stampStraightRoad(base, buildingId, W, H, xEntry, 0, xExit, H - 1, seed ^ 0xa6);
  }
}

// Stamp a width-2 road from (x0,y0) to (x1,y1) with fBm S-curve
// displacement. Skips tiles already occupied by a building footprint
// (the road threads around them).
function stampStraightRoad(
  base: Uint8Array,
  buildingId: Uint16Array,
  W: number,
  H: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fbmSeed: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)));
  const length = Math.hypot(dx, dy) || 1;
  const perpX = -dy / length;
  const perpY = dx / length;
  const amp = Math.min(W, H) * 0.06;
  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    const offset = (fbm2D(t * 100, 0, 0.05, 3, fbmSeed, 100) - 0.5) * amp;
    const cx = Math.round(x0 + dx * t + perpX * offset);
    const cy = Math.round(y0 + dy * t + perpY * offset);
    // Width-2 footprint: center tile + one perpendicular neighbor. Choose
    // perpendicular side based on sign of perpX/perpY so the road has a
    // consistent thickness.
    for (let w = 0; w <= 1; w += 1) {
      const x = clamp(cx + Math.round(perpX * w), 0, W - 1);
      const y = clamp(cy + Math.round(perpY * w), 0, H - 1);
      const i = y * W + x;
      // Don't ford water — bridges / culverts aren't a generator feature
      // yet. But DO bulldoze buildings: the road runs first conceptually,
      // and an ambient building cluster shouldn't fragment the network.
      // (Real cities have buildings around roads, not on top of them.)
      const kind = byteToBase(base[i]);
      if (kind === 'water_shallow' || kind === 'water_deep') continue;
      buildingId[i] = 0;
      base[i] = ROAD_BYTE;
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
