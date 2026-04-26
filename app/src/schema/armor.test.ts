// ADR 016 §Q10. Schema-level tests for the new resistance fields on
// `ArmorPlacement`.

import { describe, expect, it } from 'vitest';
import { ArmorPlacement } from './armor';

describe('ArmorPlacement', () => {
  it('accepts the new resistance fields', () => {
    const p = ArmorPlacement.parse({
      zone: 'torso_front',
      damageReduction: 70,
      weightKg: 4.5,
      plate: 'hard',
      penetrationResistance: 60,
      fireResistance: 0,
      empResistance: 0,
    });
    expect(p.penetrationResistance).toBe(60);
    expect(p.fireResistance).toBe(0);
    expect(p.empResistance).toBe(0);
  });

  it('defaults the three resistance fields to 0 when omitted', () => {
    // Existing content written before ADR 016 may not declare the new
    // fields. Zod's `.default(0)` should fill them in at parse time so the
    // migration is non-breaking for already-authored armor.
    const p = ArmorPlacement.parse({
      zone: 'torso_front',
      damageReduction: 70,
      weightKg: 4.5,
      plate: 'hard',
    });
    expect(p.penetrationResistance).toBe(0);
    expect(p.fireResistance).toBe(0);
    expect(p.empResistance).toBe(0);
  });

  it('rejects values above 100', () => {
    expect(() =>
      ArmorPlacement.parse({
        zone: 'torso_front',
        damageReduction: 70,
        weightKg: 4.5,
        plate: 'hard',
        penetrationResistance: 150,
      }),
    ).toThrow();
  });

  it('rejects negative resistance values', () => {
    expect(() =>
      ArmorPlacement.parse({
        zone: 'torso_front',
        damageReduction: 70,
        weightKg: 4.5,
        plate: 'hard',
        fireResistance: -10,
      }),
    ).toThrow();
  });
});
