import type { Ammo } from '@schema/ammo';
import type { Armor, ArmorPlacement } from '@schema/armor';
import type { BodyZone } from '@schema/common';
import { ALL_BODY_ZONES, ZONE_CAPACITY_KG } from '@schema/common';
import type { LoadoutTemplate } from '@schema/template';
import type { Utility } from '@schema/utility';
import type { Weapon } from '@schema/weapon';

export type LoadoutItemType = 'weapon' | 'armor' | 'utility' | 'ammo';

export type LoadoutItem = {
  readonly type: LoadoutItemType;
  readonly id: string;
  readonly zone: BodyZone;
};

export type Loadout = {
  readonly items: readonly LoadoutItem[];
};

export type ContentLookup = {
  weapon(id: string): Weapon | undefined;
  armor(id: string): Armor | undefined;
  utility(id: string): Utility | undefined;
  // ADR 016 ammo task #281.10. Optional during transition — older test
  // fixtures construct lookups without ammo. Validation falls back to a
  // permissive shape when the lookup is absent.
  ammo?(id: string): Ammo | undefined;
};

export const INFANTRY_WEIGHT_KG_BUDGET = 30;

export type LoadoutValidation = {
  valid: boolean;
  errors: string[];
  totalWeightKg: number;
  perZoneWeightKg: Record<BodyZone, number>;
};

function zeroZoneMap(): Record<BodyZone, number> {
  const m = {} as Record<BodyZone, number>;
  for (const z of ALL_BODY_ZONES) m[z] = 0;
  return m;
}

export function validateLoadout(loadout: Loadout, content: ContentLookup): LoadoutValidation {
  const errors: string[] = [];
  const perZone = zeroZoneMap();
  let total = 0;

  let handsUsed = 0;
  let largeOnBack = 0;
  const armorAtZone = new Map<BodyZone, string>();

  for (const item of loadout.items) {
    if (item.type === 'weapon') {
      const w = content.weapon(item.id);
      if (!w) {
        errors.push(`weapon ${item.id} not found`);
        continue;
      }
      if (item.zone !== 'left_hand' && item.zone !== 'right_hand' && item.zone !== 'waist') {
        errors.push(`${w.name} cannot be placed at ${item.zone}`);
      }
      if (item.zone === 'left_hand' || item.zone === 'right_hand') {
        handsUsed += w.hands;
      }
      perZone[item.zone] += w.weightKg;
      total += w.weightKg;
    } else if (item.type === 'armor') {
      const a = content.armor(item.id);
      if (!a) {
        errors.push(`armor ${item.id} not found`);
        continue;
      }
      const p = a.placements.find((pl: ArmorPlacement) => pl.zone === item.zone);
      if (!p) {
        errors.push(`${a.name} has no plate for ${item.zone}`);
        continue;
      }
      if (armorAtZone.has(item.zone)) {
        errors.push(
          `two armor pieces at ${item.zone} (${armorAtZone.get(item.zone)} and ${a.name})`,
        );
      }
      armorAtZone.set(item.zone, a.name);
      perZone[item.zone] += p.weightKg;
      total += p.weightKg;
    } else if (item.type === 'utility') {
      const u = content.utility(item.id);
      if (!u) {
        errors.push(`utility ${item.id} not found`);
        continue;
      }
      if (!u.allowedZones.includes(item.zone)) {
        errors.push(`${u.name} not allowed at ${item.zone}`);
      }
      if (u.mount === 'large' && item.zone === 'back_mount') largeOnBack += 1;
      perZone[item.zone] += u.weightKg;
      total += u.weightKg;
    }
  }

  if (handsUsed > 2) errors.push(`hand slots over budget (${handsUsed}/2)`);
  if (largeOnBack > 1) errors.push(`back mount over capacity (${largeOnBack}/1)`);

  for (const z of ALL_BODY_ZONES) {
    if (perZone[z] > ZONE_CAPACITY_KG[z] + 0.001) {
      errors.push(`${z} over capacity (${perZone[z].toFixed(1)}/${ZONE_CAPACITY_KG[z]} kg)`);
    }
  }

  if (total > INFANTRY_WEIGHT_KG_BUDGET + 0.001) {
    errors.push(
      `total weight ${total.toFixed(1)} kg exceeds budget ${INFANTRY_WEIGHT_KG_BUDGET} kg`,
    );
  }

  return { valid: errors.length === 0, errors, totalWeightKg: total, perZoneWeightKg: perZone };
}

export type CombatProfile = {
  readonly primaryWeapon: Weapon | null;
  readonly sidearm: Weapon | null;
  readonly utilityIds: readonly string[];
  readonly hasMedkit: boolean;
  readonly zoneDr: Readonly<Record<BodyZone, number>>;
  readonly totalWeightKg: number;
  readonly mobilityPenalty: number;
};

export function mobilityPenaltyFromWeight(weightKg: number): number {
  if (weightKg <= 10) return 0;
  if (weightKg <= 20) return Math.round(((weightKg - 10) / 10) * 10);
  if (weightKg <= 30) return 10 + Math.round(((weightKg - 20) / 10) * 15);
  return 25 + Math.min(25, Math.round((weightKg - 30) * 2));
}

export function deriveCombatProfile(loadout: Loadout, content: ContentLookup): CombatProfile {
  const zoneDr = zeroZoneMap();
  let total = 0;
  let primaryWeapon: Weapon | null = null;
  let sidearm: Weapon | null = null;
  const utilityIds: string[] = [];
  let hasMedkit = false;

  for (const item of loadout.items) {
    if (item.type === 'weapon') {
      const w = content.weapon(item.id);
      if (!w) continue;
      total += w.weightKg;
      if (w.hardpoint === 'primary' && !primaryWeapon) primaryWeapon = w;
      else if (w.hardpoint === 'sidearm' && !sidearm) sidearm = w;
    } else if (item.type === 'armor') {
      const a = content.armor(item.id);
      if (!a) continue;
      const p = a.placements.find((pl) => pl.zone === item.zone);
      if (!p) continue;
      total += p.weightKg;
      if (p.damageReduction > zoneDr[item.zone]) zoneDr[item.zone] = p.damageReduction;
    } else if (item.type === 'utility') {
      const u = content.utility(item.id);
      if (!u) continue;
      total += u.weightKg;
      utilityIds.push(u.id);
      if (u.kind === 'medkit') hasMedkit = true;
    }
  }

  return {
    primaryWeapon,
    sidearm,
    utilityIds,
    hasMedkit,
    zoneDr,
    totalWeightKg: total,
    mobilityPenalty: mobilityPenaltyFromWeight(total),
  };
}

export function emptyLoadout(): Loadout {
  return { items: [] };
}

export function emptyCombatProfile(): CombatProfile {
  return {
    primaryWeapon: null,
    sidearm: null,
    utilityIds: [],
    hasMedkit: false,
    zoneDr: zeroZoneMap(),
    totalWeightKg: 0,
    mobilityPenalty: 0,
  };
}

export function loadoutFromTemplate(t: LoadoutTemplate, content: ContentLookup): Loadout {
  const items: LoadoutItem[] = [];

  if (t.primaryWeaponId) {
    const w = content.weapon(t.primaryWeaponId);
    if (w) items.push({ type: 'weapon', id: w.id, zone: 'right_hand' });
  }
  if (t.sidearmId) {
    const w = content.weapon(t.sidearmId);
    if (w) items.push({ type: 'weapon', id: w.id, zone: 'waist' });
  }
  if (t.armorId) {
    const a = content.armor(t.armorId);
    if (a) {
      for (const p of a.placements) {
        items.push({ type: 'armor', id: a.id, zone: p.zone });
      }
    }
  }
  const utilZoneCycle: BodyZone[] = ['torso_front', 'waist', 'torso_front', 'waist'];
  let cyc = 0;
  for (const uid of t.utilityIds) {
    const u = content.utility(uid);
    if (!u) continue;
    const preferred = u.allowedZones.find((z) => utilZoneCycle.includes(z)) ?? u.allowedZones[0];
    items.push({
      type: 'utility',
      id: u.id,
      zone: preferred ?? utilZoneCycle[cyc % utilZoneCycle.length],
    });
    cyc++;
  }

  return { items };
}

export function itemCounts(loadout: Loadout): Map<string, number> {
  const m = new Map<string, number>();
  const armorCounted = new Set<string>();
  for (const it of loadout.items) {
    if (it.type === 'armor') {
      if (armorCounted.has(it.id)) continue;
      armorCounted.add(it.id);
      m.set(it.id, (m.get(it.id) ?? 0) + 1);
    } else {
      m.set(it.id, (m.get(it.id) ?? 0) + 1);
    }
  }
  return m;
}
