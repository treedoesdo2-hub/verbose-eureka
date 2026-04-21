import {
  Armor,
  Contract,
  Faction,
  GameMap,
  LoadoutTemplate,
  Operator,
  Utility,
  Weapon,
} from '@schema/index';
import type { z } from 'zod';

export type WorkerContentBundle = {
  operators: Map<string, Operator>;
  weapons: Map<string, Weapon>;
  armor: Map<string, Armor>;
  utility: Map<string, Utility>;
  factions: Map<string, Faction>;
  contracts: Map<string, Contract>;
  maps: Map<string, GameMap>;
  templates: Map<string, LoadoutTemplate>;
};

function validateGroup<T extends z.ZodType<{ id: string }>>(
  schema: T,
  mods: Record<string, unknown>,
): Map<string, z.infer<T>> {
  const out = new Map<string, z.infer<T>>();
  for (const [path, raw] of Object.entries(mods)) {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`schema failure at ${path}: ${JSON.stringify(parsed.error.issues, null, 2)}`);
    }
    out.set(parsed.data.id, parsed.data);
  }
  return out;
}

export function loadWorkerContent(): WorkerContentBundle {
  return {
    operators: validateGroup(
      Operator,
      import.meta.glob<unknown>('../../../content/operators/*.json', {
        eager: true,
        import: 'default',
      }),
    ),
    weapons: validateGroup(
      Weapon,
      import.meta.glob<unknown>('../../../content/weapons/*.json', {
        eager: true,
        import: 'default',
      }),
    ),
    armor: validateGroup(
      Armor,
      import.meta.glob<unknown>('../../../content/armor/*.json', {
        eager: true,
        import: 'default',
      }),
    ),
    utility: validateGroup(
      Utility,
      import.meta.glob<unknown>('../../../content/utility/*.json', {
        eager: true,
        import: 'default',
      }),
    ),
    factions: validateGroup(
      Faction,
      import.meta.glob<unknown>('../../../content/factions/*.json', {
        eager: true,
        import: 'default',
      }),
    ),
    contracts: validateGroup(
      Contract,
      import.meta.glob<unknown>('../../../content/contracts/*.json', {
        eager: true,
        import: 'default',
      }),
    ),
    maps: validateGroup(
      GameMap,
      import.meta.glob<unknown>('../../../content/maps/*.json', {
        eager: true,
        import: 'default',
      }),
    ),
    templates: validateGroup(
      LoadoutTemplate,
      import.meta.glob<unknown>('../../../content/templates/*.json', {
        eager: true,
        import: 'default',
      }),
    ),
  };
}
