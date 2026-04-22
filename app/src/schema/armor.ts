import { z } from 'zod';
import { BodyZone, Id } from './common';
import { HardpointNeed, InternalSlots, SlotFootprint } from './weapon';

export const PlateKind = z.enum(['soft', 'hard']);
export type PlateKind = z.infer<typeof PlateKind>;

export const ArmorPlacement = z.object({
  zone: BodyZone,
  damageReduction: z.number().min(0).max(100),
  weightKg: z.number().nonnegative(),
  plate: PlateKind.default('hard'),
});
export type ArmorPlacement = z.infer<typeof ArmorPlacement>;

export const Armor = z.object({
  id: Id,
  name: z.string().min(1),
  class: z.enum(['light', 'medium', 'heavy']),
  placements: z.array(ArmorPlacement).min(1),
  cost: z.number().int().nonnegative(),
  slotFootprint: SlotFootprint.default({}),
  hardpointNeeds: z.array(HardpointNeed).default([]),
  internalSlots: InternalSlots.default({}),
});
export type Armor = z.infer<typeof Armor>;
