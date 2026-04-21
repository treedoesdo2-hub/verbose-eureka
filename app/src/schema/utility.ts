import { z } from 'zod';
import { BodyZone, Id } from './common';

export const UtilityKind = z.enum(['grenade', 'smoke', 'medkit', 'tool']);
export type UtilityKind = z.infer<typeof UtilityKind>;

export const MountKind = z.enum(['consumable', 'large']);
export type MountKind = z.infer<typeof MountKind>;

export const Utility = z.object({
  id: Id,
  name: z.string().min(1),
  kind: UtilityKind,
  mount: MountKind.default('consumable'),
  allowedZones: z.array(BodyZone).min(1),
  weightKg: z.number().positive(),
  uses: z.number().int().positive(),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
  cost: z.number().int().nonnegative(),
});
export type Utility = z.infer<typeof Utility>;
