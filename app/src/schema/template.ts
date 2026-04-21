import { z } from 'zod';
import { Id } from './common';

export const LoadoutTemplate = z.object({
  id: Id,
  name: z.string().min(1),
  role: z.enum(['rifleman', 'lmg', 'medic', 'lead', 'sidearm-only']).default('rifleman'),
  primaryWeaponId: z.union([Id, z.null()]).default(null),
  sidearmId: z.union([Id, z.null()]).default(null),
  armorId: z.union([Id, z.null()]).default(null),
  utilityIds: z.array(Id).default([]),
});
export type LoadoutTemplate = z.infer<typeof LoadoutTemplate>;
