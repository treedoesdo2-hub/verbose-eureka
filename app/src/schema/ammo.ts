// ADR 016 §Q11 reference + DEFERRED.md (scheduled for armory rewrite).
// `Ammo` is an inventory item with a caliber, mag size, and crit footprint.
// A `Weapon` declares its `caliber`; only matching-caliber Ammo can feed it.
//
// MVP scope (2026-04-25):
// - Schema + canonical content authored.
// - Stockpile + armory display: ammo / mags appear in the Utility filter.
// - Sim-side magazine-stack refactor (#281.05–#281.08) lands separately.
//   Until that ships, `Unit.ammo` continues to behave as a scalar
//   initialized from `weapon.magazineSize`, and `Ammo` items are loadout
//   data only — a check that the operator carries enough mags is
//   surfaced via `ammo_missing` validation, but consumption is not yet
//   wired.

import { z } from 'zod';
import { HardpointNeed, Id, InternalSlots, SlotFootprint } from './common';

// ── Caliber enum ─────────────────────────────────────────────────────────
// Values match the existing weapon content's `ballistics.caliberMm`.
// Authored as an enum (rather than id-ref) per ADR 016 ammo task #281.02 —
// simpler for MVP; switch to id-ref if extensibility demands it later.

export const Caliber = z.enum([
  '4.6',   // PDW (e.g. MP7)
  '5.45',  // light assault (RPK-16, AK-74 family)
  '5.56',  // standard assault (HK-416, MK-18, M4)
  '6.5',   // DMR (MCX SPR, .260 Rem family)
  '7.62',  // battle rifle (SCAR-H, AK-47, M14)
  '9mm',   // sidearm (M17, Glock 17, MP5)
  '.45',   // sidearm (1911, USP)
  '12ga',  // shotgun (M870, Saiga)
  '.50',   // anti-materiel (M82, M107)
]);
export type Caliber = z.infer<typeof Caliber>;

// ── Ammo entity ──────────────────────────────────────────────────────────

export const Ammo = z.object({
  id: Id,
  name: z.string().min(1),
  caliber: Caliber,
  // Number of rounds per magazine of this ammo type. A loaded mag of this
  // ammo provides this many rounds before the unit is reloading again.
  roundsPerMag: z.number().int().positive(),
  weightKg: z.number().nonnegative(),
  cost: z.number().int().nonnegative().default(0),
  // Mag occupies crit slots like any other item — typically 1 slot in a
  // pouch or rig. `slotFootprint` left empty defers to the loadout layer's
  // bin-hosting (consumable category 'mag_rifle' / 'mag_pistol').
  slotFootprint: SlotFootprint.default({}),
  hardpointNeeds: z.array(HardpointNeed).default([]),
  internalSlots: InternalSlots.default({}),
  // Optional damage / penetration modifiers vs the weapon's base ballistics.
  // `damageBonus` adds to the weapon's wound severity; `penetrationBonus`
  // adds to the weapon's `ballistics.penetration` for armor checks.
  // Authored content typically leaves these at 0 for standard ball; AP /
  // tracer / HP rounds can refit later.
  damageBonus: z.number().default(0),
  penetrationBonus: z.number().default(0),
});
export type Ammo = z.infer<typeof Ammo>;
