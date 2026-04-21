import type { Armor } from '@schema/armor';
import type { LoadoutTemplate } from '@schema/template';
import type { Utility } from '@schema/utility';
import type { Weapon } from '@schema/weapon';
import { asArmorId, asUtilityId, asWeaponId } from '@shared/ids';
import { describe, expect, it } from 'vitest';
import type { ContentLookup, Loadout } from './loadout';
import {
  deriveCombatProfile,
  emptyLoadout,
  INFANTRY_WEIGHT_KG_BUDGET,
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
  weightKg: 3.6,
  hands: 2,
  cost: 1200,
};

const lmg: Weapon = {
  ...rifle,
  id: asWeaponId('lmg-01'),
  name: 'LMG-01',
  weightKg: 11.5,
  hands: 2,
};

const pistol: Weapon = {
  ...rifle,
  id: asWeaponId('p-01'),
  name: 'Pistol',
  hardpoint: 'sidearm',
  weightKg: 1.0,
  hands: 1,
};

const lightArmor: Armor = {
  id: asArmorId('light'),
  name: 'Light',
  class: 'light',
  cost: 400,
  placements: [
    { zone: 'torso_front', damageReduction: 20, weightKg: 2, plate: 'soft' },
    { zone: 'torso_back', damageReduction: 20, weightKg: 2, plate: 'soft' },
  ],
};

const heavyArmor: Armor = {
  id: asArmorId('heavy'),
  name: 'Heavy',
  class: 'heavy',
  cost: 2000,
  placements: [
    { zone: 'head', damageReduction: 30, weightKg: 1.5, plate: 'hard' },
    { zone: 'torso_front', damageReduction: 70, weightKg: 5, plate: 'hard' },
    { zone: 'torso_back', damageReduction: 70, weightKg: 5, plate: 'hard' },
    { zone: 'waist', damageReduction: 60, weightKg: 3, plate: 'hard' },
    { zone: 'left_arm', damageReduction: 40, weightKg: 1.5, plate: 'hard' },
    { zone: 'right_arm', damageReduction: 40, weightKg: 1.5, plate: 'hard' },
  ],
};

const medkit: Utility = {
  id: asUtilityId('medkit'),
  name: 'Medkit',
  kind: 'medkit',
  mount: 'consumable',
  allowedZones: ['waist', 'torso_back', 'back_mount'],
  weightKg: 1.4,
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
    expect(v.totalWeightKg).toBe(0);
  });

  it('basic loadout under budget', () => {
    const l: Loadout = {
      items: [
        { type: 'weapon', id: rifle.id, zone: 'right_hand' },
        { type: 'weapon', id: pistol.id, zone: 'waist' },
        { type: 'armor', id: lightArmor.id, zone: 'torso_front' },
        { type: 'armor', id: lightArmor.id, zone: 'torso_back' },
        { type: 'utility', id: medkit.id, zone: 'waist' },
      ],
    };
    const v = validateLoadout(l, content);
    expect(v.valid).toBe(true);
    expect(v.totalWeightKg).toBeCloseTo(3.6 + 1.0 + 2 + 2 + 1.4, 3);
  });

  it('heavy loadout exceeds weight budget', () => {
    const l: Loadout = {
      items: [
        { type: 'weapon', id: lmg.id, zone: 'right_hand' },
        { type: 'armor', id: heavyArmor.id, zone: 'head' },
        { type: 'armor', id: heavyArmor.id, zone: 'torso_front' },
        { type: 'armor', id: heavyArmor.id, zone: 'torso_back' },
        { type: 'armor', id: heavyArmor.id, zone: 'waist' },
        { type: 'armor', id: heavyArmor.id, zone: 'left_arm' },
        { type: 'armor', id: heavyArmor.id, zone: 'right_arm' },
        { type: 'utility', id: medkit.id, zone: 'back_mount' },
        { type: 'utility', id: medkit.id, zone: 'torso_back' },
      ],
    };
    const v = validateLoadout(l, content);
    expect(v.valid).toBe(false);
    expect(v.totalWeightKg).toBeGreaterThan(INFANTRY_WEIGHT_KG_BUDGET);
  });

  it('two-handed weapons occupy both hand slots — adding sidearm to a hand is a hand-budget error', () => {
    const l: Loadout = {
      items: [
        { type: 'weapon', id: rifle.id, zone: 'right_hand' },
        { type: 'weapon', id: pistol.id, zone: 'left_hand' },
      ],
    };
    const v = validateLoadout(l, content);
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes('hand'))).toBe(true);
  });

  it('two armor pieces at same zone is an error', () => {
    const l: Loadout = {
      items: [
        { type: 'armor', id: lightArmor.id, zone: 'torso_front' },
        { type: 'armor', id: heavyArmor.id, zone: 'torso_front' },
      ],
    };
    const v = validateLoadout(l, content);
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes('torso_front'))).toBe(true);
  });

  it('utility at disallowed zone is an error', () => {
    const l: Loadout = {
      items: [{ type: 'utility', id: medkit.id, zone: 'head' }],
    };
    const v = validateLoadout(l, content);
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes('Medkit'))).toBe(true);
  });

  it('unknown item id fails', () => {
    const l: Loadout = {
      items: [{ type: 'weapon', id: 'does-not-exist', zone: 'right_hand' }],
    };
    const v = validateLoadout(l, content);
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toContain('not found');
  });
});

describe('combat profile', () => {
  it('derives per-zone DR from armor placements', () => {
    const l: Loadout = {
      items: [
        { type: 'weapon', id: rifle.id, zone: 'right_hand' },
        { type: 'armor', id: heavyArmor.id, zone: 'head' },
        { type: 'armor', id: heavyArmor.id, zone: 'torso_front' },
        { type: 'armor', id: heavyArmor.id, zone: 'torso_back' },
      ],
    };
    const profile = deriveCombatProfile(l, content);
    expect(profile.zoneDr.torso_front).toBe(70);
    expect(profile.zoneDr.head).toBe(30);
    expect(profile.zoneDr.left_arm).toBe(0);
  });

  it('heavy loadout has higher mobility penalty than light', () => {
    const lightL: Loadout = {
      items: [
        { type: 'weapon', id: rifle.id, zone: 'right_hand' },
        { type: 'armor', id: lightArmor.id, zone: 'torso_front' },
        { type: 'armor', id: lightArmor.id, zone: 'torso_back' },
      ],
    };
    const heavyL: Loadout = {
      items: [
        { type: 'weapon', id: rifle.id, zone: 'right_hand' },
        { type: 'armor', id: heavyArmor.id, zone: 'head' },
        { type: 'armor', id: heavyArmor.id, zone: 'torso_front' },
        { type: 'armor', id: heavyArmor.id, zone: 'torso_back' },
        { type: 'armor', id: heavyArmor.id, zone: 'waist' },
      ],
    };
    const lightProfile = deriveCombatProfile(lightL, content);
    const heavyProfile = deriveCombatProfile(heavyL, content);
    expect(heavyProfile.mobilityPenalty).toBeGreaterThan(lightProfile.mobilityPenalty);
  });
});

describe('loadout from template', () => {
  it('converts template to zone-placed loadout', () => {
    const t: LoadoutTemplate = {
      id: 'rifleman-light',
      name: 'Rifleman (Light)',
      role: 'rifleman',
      primaryWeaponId: rifle.id,
      sidearmId: pistol.id,
      armorId: lightArmor.id,
      utilityIds: [medkit.id],
    };
    const l = loadoutFromTemplate(t, content);
    expect(l.items.some((i) => i.type === 'weapon' && i.id === rifle.id)).toBe(true);
    expect(l.items.some((i) => i.type === 'armor' && i.id === lightArmor.id)).toBe(true);
    expect(l.items.some((i) => i.type === 'utility' && i.id === medkit.id)).toBe(true);
  });
});
