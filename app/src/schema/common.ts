import { z } from 'zod';

export const BodyZone = z.enum([
  'head',
  'torso_front',
  'torso_back',
  'pelvis',
  'left_arm',
  'right_arm',
  'left_leg',
  'right_leg',
]);
export type BodyZone = z.infer<typeof BodyZone>;

export const ALL_BODY_ZONES: readonly BodyZone[] = [
  'head',
  'torso_front',
  'torso_back',
  'pelvis',
  'left_arm',
  'right_arm',
  'left_leg',
  'right_leg',
];

export const SkillTier = z.enum(['green', 'regular', 'veteran']);
export type SkillTier = z.infer<typeof SkillTier>;

export const HardpointType = z.enum(['primary', 'secondary', 'sidearm', 'utility', 'melee']);
export type HardpointType = z.infer<typeof HardpointType>;

export const DamageType = z.enum(['ballistic', 'explosive', 'kinetic', 'cut', 'burn']);
export type DamageType = z.infer<typeof DamageType>;

export const Id = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9_-]*$/);
