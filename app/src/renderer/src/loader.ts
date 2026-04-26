import {
  Ammo,
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

export type ContentBundle = {
  operators: Map<string, Operator>;
  weapons: Map<string, Weapon>;
  armor: Map<string, Armor>;
  utility: Map<string, Utility>;
  ammo: Map<string, Ammo>;
  factions: Map<string, Faction>;
  contracts: Map<string, Contract>;
  maps: Map<string, GameMap>;
  templates: Map<string, LoadoutTemplate>;
};

function validateGroup<T extends z.ZodType<{ id: string }>>(
  schema: T,
  mods: Record<string, unknown>,
  label: string,
): Map<string, z.infer<T>> {
  const out = new Map<string, z.infer<T>>();
  for (const [path, raw] of Object.entries(mods)) {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Schema validation failed for ${label} at ${path}:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
      );
    }
    if (out.has(parsed.data.id)) {
      throw new Error(`Duplicate id "${parsed.data.id}" in ${label} (${path})`);
    }
    out.set(parsed.data.id, parsed.data);
  }
  return out;
}

export function loadContent(): ContentBundle {
  const operatorMods = import.meta.glob<unknown>('../../content/operators/*.json', {
    eager: true,
    import: 'default',
  });
  const weaponMods = import.meta.glob<unknown>('../../content/weapons/*.json', {
    eager: true,
    import: 'default',
  });
  const armorMods = import.meta.glob<unknown>('../../content/armor/*.json', {
    eager: true,
    import: 'default',
  });
  const utilityMods = import.meta.glob<unknown>('../../content/utility/*.json', {
    eager: true,
    import: 'default',
  });
  const ammoMods = import.meta.glob<unknown>('../../content/ammo/*.json', {
    eager: true,
    import: 'default',
  });
  const factionMods = import.meta.glob<unknown>('../../content/factions/*.json', {
    eager: true,
    import: 'default',
  });
  const contractMods = import.meta.glob<unknown>('../../content/contracts/*.json', {
    eager: true,
    import: 'default',
  });
  const mapMods = import.meta.glob<unknown>('../../content/maps/*.json', {
    eager: true,
    import: 'default',
  });
  const templateMods = import.meta.glob<unknown>('../../content/templates/*.json', {
    eager: true,
    import: 'default',
  });

  return {
    operators: validateGroup(Operator, operatorMods, 'operators'),
    weapons: validateGroup(Weapon, weaponMods, 'weapons'),
    armor: validateGroup(Armor, armorMods, 'armor'),
    utility: validateGroup(Utility, utilityMods, 'utility'),
    ammo: validateGroup(Ammo, ammoMods, 'ammo'),
    factions: validateGroup(Faction, factionMods, 'factions'),
    contracts: validateGroup(Contract, contractMods, 'contracts'),
    maps: validateGroup(GameMap, mapMods, 'maps'),
    templates: validateGroup(LoadoutTemplate, templateMods, 'templates'),
  };
}
