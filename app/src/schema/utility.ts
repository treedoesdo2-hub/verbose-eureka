import { z } from 'zod';
import { Id } from './common';

export const Utility = z.object({
  id: Id,
  name: z.string().min(1),
  kind: z.enum(['grenade', 'smoke', 'medkit', 'tool']),
  critSlots: z.number().int().positive(),
  tonnage: z.number().nonnegative(),
  uses: z.number().int().positive(),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
  cost: z.number().int().nonnegative(),
});
export type Utility = z.infer<typeof Utility>;
