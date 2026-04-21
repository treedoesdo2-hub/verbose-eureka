import { z } from 'zod';
import { Id } from './common';

export const TerrainKind = z.enum(['open', 'road', 'building', 'forest', 'water', 'rubble']);
export type TerrainKind = z.infer<typeof TerrainKind>;

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

export const GameMap = z.object({
  id: Id,
  name: z.string().min(1),
  width: z.number().int().positive().max(2048),
  height: z.number().int().positive().max(2048),
  tileSizeMeters: z.number().positive(),
  tiles: z.array(
    z.object({
      x: z.number().int(),
      y: z.number().int(),
      terrain: TerrainKind,
      groundHeight: z.number().default(0),
    }),
  ),
  playerSpawns: z.array(SpawnPoint).min(1),
  enemySpawns: z.array(SpawnPoint).min(1),
  waypointRoutes: z.array(WaypointRoute).default([]),
});
export type GameMap = z.infer<typeof GameMap>;
