import type { Loadout } from '@sim/loadout';
import { makeContent, makeLightArmor, makeWeapon } from '@test-helpers/fixtures';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLoadouts } from '../stores/loadouts';
import { useStockpile } from '../stores/stockpile';
import { equipLoadout, unequipLoadout } from './equip';

const rifle = makeWeapon();
const lightArmor = makeLightArmor({
  placements: [{ zone: 'torso_front', damageReduction: 20, weightKg: 2, plate: 'soft' }],
});
const content = makeContent([rifle], [lightArmor]);

const ld: Loadout = {
  items: [
    { type: 'weapon', id: rifle.id, zone: 'right_hand' },
    { type: 'armor', id: lightArmor.id, zone: 'torso_front' },
  ],
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
    const stored = useLoadouts.getState().get('op-1');
    expect(stored.items.some((i) => i.id === lightArmor.id)).toBe(true);
  });

  it('unequip returns items to stockpile', () => {
    useStockpile.getState().add(rifle.id, 1);
    useStockpile.getState().add(lightArmor.id, 1);
    equipLoadout('op-1', ld, content);
    unequipLoadout('op-1');
    expect(useStockpile.getState().available(rifle.id)).toBe(1);
    expect(useStockpile.getState().available(lightArmor.id)).toBe(1);
    expect(useLoadouts.getState().get('op-1').items.length).toBe(0);
  });

  it('swapping identical loadouts is a no-op diff', () => {
    useStockpile.getState().add(rifle.id, 1);
    useStockpile.getState().add(lightArmor.id, 2);
    equipLoadout('op-1', ld, content);
    const r = equipLoadout('op-1', { items: [...ld.items] }, content);
    expect(r.ok).toBe(true);
    expect(useStockpile.getState().available(lightArmor.id)).toBe(1);
  });
});
