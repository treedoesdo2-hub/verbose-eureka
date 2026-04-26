import { z } from 'zod';
import { BodyZone, HardpointNeed, Id, InternalSlots, SlotFootprint } from './common';

export const PlateKind = z.enum(['soft', 'hard']);
export type PlateKind = z.infer<typeof PlateKind>;

export const ArmorPlacement = z.object({
  zone: BodyZone,
  damageReduction: z.number().min(0).max(100),
  weightKg: z.number().nonnegative(),
  plate: PlateKind.default('hard'),
  // ADR 016 §Q10. Four resistance metrics shown per zone in the armory
  // inspector. `damageReduction` renders as DMG RES. PEN RES feeds an
  // eventual armor-penetration formula; FIRE / EMP feed eventual
  // damage-type expansion. All three default to 0 and stay inert in sim
  // until those workstreams pick them up — see DEFERRED.md.
  penetrationResistance: z.number().min(0).max(100).default(0),
  fireResistance: z.number().min(0).max(100).default(0),
  empResistance: z.number().min(0).max(100).default(0),
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
