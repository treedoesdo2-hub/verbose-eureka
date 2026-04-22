import { z } from 'zod';
import { Id, SkillTier } from './common';

export const Stats = z.object({
  aim: z.number().int().min(0).max(100),
  move: z.number().int().min(0).max(100),
  grit: z.number().int().min(0).max(100),
  awareness: z.number().int().min(0).max(100),
  medical: z.number().int().min(0).max(100),
});
export type Stats = z.infer<typeof Stats>;

export const Operator = z.object({
  id: Id,
  name: z.string().min(1),
  callsign: z.string().min(1),
  tier: SkillTier,
  stats: Stats,
  defaultTemplateId: Id,
  origin: z.string().default(''),
  bio: z.string().default(''),
  cost: z.number().int().nonnegative(),
  // ADR 011 Pillar C — per-deployment economic weight. Wage and premium
  // stack with contract.deployCost.fixedPerContract to form the total
  // deploy cost paid before a contract starts.
  dailyWage: z.number().int().nonnegative(),
  insurancePremium: z.number().int().nonnegative(),
});
export type Operator = z.infer<typeof Operator>;
