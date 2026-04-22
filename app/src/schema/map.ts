import { z } from 'zod';
import { Id } from './common';

// Map schema v2 — Firefight-derived terrain vocabulary (ADR 012).
//
// Tiles separate into four orthogonal layers:
//   - base surface         (exactly one per tile)
//   - point object         (0 or 1 per tile, stacked atop the base)
//   - linear barrier       (0..4 edges per tile, stored on N + W, redirected for S + E)
//   - buildingId           (0 = none, otherwise an index into GameMap.buildings)
//
// The legacy v1 enum ('open' | 'road' | 'building' | 'forest' | 'water' | 'rubble')
// is removed; authored fixtures mass-edited to v2 in the same commit.

// ---- Base surfaces -----------------------------------------------------------

export const TerrainBase = z.enum([
  'open',
  'road',
  'water_shallow',
  'water_deep',
  'mud',
  'rubble_ground',
  'snow',
  'sand',
]);
export type TerrainBase = z.infer<typeof TerrainBase>;

// ---- Linear barriers ---------------------------------------------------------
// Live on tile edges (edgeN + edgeW arrays, S/E redirect to the neighbor's N/W).
// Destructible barriers transition to `rubble_strip` kind at HP 0 when their
// props declare rubbleOnDestroy; wire / light fences disappear entirely.

export const LinearBarrierKind = z.enum([
  'hedge',
  'bocage',
  'stone_wall_low',
  'wood_fence',
  'bamboo_fence',
  'rail_fence',
  'berm',
  'wire_light',
  'wire_dense',
  'wire_razor',
  'rubble_strip',
]);
export type LinearBarrierKind = z.infer<typeof LinearBarrierKind>;

// ---- Point objects -----------------------------------------------------------
// Zero or one per tile. Tree families are encoded here (they are spatially
// single-tile point obstacles with a canopy height — not a separate layer).

export const PointObjectKind = z.enum([
  // Firefight's 21 object families:
  'barrel',
  'bush_small',
  'bush_medium',
  'bush_large',
  'car',
  'cart_empty',
  'cart_full',
  'dragons_teeth',
  'garden_shed',
  'grave',
  'gravestone',
  'haystack',
  'oil_drums',
  'rubble_pile',
  'signpost',
  'storage_tank',
  'tank_trap',
  'telegraph_pole',
  'trough',
  'tyres',
  'well',
  // Tree families (6 × variants):
  'tree_forest',
  'tree_fruit',
  'tree_jungle',
  'tree_oak',
  'tree_poplar',
  'tree_snow',
]);
export type PointObjectKind = z.infer<typeof PointObjectKind>;

// ---- Building families -------------------------------------------------------

export const BuildingFamily = z.enum([
  'church',
  'factory',
  'house_grey_slate',
  'house_red_tiles',
  'mud_hut',
  'oil_refinery',
  'shed',
  'tower',
  'villa',
  'windmill',
]);
export type BuildingFamily = z.infer<typeof BuildingFamily>;

// ---- Destructible state ------------------------------------------------------

export const DestructibleState = z.enum(['intact', 'damaged', 'destroyed']);
export type DestructibleState = z.infer<typeof DestructibleState>;

// ---- Edge + door/window overrides --------------------------------------------

export const EdgeSide = z.enum(['N', 'W', 'S', 'E']);
export type EdgeSide = z.infer<typeof EdgeSide>;

// An authored linear barrier on a specific edge. Variant is a biome-material
// skin index (0..7). Material skin overrides the base sprite so a stone wall
// can render brick in industrial, granite in rural, etc.
export const LinearBarrierEntry = z.object({
  kind: LinearBarrierKind,
  state: DestructibleState.default('intact'),
  variant: z.number().int().min(0).max(7).default(0),
});
export type LinearBarrierEntry = z.infer<typeof LinearBarrierEntry>;

// Door/window overrides sit on the same edge slot as linear barriers. At most
// one entry per edge — authored overrides take precedence; a doorway implies
// no fence/wall on that edge.
export const EdgeOverride = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('door_closed'), locked: z.boolean().default(false) }),
  z.object({ kind: z.literal('door_open') }),
  z.object({ kind: z.literal('window_intact') }),
  z.object({ kind: z.literal('window_broken') }),
]);
export type EdgeOverride = z.infer<typeof EdgeOverride>;

export const EdgeAuthored = z.union([LinearBarrierEntry, EdgeOverride]);
export type EdgeAuthored = z.infer<typeof EdgeAuthored>;

// ---- Building authoring ------------------------------------------------------

export const BuildingRecord = z.object({
  id: z.number().int().positive(),
  family: BuildingFamily,
  floors: z.number().int().min(1).max(8).default(1),
  footprint: z
    .array(z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() }))
    .min(1),
  wallHpInitial: z.number().positive().default(100),
  // Edges that are doors / windows. Door state at load time is honored; HP
  // resets per mission (non-persistent per ADR 012).
  doorEdges: z
    .array(
      z.object({
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        side: EdgeSide,
      }),
    )
    .default([]),
  windowEdges: z
    .array(
      z.object({
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        side: EdgeSide,
      }),
    )
    .default([]),
});
export type BuildingRecord = z.infer<typeof BuildingRecord>;

// ---- Point-object authoring --------------------------------------------------

export const PointObjectEntry = z.object({
  kind: PointObjectKind,
  state: DestructibleState.default('intact'),
  variant: z.number().int().min(0).max(15).default(0),
});
export type PointObjectEntry = z.infer<typeof PointObjectEntry>;

// ---- Tile --------------------------------------------------------------------

export const TileV2 = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  base: TerrainBase.default('open'),
  point: PointObjectEntry.optional(),
  // Linear barriers by edge. North + West are authoritative; South + East of
  // tile (x, y) redirect to (x, y+1).N and (x+1, y).W respectively via the
  // `getEdge` helper in sim/world.ts — never author both sides of a shared
  // edge. `doorN` / `doorW` slots hold EdgeOverride.
  edgeN: EdgeAuthored.optional(),
  edgeW: EdgeAuthored.optional(),
  buildingId: z.number().int().nonnegative().default(0),
  groundHeight: z.number().min(0).default(0), // meters; quantized to elevationStep on load (COA-8).
});
export type TileV2 = z.infer<typeof TileV2>;

// ---- Biomes ------------------------------------------------------------------

export const BiomeId = z.enum([
  'urban_sparse',
  'rural_open',
  'mixed',
  // Deferred-to-content biomes; declarations present so scatter parameter
  // tables can pre-stub them without a schema migration.
  'urban_dense',
  'industrial',
  'forest',
  'arid',
  'rural_village',
]);
export type BiomeId = z.infer<typeof BiomeId>;

// ---- Spawn / waypoint (unchanged) -------------------------------------------

export const SpawnPoint = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  facing: z
    .number()
    .min(0)
    .lt(Math.PI * 2),
});

export const WaypointRoute = z.object({
  role: z.enum(['rifleman', 'lmg', 'medic', 'lead']),
  behavior: z.enum(['advance', 'hold', 'retreat', 'flank']),
  points: z.array(z.object({ x: z.number(), y: z.number() })).min(1),
});

// ---- GameMap v2 --------------------------------------------------------------

export const GameMap = z.object({
  schemaVersion: z.literal(2).default(2),
  id: Id,
  name: z.string().min(1),
  width: z.number().int().positive().max(4096),
  height: z.number().int().positive().max(4096),
  tileSizeMeters: z.number().positive(),
  tiles: z.array(TileV2).default([]),
  buildings: z.array(BuildingRecord).default([]),
  playerSpawns: z.array(SpawnPoint).default([]),
  enemySpawns: z.array(SpawnPoint).default([]),
  waypointRoutes: z.array(WaypointRoute).default([]),
  generationSeed: z.string().optional(),
  generationVersion: z.number().int().nonnegative().optional(),
  biome: BiomeId.optional(),
});
export type GameMap = z.infer<typeof GameMap>;
