import { describe, expect, it } from 'vitest';
import { loadContent } from './loader';

describe('content loader', () => {
  it('loads all content groups without error', () => {
    const bundle = loadContent();
    expect(bundle.operators.size).toBeGreaterThanOrEqual(10);
    expect(bundle.weapons.size).toBeGreaterThanOrEqual(3);
    expect(bundle.armor.size).toBeGreaterThanOrEqual(2);
    expect(bundle.utility.size).toBeGreaterThanOrEqual(3);
    expect(bundle.factions.size).toBeGreaterThanOrEqual(1);
    expect(bundle.contracts.size).toBeGreaterThanOrEqual(2);
    expect(bundle.maps.size).toBeGreaterThanOrEqual(1);
    expect(bundle.templates.size).toBeGreaterThanOrEqual(4);
  });

  it('operator default templates resolve', () => {
    const bundle = loadContent();
    for (const op of bundle.operators.values()) {
      expect(bundle.templates.has(op.defaultTemplateId)).toBe(true);
    }
  });

  it('contract maps exist', () => {
    const bundle = loadContent();
    for (const c of bundle.contracts.values()) {
      expect(bundle.maps.has(c.mapId)).toBe(true);
    }
  });

  it('faction templates resolve', () => {
    const bundle = loadContent();
    for (const f of bundle.factions.values()) {
      for (const m of f.roster) {
        expect(bundle.templates.has(m.loadoutTemplateId)).toBe(true);
      }
    }
  });

  it('template weapon/armor/utility ids resolve', () => {
    const bundle = loadContent();
    for (const t of bundle.templates.values()) {
      if (t.primaryWeaponId) expect(bundle.weapons.has(t.primaryWeaponId)).toBe(true);
      if (t.sidearmId) expect(bundle.weapons.has(t.sidearmId)).toBe(true);
      if (t.armorId) expect(bundle.armor.has(t.armorId)).toBe(true);
      for (const uid of t.utilityIds) expect(bundle.utility.has(uid)).toBe(true);
    }
  });
});
