import type { Armor } from '@schema/armor';
import type { BodyZone } from '@schema/common';
import { ALL_BODY_ZONES } from '@schema/common';
import type { LoadoutTemplate } from '@schema/template';
import type { Utility } from '@schema/utility';
import type { Weapon } from '@schema/weapon';
import type { ArmorId, UtilityId, WeaponId } from '@shared/ids';

export type Loadout = {
  readonly primaryWeaponId: WeaponId | null;
  readonly sidearmId: WeaponId | null;
  readonly armorId: ArmorId | null;
  readonly utilityIds: readonly UtilityId[];
};

export type ContentLookup = {
  weapon(id: string): Weapon | undefined;
  armor(id: string): Armor | undefined;
  utility(id: string): Utility | undefined;
};

export const INFANTRY_TONNAGE_BUDGET = 25;
export const INFANTRY_CRIT_SLOTS_BUDGET = 8;

export type LoadoutValidation = {
  valid: boolean;
  errors: string[];
  tonnage: number;
  critSlots: number;
};

export function validateLoadout(loadout: Loadout, content: ContentLookup): LoadoutValidation {
  const errors: string[] = [];
  let tonnage = 0;
  let critSlots = 0;

  if (loadout.primaryWeaponId) {
    const w = content.weapon(loadout.primaryWeaponId);
    if (!w) errors.push(`primary weapon ${loadout.primaryWeaponId} not found`);
    else {
      tonnage += w.tonnage;
      critSlots += w.critSlots;
    }
  }
  if (loadout.sidearmId) {
    const w = content.weapon(loadout.sidearmId);
    if (!w) errors.push(`sidearm ${loadout.sidearmId} not found`);
    else {
      tonnage += w.tonnage;
      critSlots += w.critSlots;
    }
  }
  if (loadout.armorId) {
    const a = content.armor(loadout.armorId);
    if (!a) errors.push(`armor ${loadout.armorId} not found`);
    else for (const p of a.placements) tonnage += p.tonnage;
  }
  for (const uid of loadout.utilityIds) {
    const u = content.utility(uid);
    if (!u) errors.push(`utility ${uid} not found`);
    else {
      tonnage += u.tonnage;
      critSlots += u.critSlots;
    }
  }

  if (tonnage > INFANTRY_TONNAGE_BUDGET) {
    errors.push(`tonnage ${tonnage.toFixed(1)} exceeds budget ${INFANTRY_TONNAGE_BUDGET}`);
  }
  if (critSlots > INFANTRY_CRIT_SLOTS_BUDGET) {
    errors.push(`crit slots ${critSlots} exceed budget ${INFANTRY_CRIT_SLOTS_BUDGET}`);
  }

  return { valid: errors.length === 0, errors, tonnage, critSlots };
}

export function loadoutFromTemplate(t: LoadoutTemplate): Loadout {
  return {
    primaryWeaponId: t.primaryWeaponId,
    sidearmId: t.sidearmId,
    armorId: t.armorId,
    utilityIds: [...t.utilityIds],
  };
}

export type CombatProfile = {
  readonly primaryWeapon: Weapon | null;
  readonly sidearm: Weapon | null;
  readonly armor: Armor | null;
  readonly utilityIds: readonly UtilityId[];
  readonly zoneDr: Readonly<Record<BodyZone, number>>;
  readonly tonnage: number;
  readonly mobilityPenalty: number;
};

export function deriveCombatProfile(loadout: Loadout, content: ContentLookup): CombatProfile {
  const primaryWeapon = loadout.primaryWeaponId
    ? (content.weapon(loadout.primaryWeaponId) ?? null)
    : null;
  const sidearm = loadout.sidearmId ? (content.weapon(loadout.sidearmId) ?? null) : null;
  const armor = loadout.armorId ? (content.armor(loadout.armorId) ?? null) : null;

  const zoneDr: Record<BodyZone, number> = {
    head: 0,
    torso_front: 0,
    torso_back: 0,
    pelvis: 0,
    left_arm: 0,
    right_arm: 0,
    left_leg: 0,
    right_leg: 0,
  };
  if (armor) {
    for (const p of armor.placements) {
      if (p.damageReduction > zoneDr[p.zone]) zoneDr[p.zone] = p.damageReduction;
    }
  }

  let tonnage = 0;
  if (primaryWeapon) tonnage += primaryWeapon.tonnage;
  if (sidearm) tonnage += sidearm.tonnage;
  if (armor) for (const p of armor.placements) tonnage += p.tonnage;
  for (const uid of loadout.utilityIds) {
    const u = content.utility(uid);
    if (u) tonnage += u.tonnage;
  }

  const mobilityPenalty = armor?.mobilityPenalty ?? 0;

  void ALL_BODY_ZONES;
  return {
    primaryWeapon,
    sidearm,
    armor,
    utilityIds: loadout.utilityIds,
    zoneDr,
    tonnage,
    mobilityPenalty,
  };
}

export function emptyLoadout(): Loadout {
  return {
    primaryWeaponId: null,
    sidearmId: null,
    armorId: null,
    utilityIds: [],
  };
}

export function emptyCombatProfile(): CombatProfile {
  return {
    primaryWeapon: null,
    sidearm: null,
    armor: null,
    utilityIds: [],
    zoneDr: {
      head: 0,
      torso_front: 0,
      torso_back: 0,
      pelvis: 0,
      left_arm: 0,
      right_arm: 0,
      left_leg: 0,
      right_leg: 0,
    },
    tonnage: 0,
    mobilityPenalty: 0,
  };
}
