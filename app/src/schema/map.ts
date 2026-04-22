import { z } from 'zod';
import { Id } from './common';

export const TerrainKind = z.enum(['open', 'road', 'building', 'forest', 'water', 'rubble']);
export type TerrainKind = z.infer<typeof TerrainKind>;

export const BiomeId = z.enum([
  'urban_sparse',
  'rural_open',
  'mixed',
  // deferred: urban_dense, industrial, forest, arid, rural_village
]);
export type BiomeId = z.infer<typeof BiomeId>;

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

// A GameMap is either hand-authored (small fixture, `tiles[]` sparse list) or
// procedurally generated (seed + biome + version; tiles materialize at load).
// The width/height max raises 2048 → 4096 for Pillar A target scale.
export const GameMap = z.object({
  id: Id,
  name: z.string().min(1),
  width: z.number().int().positive().max(4096),
  height: z.number().int().positive().max(4096),
  tileSizeMeters: z.number().positive(),
  tiles: z
    .array(
      z.object({
        x: z.number().int(),
        y: z.number().int(),
        terrain: TerrainKind,
        groundHeight: z.number().default(0),
      }),
    )
    .default([]),
  playerSpawns: z.array(SpawnPoint).default([]),
  enemySpawns: z.array(SpawnPoint).default([]),
  waypointRoutes: z.array(WaypointRoute).default([]),
  generationSeed: z.string().optional(),
  generationVersion: z.number().int().nonnegative().optional(),
  biome: BiomeId.optional(),
});
export type GameMap = z.infer<typeof GameMap>;
