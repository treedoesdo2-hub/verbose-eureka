import {
  makeAmmo,
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

  // ── ADR 016 §Q14c — armor placement-overlap validation ────────────────
  describe('armor_zone_occupied (one armor item per zone)', () => {
    it('rejects two chest-covering armor items in the same loadout', () => {
      const a = makeLightArmor({
        id: 'plate-a',
        placements: [
          {
            zone: 'torso_front',
            damageReduction: 30,
            weightKg: 2,
            plate: 'soft',
            penetrationResistance: 0,
            fireResistance: 0,
            empResistance: 0,
          },
        ],
        slotFootprint: { torso_front: 1 },
        hardpointNeeds: [],
      });
      const b = makeLightArmor({
        id: 'plate-b',
        placements: [
          {
            zone: 'torso_front',
            damageReduction: 30,
            weightKg: 2,
            plate: 'soft',
            penetrationResistance: 0,
            fireResistance: 0,
            empResistance: 0,
          },
        ],
        slotFootprint: { torso_front: 1 },
        hardpointNeeds: [],
      });
      const content = makeContent([], [a, b], []);
      const loadout = makeLoadout([
        { type: 'armor', id: a.id, zone: 'torso_front' },
        { type: 'armor', id: b.id, zone: 'torso_front' },
      ]);
      const fit = computeFit(loadout, defaultBodyProfile(), content);
      expect(fit.valid).toBe(false);
      expect(
        fit.errors.some(
          (e) => e.kind === 'armor_zone_occupied' && e.zone === 'torso_front',
        ),
      ).toBe(true);
    });

    it('accepts non-overlapping armor items (plate carrier + boots)', () => {
      const carrier = makeLightArmor({
        id: 'carrier',
        placements: [
          {
            zone: 'torso_front',
            damageReduction: 30,
            weightKg: 2,
            plate: 'soft',
            penetrationResistance: 0,
            fireResistance: 0,
            empResistance: 0,
          },
          {
            zone: 'torso_back',
            damageReduction: 30,
            weightKg: 2,
            plate: 'soft',
            penetrationResistance: 0,
            fireResistance: 0,
            empResistance: 0,
          },
        ],
        slotFootprint: { torso_front: 1, torso_back: 1 },
        hardpointNeeds: [],
      });
      const boots = makeLightArmor({
        id: 'boots',
        placements: [
          {
            zone: 'left_leg',
            damageReduction: 10,
            weightKg: 0.5,
            plate: 'soft',
            penetrationResistance: 0,
            fireResistance: 0,
            empResistance: 0,
          },
          {
            zone: 'right_leg',
            damageReduction: 10,
            weightKg: 0.5,
            plate: 'soft',
            penetrationResistance: 0,
            fireResistance: 0,
            empResistance: 0,
          },
        ],
        slotFootprint: { left_leg: 1, right_leg: 1 },
        hardpointNeeds: [],
      });
      const content = makeContent([], [carrier, boots], []);
      const loadout = makeLoadout([
        { type: 'armor', id: carrier.id, zone: 'torso_front' },
        { type: 'armor', id: boots.id, zone: 'left_leg' },
      ]);
      const fit = computeFit(loadout, defaultBodyProfile(), content);
      expect(
        fit.errors.some((e) => e.kind === 'armor_zone_occupied'),
      ).toBe(false);
    });

    // ── ADR 016 ammo task #281.10 — caliber-match validation ────────────
    it('does not concern itself with ammo (covered by separate suite)', () => {
      // Sanity: armor_zone_occupied must not fire when ammo items are present.
      const carrier = makeLightArmor({
        id: 'carrier-y',
        placements: [
          {
            zone: 'torso_front',
            damageReduction: 30,
            weightKg: 2,
            plate: 'soft',
            penetrationResistance: 0,
            fireResistance: 0,
            empResistance: 0,
          },
        ],
        slotFootprint: { torso_front: 1 },
        hardpointNeeds: [],
      });
      const rifle = makeWeapon({ caliber: '5.56' });
      const ammo = makeAmmo();
      const content = makeContent([rifle], [carrier], [], [ammo]);
      const loadout = makeLoadout([
        { type: 'weapon', id: rifle.id, zone: 'right_hand' },
        { type: 'armor', id: carrier.id, zone: 'torso_front' },
        { type: 'ammo', id: ammo.id, zone: 'torso_front' },
      ]);
      const fit = computeFit(loadout, defaultBodyProfile(), content);
      expect(fit.errors.some((e) => e.kind === 'armor_zone_occupied')).toBe(false);
    });

    it('does not flag non-armor items sharing a zone with armor', () => {
      const carrier = makeLightArmor({
        id: 'carrier-x',
        placements: [
          {
            zone: 'torso_front',
            damageReduction: 30,
            weightKg: 2,
            plate: 'soft',
            penetrationResistance: 0,
            fireResistance: 0,
            empResistance: 0,
          },
        ],
        slotFootprint: { torso_front: 1 },
        hardpointNeeds: [],
      });
      const rig = makeChestRig();
      const content = makeContent([], [carrier], [rig]);
      const loadout = makeLoadout([
        { type: 'armor', id: carrier.id, zone: 'torso_front' },
        { type: 'utility', id: rig.id, zone: 'torso_front' },
      ]);
      const fit = computeFit(loadout, defaultBodyProfile(), content);
      expect(
        fit.errors.some((e) => e.kind === 'armor_zone_occupied'),
      ).toBe(false);
    });
  });

  // ── ADR 016 ammo task #281.10 — caliber-match validation ──────────────
  describe('ammo_missing (caliber match)', () => {
    it('flags a weapon whose caliber has no carried ammo', () => {
      const rifle = makeWeapon({ id: 'ar-556', caliber: '5.56' });
      const content = makeContent([rifle], [], [], []);
      const loadout = makeLoadout([{ type: 'weapon', id: rifle.id, zone: 'right_hand' }]);
      const fit = computeFit(loadout, defaultBodyProfile(), content);
      expect(fit.valid).toBe(false);
      expect(
        fit.errors.some(
          (e) => e.kind === 'ammo_missing' && e.weaponId === rifle.id && e.caliber === '5.56',
        ),
      ).toBe(true);
    });

    it('passes when matching-caliber ammo is carried', () => {
      const rifle = makeWeapon({ id: 'ar-556', caliber: '5.56' });
      const ammo = makeAmmo({ id: '556-30', caliber: '5.56' });
      const content = makeContent([rifle], [], [], [ammo]);
      const loadout = makeLoadout([
        { type: 'weapon', id: rifle.id, zone: 'right_hand' },
        { type: 'ammo', id: ammo.id, zone: 'torso_front' },
      ]);
      const fit = computeFit(loadout, defaultBodyProfile(), content);
      expect(fit.errors.some((e) => e.kind === 'ammo_missing')).toBe(false);
    });

    it('flags caliber mismatch (carries 7.62 for a 5.56 rifle)', () => {
      const rifle = makeWeapon({ id: 'ar-556', caliber: '5.56' });
      const wrong = makeAmmo({ id: '762-20', caliber: '7.62' });
      const content = makeContent([rifle], [], [], [wrong]);
      const loadout = makeLoadout([
        { type: 'weapon', id: rifle.id, zone: 'right_hand' },
        { type: 'ammo', id: wrong.id, zone: 'torso_front' },
      ]);
      const fit = computeFit(loadout, defaultBodyProfile(), content);
      expect(
        fit.errors.some(
          (e) => e.kind === 'ammo_missing' && e.weaponId === rifle.id && e.caliber === '5.56',
        ),
      ).toBe(true);
    });

    it('skips weapons with no caliber metadata (legacy content)', () => {
      // Pre-migration weapons may have ballistics.caliberMm set to a value
      // that doesn't map to the Caliber enum (e.g. an exotic test value).
      // weaponCaliber() returns null in that case → no ammo_missing.
      const exotic = makeWeapon({
        id: 'exotic-99',
        ballistics: { caliberMm: 99, velocityMps: 900, massGrams: 4, penetration: 45 },
      });
      const content = makeContent([exotic], [], [], []);
      const loadout = makeLoadout([{ type: 'weapon', id: exotic.id, zone: 'right_hand' }]);
      const fit = computeFit(loadout, defaultBodyProfile(), content);
      expect(fit.errors.some((e) => e.kind === 'ammo_missing')).toBe(false);
    });

    it('skips entirely when ContentLookup has no ammo() method', () => {
      // ContentLookup.ammo is optional during the migration; lookups
      // without it must not trip ammo_missing.
      const rifle = makeWeapon({ id: 'ar-556', caliber: '5.56' });
      const lookupWithoutAmmo = {
        weapon: (id: string) => (id === rifle.id ? rifle : undefined),
        armor: () => undefined,
        utility: () => undefined,
      };
      const loadout = makeLoadout([{ type: 'weapon', id: rifle.id, zone: 'right_hand' }]);
      const fit = computeFit(loadout, defaultBodyProfile(), lookupWithoutAmmo);
      expect(fit.errors.some((e) => e.kind === 'ammo_missing')).toBe(false);
    });
  });
});
