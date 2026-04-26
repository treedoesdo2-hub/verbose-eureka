import { z } from 'zod';
import { Caliber } from './ammo';
import {
  DamageType,
  HardpointNeed,
  HardpointType,
  Id,
  InternalSlots,
  SlotFootprint,
} from './common';

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
  // ADR 016 ammo task #281.03. Declares the weapon's caliber for ammo
  // compatibility checks. Optional during transition — existing content
  // can derive it from `ballistics.caliberMm` via `weaponCaliber()` until
  // every weapon is migrated.
  caliber: Caliber.optional(),
  baseAccuracy: z.number().min(0).max(100),
  rpm: z.number().positive(),
  magazineSize: z.number().int().positive(),
  reloadSeconds: z.number().nonnegative(),
  rangeMeters: z.number().positive(),
  weightKg: z.number().positive(),
  hands: z.union([z.literal(1), z.literal(2)]),
  cost: z.number().int().nonnegative(),
  slotFootprint: SlotFootprint.default({}),
  hardpointNeeds: z.array(HardpointNeed).default([]),
  internalSlots: InternalSlots.default({}),
});
export type Weapon = z.infer<typeof Weapon>;

/**
 * Returns the weapon's caliber — explicit if declared, derived from
 * `ballistics.caliberMm` otherwise. Existing weapon content authored
 * before ammo as inventory item lands often lacks the explicit `caliber`
 * field; this bridge keeps loadout / ammo-compatibility logic working
 * across the migration.
 */
export function weaponCaliber(w: Weapon): Caliber | null {
  if (w.caliber) return w.caliber;
  switch (w.ballistics.caliberMm) {
    case 4.6:
      return '4.6';
    case 5.45:
      return '5.45';
    case 5.56:
      return '5.56';
    case 6.5:
      return '6.5';
    case 7.62:
      return '7.62';
    case 9:
      return '9mm';
    case 11.43:
      return '.45';
    case 18.5:
      return '12ga';
    case 12.7:
      return '.50';
    default:
      return null;
  }
}
