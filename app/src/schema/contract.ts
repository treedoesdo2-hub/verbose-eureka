// ADR 011 Pillar C — contract economics are a tradeoff sheet, not a success
// estimator. No P(success), no Monte Carlo, no authored win-rate field.
// difficultyRating is authored flavor only — pattern-matching, not
// computation. Addendum 2 §C locks the binary success semantic.
import { z } from 'zod';
import { Id } from './common';
import { BiomeId } from './map';

// Corpo enforcers run objectives, not assassinations. eliminate is banned
// at the schema level — every contract must be a zone-anchored task
// (extract/defend/secure). Enemies in the zone are an obstacle to the
// objective, not the objective itself.
export const ObjectiveKind = z.enum(['extract', 'defend', 'secure']);
export type ObjectiveKind = z.infer<typeof ObjectiveKind>;

export const ObjectiveZone = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});
export type ObjectiveZone = z.infer<typeof ObjectiveZone>;

export const ObjectiveParams = z
  .object({
    zone: ObjectiveZone.optional(),
    minUnitsInside: z.number().int().positive().optional(),
    holdTicks: z.number().int().positive().optional(),
  })
  .optional();
export type ObjectiveParams = z.infer<typeof ObjectiveParams>;

export const ContractObjective = z.object({
  id: z.string().min(1),
  kind: ObjectiveKind,
  description: z.string().min(1),
  params: ObjectiveParams,
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
    // Pillar A: contract metadata drives map generation. nullable means
    // "use default binder heuristic".
    biomeHint: BiomeId.nullable().default(null),
    sizeHint: z.enum(['small', 'medium', 'large']).default('medium'),
  })
  .default({
    extractionSeats: null,
    requiredRoleTags: [],
    biomeHint: null,
    sizeHint: 'medium',
  });
export type ContractModifiers = z.infer<typeof ContractModifiers>;

// Map contract sizeHint to concrete tile dimensions for the generator.
// Kept conservative for MVP (schema allows up to 4096, but render perf
// is validated at 512).
export const CONTRACT_SIZE_TILES: Record<'small' | 'medium' | 'large', number> = {
  small: 128,
  medium: 256,
  large: 512,
};

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
