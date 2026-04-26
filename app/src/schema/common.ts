import { z } from 'zod';

export const BodyZone = z.enum([
  'head',
  'torso_front',
  'torso_back',
  'left_arm',
  'right_arm',
  'left_hand',
  'right_hand',
  'waist',
  'left_leg',
  'right_leg',
  'back_mount',
]);
export type BodyZone = z.infer<typeof BodyZone>;

export const ALL_BODY_ZONES: readonly BodyZone[] = [
  'head',
  'torso_front',
  'torso_back',
  'left_arm',
  'right_arm',
  'left_hand',
  'right_hand',
  'waist',
  'left_leg',
  'right_leg',
  'back_mount',
];

export const BODY_ZONES_WOUND: readonly BodyZone[] = [
  'head',
  'torso_front',
  'torso_back',
  'left_arm',
  'right_arm',
  'left_leg',
  'right_leg',
];

export const ZONE_CAPACITY_KG: Record<BodyZone, number> = {
  head: 2,
  torso_front: 8,
  torso_back: 8,
  left_arm: 2,
  right_arm: 2,
  left_hand: 5,
  right_hand: 5,
  waist: 4,
  left_leg: 3,
  right_leg: 3,
  back_mount: 15,
};

// ADR 011 Pillar D — MWO MechLab: each zone has a crit-slot capacity and a
// hardpoint topology. Items declare a slot footprint (multi-zone allowed) and
// hardpoint needs; host items provide internal slots scoped by consumable
// category so bins (mags, ifaks) can be packed inside a rig.
export const SlotHardpointKind = z.enum([
  'plate_mount',
  'grip',
  'pouch_mount',
  'comms_mount',
  'optic_mount',
  'holster_mount',
  'pack_anchor',
  'large_mount',
  'sleeve_mount',
]);
export type SlotHardpointKind = z.infer<typeof SlotHardpointKind>;

export const ConsumableCategory = z.enum([
  'mag_rifle',
  'mag_pistol',
  'mag_ordnance',
  'grenade_loop',
  'ifak',
  'tool',
]);
export type ConsumableCategory = z.infer<typeof ConsumableCategory>;

// Partial records — sparse shapes are the norm (a rifle only fills right_hand).
// Lifted from weapon.ts so weapon/armor/ammo can all reference these without a
// cycle through the per-entity modules. ADR 016 ammo task #281.05.
export const SlotFootprint = z.partialRecord(BodyZone, z.number().int().positive());
export type SlotFootprint = z.infer<typeof SlotFootprint>;

export const HardpointNeed = z.object({ zone: BodyZone, kind: SlotHardpointKind });
export type HardpointNeed = z.infer<typeof HardpointNeed>;

export const InternalSlots = z.partialRecord(ConsumableCategory, z.number().int().nonnegative());
export type InternalSlots = z.infer<typeof InternalSlots>;

export const ZONE_SLOT_CAPACITY: Record<BodyZone, number> = {
  head: 6,
  torso_front: 10,
  torso_back: 10,
  left_arm: 8,
  right_arm: 8,
  left_hand: 2,
  right_hand: 2,
  waist: 6,
  left_leg: 6,
  right_leg: 6,
  back_mount: 8,
};

export type BodyHardpoint = { kind: SlotHardpointKind; count: number };

export const DEFAULT_BODY_HARDPOINTS: Record<BodyZone, readonly BodyHardpoint[]> = {
  head: [
    { kind: 'comms_mount', count: 1 },
    { kind: 'optic_mount', count: 1 },
  ],
  torso_front: [
    { kind: 'plate_mount', count: 1 },
    { kind: 'pouch_mount', count: 4 },
  ],
  torso_back: [
    { kind: 'plate_mount', count: 1 },
    { kind: 'pack_anchor', count: 1 },
  ],
  left_hand: [{ kind: 'grip', count: 1 }],
  right_hand: [{ kind: 'grip', count: 1 }],
  left_arm: [{ kind: 'sleeve_mount', count: 1 }],
  right_arm: [{ kind: 'sleeve_mount', count: 1 }],
  waist: [
    { kind: 'holster_mount', count: 2 },
    { kind: 'pouch_mount', count: 2 },
  ],
  left_leg: [{ kind: 'holster_mount', count: 1 }],
  right_leg: [{ kind: 'holster_mount', count: 1 }],
  back_mount: [{ kind: 'large_mount', count: 1 }],
};

export const CONSUMABLE_HARDPOINT_FALLBACK: Record<ConsumableCategory, SlotHardpointKind> = {
  mag_rifle: 'pouch_mount',
  mag_pistol: 'pouch_mount',
  mag_ordnance: 'pouch_mount',
  grenade_loop: 'pouch_mount',
  ifak: 'pouch_mount',
  tool: 'pouch_mount',
};

export const SkillTier = z.enum(['green', 'regular', 'veteran']);
export type SkillTier = z.infer<typeof SkillTier>;

export const HardpointType = z.enum(['primary', 'sidearm', 'melee']);
export type HardpointType = z.infer<typeof HardpointType>;

export const DamageType = z.enum(['ballistic', 'explosive', 'kinetic', 'cut', 'burn']);
export type DamageType = z.infer<typeof DamageType>;

export const Id = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9_-]*$/);
