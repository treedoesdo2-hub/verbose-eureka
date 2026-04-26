import { z } from 'zod';
import { BodyZone, Id } from './common';

export const LoadoutItemType = z.enum(['weapon', 'armor', 'utility', 'ammo']);
export type LoadoutItemType = z.infer<typeof LoadoutItemType>;

// ADR 016 §S7 ORBAT — branch / readiness / company / battalion vocabulary.
// Matches APP-6 land-component branches at the level of granularity that
// drives screen filtering and plaque colour. Not exhaustive — vehicle /
// air branches are deferred until vehicles enter the schema.
export const Branch = z.enum([
  'infantry',
  'mechanized',
  'recon',
  'support',
  'medical',
  'engineering',
  'command',
]);
export type Branch = z.infer<typeof Branch>;

export const ReadinessTier = z.enum(['ready', 'refit', 'depleted', 'out']);
export type ReadinessTier = z.infer<typeof ReadinessTier>;

export const LoadoutItemSchema = z.object({
  type: LoadoutItemType,
  id: Id,
  zone: BodyZone,
});
export type LoadoutItemSchemaT = z.infer<typeof LoadoutItemSchema>;

export const LoadoutSchema = z.object({
  items: z.array(LoadoutItemSchema).default([]),
});
export type LoadoutSchemaT = z.infer<typeof LoadoutSchema>;

export const SquadMember = z.object({
  operatorId: Id,
  loadout: LoadoutSchema,
  templateId: Id.optional(),
});
export type SquadMember = z.infer<typeof SquadMember>;

export const Squad = z.object({
  id: Id,
  name: z.string().min(1).max(24),
  members: z.array(SquadMember).default([]),
  // ADR 016 §S7. Branch drives ORBAT plaque tone + filter chips. Older
  // squads default to infantry to keep migration cost zero.
  branch: Branch.default('infantry'),
  // TO&E target headcount. ORBAT readiness bar is members.length /
  // soulsAuthorized. Default 8 — matches a US-style fire squad.
  soulsAuthorized: z.number().int().positive().default(8),
  companyId: Id.optional(),
});
export type Squad = z.infer<typeof Squad>;

// ADR 016 §S7 — Company groups squads (typically 3–5 squads per company,
// matching the design's S7 column count). Companies group under a
// battalion banner.
export const Company = z.object({
  id: Id,
  name: z.string().min(1).max(32),
  designator: z.string().min(1).max(8),
  branch: Branch.default('infantry'),
  battalionId: Id.optional(),
});
export type Company = z.infer<typeof Company>;

export const Battalion = z.object({
  id: Id,
  name: z.string().min(1).max(48),
  designator: z.string().min(1).max(8),
  motto: z.string().default(''),
});
export type Battalion = z.infer<typeof Battalion>;

export function newSquadId(): string {
  return `sq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newCompanyId(): string {
  return `co-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newBattalionId(): string {
  return `bn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Echelon labels — display-layer only. Spec/06 maps SQD/SEC/PLT/COY to
// the ORBAT hierarchy levels. Used by S7 plaques + breadcrumbs.
export type Echelon = 'squad' | 'section' | 'platoon' | 'company' | 'battalion';

export function echelonLabel(e: Echelon): string {
  switch (e) {
    case 'squad':
      return 'SQD';
    case 'section':
      return 'SEC';
    case 'platoon':
      return 'PLT';
    case 'company':
      return 'COY';
    case 'battalion':
      return 'BN';
  }
}
