import {
  makeChestRig,
  makeContent,
  makeHeavyArmor,
  makeLightArmor,
  makeLoadout,
  makeMagBin,
  makePistol,
  makeWeapon,
} from '@test-helpers/fixtures';
import { describe, expect, it } from 'vitest';
import { computeFit, defaultBodyProfile } from './loadoutFit';

describe('computeFit', () => {
  it('accepts a minimal valid loadout', () => {
    const rifle = makeWeapon({ slotFootprint: { right_hand: 2 } });
    const pistol = makePistol({ slotFootprint: { waist: 1 } });
    const plate = makeLightArmor({
      slotFootprint: { torso_front: 2, torso_back: 2 },
      hardpointNeeds: [
        { zone: 'torso_front', kind: 'plate_mount' },
        { zone: 'torso_back', kind: 'plate_mount' },
      ],
    });
    const content = makeContent([rifle, pistol], [plate]);
    const loadout = makeLoadout([
      { type: 'weapon', id: rifle.id, zone: 'right_hand' },
      { type: 'weapon', id: pistol.id, zone: 'waist' },
      { type: 'armor', id: plate.id, zone: 'torso_front' },
    ]);
    const fit = computeFit(loadout, defaultBodyProfile(), content);
    expect(fit.valid).toBe(true);
    expect(fit.errors).toHaveLength(0);
  });

  it('reports zone_slot_overflow when slots are packed over capacity', () => {
    const big = makeWeapon({ id: 'big', slotFootprint: { right_hand: 2 } });
    const big2 = makeWeapon({ id: 'big2', slotFootprint: { right_hand: 2 } });
    const big3 = makeWeapon({ id: 'big3', slotFootprint: { right_hand: 2 } });
    const content = makeContent([big, big2, big3], [], []);
    const loadout = makeLoadout([
      { type: 'weapon', id: big.id, zone: 'right_hand' },
      { type: 'weapon', id: big2.id, zone: 'right_hand' },
      { type: 'weapon', id: big3.id, zone: 'right_hand' },
    ]);
    const fit = computeFit(loadout, defaultBodyProfile(), content);
    expect(fit.valid).toBe(false);
    expect(fit.errors.some((e) => e.kind === 'zone_slot_overflow' && e.zone === 'right_hand')).toBe(
      true,
    );
  });

  it('reports global_kg_overflow when total weight exceeds the budget', () => {
    const brick = makeHeavyArmor({ id: 'brick1' });
    const brick2 = makeHeavyArmor({ id: 'brick2' });
    const content = makeContent([], [brick, brick2], []);
    const loadout = makeLoadout([
      { type: 'armor', id: brick.id, zone: 'torso_front' },
      { type: 'armor', id: brick2.id, zone: 'torso_back' },
    ]);
    const fit = computeFit(loadout, defaultBodyProfile(), content);
    expect(fit.errors.some((e) => e.kind === 'global_kg_overflow')).toBe(true);
  });

  it('reports hardpoint_missing when zone lacks the required mount', () => {
    const plate = makeLightArmor({
      hardpointNeeds: [{ zone: 'torso_front', kind: 'plate_mount' }],
    });
    const content = makeContent([], [plate], []);
    const loadout = makeLoadout([{ type: 'armor', id: plate.id, zone: 'torso_front' }]);
    const body = defaultBodyProfile();
    // Strip plate_mount from torso_front.
    body.hardpoints.torso_front = body.hardpoints.torso_front.filter(
      (h) => h.kind !== 'plate_mount',
    );
    const fit = computeFit(loadout, body, content);
    expect(
      fit.errors.some(
        (e) =>
          e.kind === 'hardpoint_missing' &&
          e.zone === 'torso_front' &&
          e.hardpoint === 'plate_mount',
      ),
    ).toBe(true);
  });

  it('places consumable bins into host internal slots when available', () => {
    const rig = makeChestRig();
    const mag1 = makeMagBin({ id: 'mag-1' });
    const mag2 = makeMagBin({ id: 'mag-2' });
    const mag3 = makeMagBin({ id: 'mag-3' });
    const content = makeContent([], [], [rig, mag1, mag2, mag3]);
    const loadout = makeLoadout([
      { type: 'utility', id: rig.id, zone: 'torso_front' },
      { type: 'utility', id: mag1.id, zone: 'torso_front' },
      { type: 'utility', id: mag2.id, zone: 'torso_front' },
      { type: 'utility', id: mag3.id, zone: 'torso_front' },
    ]);
    const fit = computeFit(loadout, defaultBodyProfile(), content);
    expect(fit.valid).toBe(true);
    const usage = fit.internalUsage.find((u) => u.category === 'mag_rifle');
    expect(usage?.used).toBe(3);
    expect(usage?.cap).toBe(4);
  });

  it('falls back to a bare pouch_mount when no host covers the category', () => {
    const mag = makeMagBin();
    const content = makeContent([], [], [mag]);
    const loadout = makeLoadout([{ type: 'utility', id: mag.id, zone: 'waist' }]);
    const fit = computeFit(loadout, defaultBodyProfile(), content);
    expect(fit.valid).toBe(true);
    expect(fit.perZone.waist.hardpointsUsed.pouch_mount).toBe(1);
  });

  it('reports consumable_no_host when bin has neither host nor hardpoint', () => {
    const mag = makeMagBin();
    const content = makeContent([], [], [mag]);
    // Spawn the bin in head (no pouch_mount on default body).
    const loadout = makeLoadout([{ type: 'utility', id: mag.id, zone: 'head' }]);
    const fit = computeFit(loadout, defaultBodyProfile(), content);
    expect(fit.valid).toBe(false);
    expect(fit.errors.some((e) => e.kind === 'consumable_no_host' && e.itemId === mag.id)).toBe(
      true,
    );
    expect(fit.unhostedBins.map((u) => u.itemId)).toContain(mag.id);
  });

  it('spreads a multi-zone footprint across declared zones', () => {
    const vest = makeHeavyArmor({
      slotFootprint: {
        torso_front: 4,
        torso_back: 4,
        left_arm: 1,
        right_arm: 1,
        waist: 2,
      },
    });
    const content = makeContent([], [vest], []);
    const loadout = makeLoadout([{ type: 'armor', id: vest.id, zone: 'torso_front' }]);
    const fit = computeFit(loadout, defaultBodyProfile(), content);
    expect(fit.perZone.torso_front.slotsUsed).toBe(4);
    expect(fit.perZone.torso_back.slotsUsed).toBe(4);
    expect(fit.perZone.left_arm.slotsUsed).toBe(1);
    expect(fit.perZone.right_arm.slotsUsed).toBe(1);
    expect(fit.perZone.waist.slotsUsed).toBe(2);
  });
});
