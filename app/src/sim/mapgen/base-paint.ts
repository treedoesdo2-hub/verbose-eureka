// P5.1 — extracted per-biome base-surface paint functions.
//
// The pipeline calls paintForBiome(biomeId)(elev, fert, rng01) once per
// tile. Each paint function reads the (elevation, fertility, random)
// tuple and returns a TerrainBase. The goal is visual variety: 3+
// distinct base kinds per biome so the map reads as more than "flat
// open". Firefight palette values are applied downstream in the renderer
// (palette.ts), so these paints just pick kinds, not colors.

import type { BiomeId, TerrainBase } from '@schema/map';

export type BasePaintFn = (elev: number, fert: number, rng01: number) => TerrainBase;

// Rural open (P5.2). Bocage countryside — fields, hedgerows (point-
// object layer), occasional creeks/mud patches. Elevation drives water
// pooling in low spots, fertility picks between open field and mud
// around them.
const rural_open: BasePaintFn = (elev, fert, rng01) => {
  if (elev < 0.12) return 'water_shallow';
  if (elev < 0.18 && fert < 0.35) return 'mud';
  if (fert < 0.25 && rng01 < 0.4) return 'mud';
  return 'open';
};

// Rural village (P5.3). Open country with scattered village clusters.
// Introduces road strips, mud around habitations, and occasional water.
const rural_village: BasePaintFn = (elev, fert, rng01) => {
  if (elev < 0.12) return 'water_shallow';
  if (elev < 0.18 && fert < 0.4) return 'mud';
  if (fert > 0.8 && rng01 < 0.08) return 'road'; // village path moments
  if (fert < 0.3 && rng01 < 0.25) return 'mud';
  return 'open';
};

// Mixed (P5.4). Everything everywhere moderately. Default fallback.
const mixed: BasePaintFn = (elev, fert, rng01) => {
  if (elev < 0.15) return 'water_shallow';
  if (elev < 0.22 && fert < 0.35) return 'mud';
  if (elev > 0.8 && rng01 < 0.15) return 'rubble_ground'; // rocky crests
  if (fert < 0.28 && rng01 < 0.2) return 'mud';
  if (rng01 < 0.04) return 'road'; // scattered paths
  return 'open';
};

// Urban sparse (P5.5). Open with some road grid hints. Bumped
// mud/road probabilities so 3-kind variety is reliable across seeds.
const urban_sparse: BasePaintFn = (elev, fert, rng01) => {
  if (elev < 0.2) return 'water_shallow';
  if (fert < 0.35 && rng01 < 0.3) return 'mud';
  if (rng01 < 0.15) return 'road';
  return 'open';
};

// Urban dense (P5.6). City center — lots of road, rubble around
// structures, minimal open.
const urban_dense: BasePaintFn = (elev, fert, rng01) => {
  if (elev < 0.12) return 'water_shallow';
  if (rng01 < 0.22) return 'road';
  if (fert < 0.3 && rng01 < 0.4) return 'rubble_ground';
  return 'open';
};

// Industrial (P5.7). Concrete lots, rubble, fuel-slick muds.
const industrial: BasePaintFn = (elev, fert, rng01) => {
  if (elev < 0.12) return 'water_shallow';
  if (rng01 < 0.25) return 'road';
  if (rng01 < 0.4) return 'rubble_ground';
  if (fert < 0.3 && rng01 < 0.55) return 'mud';
  return 'open';
};

// Forest (P5.8). Wooded base — but the trees themselves are point
// objects layered by scatter. Base diversifies via mud clearings and
// stream cuts.
const forest: BasePaintFn = (elev, fert, _rng01) => {
  if (elev < 0.15) return 'water_shallow';
  if (elev < 0.2 && fert > 0.6) return 'mud';
  return 'open';
};

// Arid (P5.9). Sand-dominated with rocky ridge tops and occasional
// oasis mud. Scatter gates on 'open', so some sand gets replaced with
// scrub-open to host tumbleweeds / debris. Keeps visual dominance of
// sand while keeping point scatter viable.
const arid: BasePaintFn = (elev, fert, rng01) => {
  if (elev < 0.1 && fert > 0.6) return 'mud'; // oasis
  if (elev > 0.85 && rng01 < 0.3) return 'rubble_ground';
  if (fert > 0.55) return 'open'; // scrub patches — scatter-eligible
  return 'sand';
};

const BIOME_PAINTS: Record<BiomeId, BasePaintFn> = {
  urban_sparse,
  urban_dense,
  rural_open,
  rural_village,
  mixed,
  industrial,
  forest,
  arid,
};

export function paintForBiome(biome: BiomeId): BasePaintFn {
  return BIOME_PAINTS[biome] ?? mixed;
}
