import { z } from 'zod';
import { DamageType, HardpointType, Id } from './common';

export const Ballistics = z.object({
  caliberMm: z.number().positive(),
  velocityMps: z.number().positive(),
  massGrams: z.number().positive(),
  penetration: z.number().min(0).max(100),
});
export type Ballistics = z.infer<typeof Ballistics>;

export const Weapon = z.object({
  id: Id,
  name: z.string().min(1),
  hardpoint: HardpointType,
  damageType: DamageType,
  ballistics: Ballistics,
  baseAccuracy: z.number().min(0).max(100),
  rpm: z.number().positive(),
  magazineSize: z.number().int().positive(),
  reloadSeconds: z.number().nonnegative(),
  rangeMeters: z.number().positive(),
  weightKg: z.number().positive(),
  hands: z.union([z.literal(1), z.literal(2)]),
  cost: z.number().int().nonnegative(),
});
export type Weapon = z.infer<typeof Weapon>;
