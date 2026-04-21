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
