// ADR 011 Pillar C — contract economics are a tradeoff sheet, not a success
// estimator. No P(success), no Monte Carlo, no authored win-rate field.
// difficultyRating is authored flavor only — pattern-matching, not
// computation. Addendum 2 §C locks the binary success semantic.
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

export const ContractPayout = z.object({
  cash: z.number().int().nonnegative(),
  salvagePriorityPicks: z.number().int().nonnegative().default(0),
  reputationDelta: z.number().int().default(0),
  secondaryBonusCash: z.number().int().nonnegative().default(0),
  goodFaithFraction: z.number().min(0).max(1).default(0),
});
export type ContractPayout = z.infer<typeof ContractPayout>;

export const RecommendedOperatorsBand = z.object({
  green: z.number().int().nonnegative(),
  regular: z.number().int().nonnegative(),
  veteran: z.number().int().nonnegative(),
});
export type RecommendedOperatorsBand = z.infer<typeof RecommendedOperatorsBand>;

export const ContractDeployCost = z.object({
  fixedPerContract: z.number().int().nonnegative(),
});
export type ContractDeployCost = z.infer<typeof ContractDeployCost>;

export const ContractModifiers = z
  .object({
    extractionSeats: z.number().int().positive().nullable(),
    requiredRoleTags: z.array(z.string().min(1)).default([]),
  })
  .default({ extractionSeats: null, requiredRoleTags: [] });
export type ContractModifiers = z.infer<typeof ContractModifiers>;

export const Contract = z
  .object({
    id: Id,
    name: z.string().min(1),
    mapId: Id,
    payout: ContractPayout,
    deployCost: ContractDeployCost,
    recommendedOperators: RecommendedOperatorsBand,
    difficultyRating: z.number().int().min(1).max(5),
    modifiers: ContractModifiers,
    briefing: z.string().min(1),
    objectives: z.array(ContractObjective).min(1),
    enemies: EnemyComposition,
    minOperators: z.number().int().min(0),
    maxOperators: z.number().int().positive().nullable(),
  })
  .refine((c) => c.maxOperators === null || c.maxOperators >= c.minOperators, {
    message: 'maxOperators must be null or >= minOperators',
    path: ['maxOperators'],
  });
export type Contract = z.infer<typeof Contract>;
