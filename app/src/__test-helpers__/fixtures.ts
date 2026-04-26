import type { Ammo } from '@schema/ammo';
import type { Armor } from '@schema/armor';
import type { BodyZone } from '@schema/common';
import type { Utility } from '@schema/utility';
import type { Weapon } from '@schema/weapon';
import { asArmorId, asUtilityId, asWeaponId } from '@shared/ids';
import type { ContentLookup, Loadout } from '@sim/loadout';

/**
 * Fixture factories for tests — sensible defaults, override via partial.
 *
 * Pattern stolen from agyn's __tests__/helpers/ dir. Keeps test files terse and
 * makes schema changes less painful (fix the default once, not in every test).
 */

export function makeWeapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
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
    slotFootprint: {},
    hardpointNeeds: [],
    internalSlots: {},
    ...overrides,
  };
}

export function makePistol(overrides: Partial<Weapon> = {}): Weapon {
  return makeWeapon({
    id: asWeaponId('p-01'),
    name: 'Pistol',
    hardpoint: 'sidearm',
    weightKg: 1.0,
    hands: 1,
    ...overrides,
  });
}

export function makeLmg(overrides: Partial<Weapon> = {}): Weapon {
  return makeWeapon({
    id: asWeaponId('lmg-01'),
    name: 'LMG-01',
    weightKg: 11.5,
    hands: 2,
    ...overrides,
  });
}

export function makeLightArmor(overrides: Partial<Armor> = {}): Armor {
  return {
    id: asArmorId('light'),
    name: 'Light',
    class: 'light',
    cost: 400,
    placements: [
      {
        zone: 'torso_front',
        damageReduction: 20,
        weightKg: 2,
        plate: 'soft',
        penetrationResistance: 0,
        fireResistance: 0,
        empResistance: 0,
      },
      {
        zone: 'torso_back',
        damageReduction: 20,
        weightKg: 2,
        plate: 'soft',
        penetrationResistance: 0,
        fireResistance: 0,
        empResistance: 0,
      },
    ],
    slotFootprint: {},
    hardpointNeeds: [],
    internalSlots: {},
    ...overrides,
  };
}

export function makeHeavyArmor(overrides: Partial<Armor> = {}): Armor {
  return {
    id: asArmorId('heavy'),
    name: 'Heavy',
    class: 'heavy',
    cost: 2000,
    placements: [
      {
        zone: 'head',
        damageReduction: 30,
        weightKg: 1.5,
        plate: 'hard',
        penetrationResistance: 30,
        fireResistance: 0,
        empResistance: 0,
      },
      {
        zone: 'torso_front',
        damageReduction: 70,
        weightKg: 5,
        plate: 'hard',
        penetrationResistance: 60,
        fireResistance: 0,
        empResistance: 0,
      },
      {
        zone: 'torso_back',
        damageReduction: 70,
        weightKg: 5,
        plate: 'hard',
        penetrationResistance: 60,
        fireResistance: 0,
        empResistance: 0,
      },
      {
        zone: 'waist',
        damageReduction: 60,
        weightKg: 3,
        plate: 'hard',
        penetrationResistance: 50,
        fireResistance: 0,
        empResistance: 0,
      },
      {
        zone: 'left_arm',
        damageReduction: 40,
        weightKg: 1.5,
        plate: 'hard',
        penetrationResistance: 30,
        fireResistance: 0,
        empResistance: 0,
      },
      {
        zone: 'right_arm',
        damageReduction: 40,
        weightKg: 1.5,
        plate: 'hard',
        penetrationResistance: 30,
        fireResistance: 0,
        empResistance: 0,
      },
    ],
    slotFootprint: {},
    hardpointNeeds: [],
    internalSlots: {},
    ...overrides,
  };
}

export function makeMedkit(overrides: Partial<Utility> = {}): Utility {
  return {
    id: asUtilityId('medkit'),
    name: 'Medkit',
    kind: 'medkit',
    mount: 'consumable',
    allowedZones: ['waist', 'torso_back', 'back_mount'],
    weightKg: 1.4,
    uses: 3,
    params: {},
    cost: 200,
    slotFootprint: {},
    hardpointNeeds: [],
    internalSlots: {},
    ...overrides,
  };
}

export function makeChestRig(overrides: Partial<Utility> = {}): Utility {
  return {
    id: asUtilityId('chest-rig'),
    name: 'Chest Rig',
    kind: 'tool',
    mount: 'large',
    allowedZones: ['torso_front'],
    weightKg: 1.8,
    uses: 1,
    params: {},
    cost: 300,
    slotFootprint: { torso_front: 2, torso_back: 1 },
    hardpointNeeds: [],
    internalSlots: { mag_rifle: 4, grenade_loop: 2, ifak: 1 },
    ...overrides,
  };
}

export function makeMagBin(overrides: Partial<Utility> = {}): Utility {
  return {
    id: asUtilityId('mag-rifle'),
    name: 'Rifle Mag',
    kind: 'tool',
    mount: 'consumable',
    allowedZones: ['waist', 'torso_front', 'torso_back'],
    weightKg: 0.5,
    uses: 30,
    params: {},
    cost: 20,
    slotFootprint: {},
    hardpointNeeds: [],
    internalSlots: {},
    consumableCategory: 'mag_rifle',
    ...overrides,
  };
}

/**
 * Zone DR builder. Pass overrides for specific zones; everything else is 0.
 * Useful for hit tests where armor is a black-box DR map, not a content lookup.
 */
export function makeZoneDr(
  overrides: Partial<Record<BodyZone, number>> = {},
): Record<BodyZone, number> {
  return {
    head: 0,
    torso_front: 0,
    torso_back: 0,
    left_arm: 0,
    right_arm: 0,
    left_hand: 0,
    right_hand: 0,
    waist: 0,
    left_leg: 0,
    right_leg: 0,
    back_mount: 0,
    ...overrides,
  };
}

export function makeAmmo(overrides: Partial<Ammo> = {}): Ammo {
  return {
    id: '556-ball-30',
    name: '5.56 Ball · 30rd',
    caliber: '5.56',
    roundsPerMag: 30,
    weightKg: 0.4,
    cost: 25,
    slotFootprint: {},
    hardpointNeeds: [],
    internalSlots: {},
    damageBonus: 0,
    penetrationBonus: 0,
    ...overrides,
  };
}

/**
 * Build a content lookup from arrays of fixtures. Tests don't need the full
 * ContentBundle — just the id→object resolver for weapons/armor/utility/ammo.
 */
export function makeContent(
  weapons: Weapon[] = [],
  armor: Armor[] = [],
  utility: Utility[] = [],
  ammo: Ammo[] = [],
): ContentLookup {
  return {
    weapon: (id) => weapons.find((w) => w.id === id),
    armor: (id) => armor.find((a) => a.id === id),
    utility: (id) => utility.find((u) => u.id === id),
    ammo: (id) => ammo.find((a) => a.id === id),
  };
}

/**
 * Build a Loadout from items, which is the new post-rework shape (zone-packed).
 */
export function makeLoadout(items: Loadout['items'] = []): Loadout {
  return { items: [...items] };
}
