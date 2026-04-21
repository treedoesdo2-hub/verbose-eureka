import { z } from 'zod';
import { BodyZone, Id } from './common';

export const ArmorPlacement = z.object({
  zone: BodyZone,
  damageReduction: z.number().min(0).max(100),
  tonnage: z.number().nonnegative(),
});
export type ArmorPlacement = z.infer<typeof ArmorPlacement>;

export const Armor = z.object({
  id: Id,
  name: z.string().min(1),
  class: z.enum(['light', 'medium', 'heavy']),
  placements: z.array(ArmorPlacement).min(1),
  mobilityPenalty: z.number().min(0).max(100),
  cost: z.number().int().nonnegative(),
});
export type Armor = z.infer<typeof Armor>;
