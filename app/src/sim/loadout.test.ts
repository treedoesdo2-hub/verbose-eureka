import type { Armor } from '@schema/armor';
import type { LoadoutTemplate } from '@schema/template';
import type { Utility } from '@schema/utility';
import type { Weapon } from '@schema/weapon';
import { asArmorId, asUtilityId, asWeaponId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import type { ContentLookup } from './loadout';
import {
  deriveCombatProfile,
  emptyLoadout,
  INFANTRY_TONNAGE_BUDGET,
  loadoutFromTemplate,
  validateLoadout,
} from './loadout';

const rifle: Weapon = {
  id: asWeaponId('ar-01'),
  name: 'AR-01',
  hardpoint: 'primary',
  damageType: 'ballistic',
  ballistics: { caliberMm: 5.56, velocityMps: 900, massGrams: 4, penetration: 45 },
  baseAccuracy: 65,
  rpm: 600,
  magazineSize: 30,
  reloadSeconds: 2.5,
  rangeMeters: 300,
  tonnage: 4,
  critSlots: 2,
  cost: 1200,
};

const lmg: Weapon = {
  ...rifle,
  id: asWeaponId('lmg-01'),
  name: 'LMG-01',
  tonnage: 10,
  critSlots: 4,
};

const pistol: Weapon = {
  ...rifle,
  id: asWeaponId('p-01'),
  name: 'Pistol',
  hardpoint: 'sidearm',
  tonnage: 1,
  critSlots: 1,
};

const lightArmor: Armor = {
  id: asArmorId('light'),
  name: 'Light',
  class: 'light',
  mobilityPenalty: 5,
  cost: 400,
  placements: [
    { zone: 'torso_front', damageReduction: 20, tonnage: 2 },
    { zone: 'torso_back', damageReduction: 20, tonnage: 2 },
  ],
};

const heavyArmor: Armor = {
  id: asArmorId('heavy'),
  name: 'Heavy',
  class: 'heavy',
  mobilityPenalty: 25,
  cost: 2000,
  placements: [
    { zone: 'head', damageReduction: 30, tonnage: 1 },
    { zone: 'torso_front', damageReduction: 70, tonnage: 4 },
    { zone: 'torso_back', damageReduction: 70, tonnage: 4 },
    { zone: 'pelvis', damageReduction: 60, tonnage: 3 },
  ],
};

const medkit: Utility = {
  id: asUtilityId('medkit'),
  name: 'Medkit',
  kind: 'medkit',
  critSlots: 2,
  tonnage: 1,
  uses: 3,
  params: {},
  cost: 200,
};

const content: ContentLookup = {
  weapon: (id) => [rifle, lmg, pistol].find((w) => w.id === id),
  armor: (id) => [lightArmor, heavyArmor].find((a) => a.id === id),
  utility: (id) => [medkit].find((u) => u.id === id),
};

describe('loadout validation', () => {
  it('empty loadout passes', () => {
    const v = validateLoadout(emptyLoadout(), content);
    expect(v.valid).toBe(true);
    expect(v.tonnage).toBe(0);
  });

  it('basic loadout under budget', () => {
    const v = validateLoadout(
      {
        primaryWeaponId: rifle.id,
        sidearmId: pistol.id,
        armorId: lightArmor.id,
        utilityIds: [medkit.id],
      },
      content,
    );
    expect(v.valid).toBe(true);
    expect(v.tonnage).toBe(4 + 1 + 4 + 1);
  });

  it('heavy loadout exceeds tonnage budget', () => {
    const v = validateLoadout(
      {
        primaryWeaponId: lmg.id,
        sidearmId: pistol.id,
        armorId: heavyArmor.id,
        utilityIds: [medkit.id, medkit.id, medkit.id, medkit.id, medkit.id],
      },
      content,
    );
    expect(v.valid).toBe(false);
    expect(v.tonnage).toBeGreaterThan(INFANTRY_TONNAGE_BUDGET);
  });

  it('unknown item id fails', () => {
    const v = validateLoadout(
      {
        primaryWeaponId: asWeaponId('does-not-exist'),
        sidearmId: null,
        armorId: null,
        utilityIds: [],
      },
      content,
    );
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toContain('not found');
  });
});

describe('combat profile', () => {
  it('derives per-zone DR from armor placements', () => {
    const profile = deriveCombatProfile(
      {
        primaryWeaponId: rifle.id,
        sidearmId: null,
        armorId: heavyArmor.id,
        utilityIds: [],
      },
      content,
    );
    expect(profile.zoneDr.torso_front).toBe(70);
    expect(profile.zoneDr.head).toBe(30);
    expect(profile.zoneDr.left_arm).toBe(0);
  });

  it('heavy loadout has higher mobility penalty than light', () => {
    const lightProfile = deriveCombatProfile(
      { primaryWeaponId: rifle.id, sidearmId: null, armorId: lightArmor.id, utilityIds: [] },
      content,
    );
    const heavyProfile = deriveCombatProfile(
      { primaryWeaponId: rifle.id, sidearmId: null, armorId: heavyArmor.id, utilityIds: [] },
      content,
    );
    expect(heavyProfile.mobilityPenalty).toBeGreaterThan(lightProfile.mobilityPenalty);
  });
});

describe('loadout from template', () => {
  it('converts template to loadout', () => {
    const t: LoadoutTemplate = {
      id: 'rifleman-light',
      name: 'Rifleman (Light)',
      role: 'rifleman',
      primaryWeaponId: 'ar-01',
      sidearmId: 'p-01',
      armorId: 'light',
      utilityIds: ['medkit'],
    };
    const l = loadoutFromTemplate(t);
    expect(l.primaryWeaponId).toBe('ar-01');
    expect(l.armorId).toBe('light');
  });
});
