import type { Armor } from '@schema/armor';
import type { Weapon } from '@schema/weapon';
import { asArmorId, asWeaponId } from '@shared/ids';
import type { ContentLookup, Loadout } from '@sim/loadout';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLoadouts } from '../stores/loadouts';
import { useStockpile } from '../stores/stockpile';
import { equipLoadout, unequipLoadout } from './equip';

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

const lightArmor: Armor = {
  id: asArmorId('light'),
  name: 'Light',
  class: 'light',
  mobilityPenalty: 5,
  cost: 400,
  placements: [{ zone: 'torso_front', damageReduction: 20, tonnage: 2 }],
};

const content: ContentLookup = {
  weapon: (id) => (id === rifle.id ? rifle : undefined),
  armor: (id) => (id === lightArmor.id ? lightArmor : undefined),
  utility: () => undefined,
};

const ld: Loadout = {
  primaryWeaponId: rifle.id,
  sidearmId: null,
  armorId: lightArmor.id,
  utilityIds: [],
};

describe('equip service', () => {
  beforeEach(() => {
    useLoadouts.setState({ byOperator: new Map() });
    useStockpile.setState({ quantities: new Map() });
  });

  it('fails when stockpile is empty', () => {
    const r = equipLoadout('op-1', ld, content);
    expect(r.ok).toBe(false);
  });

  it('succeeds when stockpile has items, and removes them', () => {
    useStockpile.getState().add(rifle.id, 1);
    useStockpile.getState().add(lightArmor.id, 1);
    const r = equipLoadout('op-1', ld, content);
    expect(r.ok).toBe(true);
    expect(useStockpile.getState().available(rifle.id)).toBe(0);
    expect(useStockpile.getState().available(lightArmor.id)).toBe(0);
    expect(useLoadouts.getState().get('op-1').armorId).toBe(lightArmor.id);
  });

  it('unequip returns items to stockpile', () => {
    useStockpile.getState().add(rifle.id, 1);
    useStockpile.getState().add(lightArmor.id, 1);
    equipLoadout('op-1', ld, content);
    unequipLoadout('op-1');
    expect(useStockpile.getState().available(rifle.id)).toBe(1);
    expect(useStockpile.getState().available(lightArmor.id)).toBe(1);
    expect(useLoadouts.getState().get('op-1').primaryWeaponId).toBe(null);
  });

  it('swapping loadouts diffs correctly', () => {
    useStockpile.getState().add(rifle.id, 1);
    useStockpile.getState().add(lightArmor.id, 2);
    equipLoadout('op-1', ld, content);
    const next: Loadout = { ...ld };
    const r = equipLoadout('op-1', next, content);
    expect(r.ok).toBe(true);
    expect(useStockpile.getState().available(lightArmor.id)).toBe(1);
  });
});
