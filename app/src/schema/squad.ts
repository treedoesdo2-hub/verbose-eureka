import { z } from 'zod';
import { BodyZone, Id } from './common';

export const LoadoutItemType = z.enum(['weapon', 'armor', 'utility']);
export type LoadoutItemType = z.infer<typeof LoadoutItemType>;

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
});
export type Squad = z.infer<typeof Squad>;

export function newSquadId(): string {
  return `sq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
