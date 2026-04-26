import type { Contract } from '@schema/contract';
import { describe, expect, it } from 'vitest';
import { bindObjectivesToAnchors, mapGenRequestFromContract } from './contract-binder';
import type { ObjectiveAnchor } from './types';

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'c-1',
    name: 'Test',
    mapId: 'm',
    payout: {
      cash: 100,
      salvagePriorityPicks: 0,
      reputationDelta: 0,
      secondaryBonusCash: 0,
      goodFaithFraction: 0,
    },
    deployCost: { fixedPerContract: 10 },
    recommendedOperators: { green: 1, regular: 1, veteran: 0 },
    difficultyRating: 1,
    modifiers: {
      extractionSeats: null,
      requiredRoleTags: [],
      biomeHint: null,
      sizeHint: 'medium',
    },
    briefing: 'b',
    objectives: [{ id: 'o-1', kind: 'secure', description: 'k' }],
    enemies: { factionId: 'f', archetypes: [{ archetype: 'a', count: 1 }] },
    minOperators: 1,
    maxOperators: 4,
    ...overrides,
  } as Contract;
}

describe('contract binder', () => {
  it('honors an authored biomeHint', () => {
    const c = makeContract({
      modifiers: {
        extractionSeats: null,
        requiredRoleTags: [],
        biomeHint: 'urban_sparse',
        sizeHint: 'small',
      },
    });
    const req = mapGenRequestFromContract(c, 1.5, 1);
    expect(req.biome).toBe('urban_sparse');
    // ADR 014 §Pillar A — 4096-tile maps are the target. small/medium/large
    // map onto 1024/2048/4096 via CONTRACT_SIZE_TILES.
    expect(req.size).toBe(1024);
  });

  it('falls back to rural_open for extract objectives', () => {
    const c = makeContract({
      objectives: [{ id: 'o-1', kind: 'extract', description: 'pick up' }],
    });
    const req = mapGenRequestFromContract(c, 1.5, 1);
    expect(req.biome).toBe('rural_open');
  });

  it('falls back to urban_sparse for secure-only contracts', () => {
    const c = makeContract({
      objectives: [{ id: 'o-1', kind: 'secure', description: 'hold' }],
    });
    const req = mapGenRequestFromContract(c, 1.5, 1);
    expect(req.biome).toBe('urban_sparse');
  });

  it('binds each objective to the best-matching anchor by kind', () => {
    const c = makeContract({
      objectives: [
        { id: 'sec', kind: 'secure', description: 'hold' },
        { id: 'ext', kind: 'extract', description: 'x' },
      ],
    });
    const anchors: ObjectiveAnchor[] = [
      { kindHint: 'secure', rect: { x: 20, y: 20, w: 4, h: 4 }, qualityScore: 1.0 },
      { kindHint: 'extract', rect: { x: 50, y: 50, w: 5, h: 5 }, qualityScore: 0.8 },
      { kindHint: 'defend', rect: { x: 0, y: 0, w: 10, h: 10 }, qualityScore: 0.9 },
    ];
    const bound = bindObjectivesToAnchors(c, anchors);
    expect(bound.get('sec')).toEqual({ x: 20, y: 20, w: 4, h: 4 });
    expect(bound.get('ext')).toEqual({ x: 50, y: 50, w: 5, h: 5 });
  });

  it('seeds the generator request from the contract id (deterministic)', () => {
    const c = makeContract({ id: 'c-abc' });
    const r1 = mapGenRequestFromContract(c, 1.5, 1);
    const r2 = mapGenRequestFromContract(c, 1.5, 1);
    expect(r1.seed).toBe('c-abc');
    expect(r2.seed).toBe('c-abc');
  });
});
