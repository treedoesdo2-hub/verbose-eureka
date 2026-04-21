import type { LoadoutTemplate } from '@schema/template';
import {
  makeContent,
  makeHeavyArmor,
  makeLightArmor,
  makeLmg,
  makeMedkit,
  makePistol,
  makeWeapon,
} from '@test-helpers/fixtures';
import { describe, expect, it } from 'vitest';
import type { Loadout } from './loadout';
import {
  deriveCombatProfile,
  emptyLoadout,
  INFANTRY_WEIGHT_KG_BUDGET,
  loadoutFromTemplate,
  validateLoadout,
} from './loadout';

const rifle = makeWeapon();
const lmg = makeLmg();
const pistol = makePistol();
const lightArmor = makeLightArmor();
const heavyArmor = makeHeavyArmor();
const medkit = makeMedkit();
const content = makeContent([rifle, lmg, pistol], [lightArmor, heavyArmor], [medkit]);

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
