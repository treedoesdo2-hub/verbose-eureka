import { z } from 'zod';
import { Id, SkillTier } from './common';

export const FactionMember = z.object({
  archetype: z.string().min(1),
  tier: SkillTier,
  loadoutTemplateId: Id,
});
export type FactionMember = z.infer<typeof FactionMember>;

export const Faction = z.object({
  id: Id,
  name: z.string().min(1),
  roster: z.array(FactionMember).min(1),
});
export type Faction = z.infer<typeof Faction>;
