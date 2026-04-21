import { z } from 'zod';
import { Id } from './common';

export const ObjectiveKind = z.enum(['eliminate', 'extract', 'defend', 'secure']);
export type ObjectiveKind = z.infer<typeof ObjectiveKind>;

export const ContractObjective = z.object({
  kind: ObjectiveKind,
  description: z.string().min(1),
});

export const EnemyComposition = z.object({
  factionId: Id,
  archetypes: z
    .array(
      z.object({
        archetype: z.string().min(1),
        count: z.number().int().positive(),
      }),
    )
    .min(1),
});

export const Contract = z.object({
  id: Id,
  name: z.string().min(1),
  mapId: Id,
  payout: z.number().int().positive(),
  briefing: z.string().min(1),
  objectives: z.array(ContractObjective).min(1),
  enemies: EnemyComposition,
  minOperators: z.number().int().positive(),
  maxOperators: z.number().int().positive(),
});
export type Contract = z.infer<typeof Contract>;
