import type { Contract } from '@schema/contract';
import type { Operator } from '@schema/operator';
import { describe, expect, it } from 'vitest';
import {
  computeDeployCost,
  computeNetEconomics,
  computePayoutBreakdown,
} from './contract-economics';

function contract(overrides: Partial<Contract> = {}): Contract {
  const base: Contract = {
    id: 'c',
    name: 'C',
    mapId: 'm',
    payout: {
      cash: 1000,
      salvagePriorityPicks: 0,
      reputationDelta: 0,
      secondaryBonusCash: 0,
      goodFaithFraction: 0,
    },
    deployCost: { fixedPerContract: 100 },
    recommendedOperators: { green: 3, regular: 2, veteran: 1 },
    difficultyRating: 2,
    modifiers: { extractionSeats: 4, requiredRoleTags: [] },
    briefing: 'b',
    objectives: [{ id: 'obj', kind: 'eliminate', description: 'go' }],
    enemies: { factionId: 'f', archetypes: [{ archetype: 'a', count: 1 }] },
    minOperators: 1,
    maxOperators: 4,
  };
  return { ...base, ...overrides } as Contract;
}

function op(overrides: Partial<Operator> = {}): Operator {
  return {
    id: 'x',
    name: 'X',
    callsign: 'X',
    tier: 'regular',
    stats: { aim: 50, move: 50, grit: 50, awareness: 50, medical: 50 },
    defaultTemplateId: 't',
    origin: '',
    bio: '',
    cost: 0,
    dailyWage: 100,
    insurancePremium: 50,
    ...overrides,
  };
}

describe('computeDeployCost', () => {
  it('equals fixed cost alone when no operators deployed', () => {
    const d = computeDeployCost(contract(), []);
    expect(d.total).toBe(100);
    expect(d.perOperatorWages).toBe(0);
    expect(d.perOperatorPremiums).toBe(0);
  });

  it('sums wages and premiums across mixed tiers', () => {
    const d = computeDeployCost(contract(), [
      op({ dailyWage: 80, insurancePremium: 40 }),
      op({ dailyWage: 150, insurancePremium: 80 }),
      op({ dailyWage: 280, insurancePremium: 160 }),
    ]);
    expect(d.fixed).toBe(100);
    expect(d.perOperatorWages).toBe(510);
    expect(d.perOperatorPremiums).toBe(280);
    expect(d.total).toBe(890);
  });
});

describe('computePayoutBreakdown', () => {
  it('computes cashFloor via goodFaithFraction', () => {
    const b = computePayoutBreakdown(
      contract({
        payout: {
          cash: 1000,
          salvagePriorityPicks: 0,
          reputationDelta: 0,
          secondaryBonusCash: 0,
          goodFaithFraction: 0.25,
        },
      }),
    );
    expect(b.cashFloor).toBe(250);
    expect(b.cashFull).toBe(1000);
  });

  it('handles 0 and 1 good-faith fraction', () => {
    expect(
      computePayoutBreakdown(
        contract({
          payout: {
            cash: 500,
            salvagePriorityPicks: 0,
            reputationDelta: 0,
            secondaryBonusCash: 0,
            goodFaithFraction: 0,
          },
        }),
      ).cashFloor,
    ).toBe(0);
    expect(
      computePayoutBreakdown(
        contract({
          payout: {
            cash: 500,
            salvagePriorityPicks: 0,
            reputationDelta: 0,
            secondaryBonusCash: 0,
            goodFaithFraction: 1,
          },
        }),
      ).cashFloor,
    ).toBe(500);
  });
});

describe('computeNetEconomics', () => {
  it('netIfPrimarySuccess = cash + bonus - total cost', () => {
    const c = contract({
      payout: {
        cash: 1000,
        salvagePriorityPicks: 0,
        reputationDelta: 0,
        secondaryBonusCash: 300,
        goodFaithFraction: 0.3,
      },
      deployCost: { fixedPerContract: 100 },
    });
    const ops = [
      op({ dailyWage: 100, insurancePremium: 50 }),
      op({ dailyWage: 100, insurancePremium: 50 }),
    ];
    const n = computeNetEconomics(c, ops);
    expect(n.deployCost.total).toBe(400);
    expect(n.netIfPrimarySuccess).toBe(900);
    expect(n.netIfPrimaryFailGoodFaith).toBe(-100); // 300 - 400
  });
});
