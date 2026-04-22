import type { Contract } from '@schema/contract';
import type { Operator } from '@schema/operator';

export type DeployCostLine = {
  readonly label: string;
  readonly amount: number;
  readonly per?: 'operator' | 'contract';
};

export type DeployCostBreakdown = {
  readonly fixed: number;
  readonly perOperatorWages: number;
  readonly perOperatorPremiums: number;
  readonly total: number;
  readonly lines: readonly DeployCostLine[];
};

export type PayoutLine = {
  readonly label: string;
  readonly amount: number;
  readonly note?: string;
};

export type PayoutBreakdown = {
  readonly cashFloor: number;
  readonly cashFull: number;
  readonly secondaryBonusCash: number;
  readonly salvagePriorityPicks: number;
  readonly reputationDelta: number;
  readonly lines: readonly PayoutLine[];
};

export type NetEconomics = {
  readonly deployCost: DeployCostBreakdown;
  readonly payout: PayoutBreakdown;
  readonly netIfPrimarySuccess: number;
  readonly netIfPrimaryFailGoodFaith: number;
};

export function computeDeployCost(
  contract: Contract,
  deployedOperators: readonly Operator[],
): DeployCostBreakdown {
  const fixed = contract.deployCost.fixedPerContract;
  let perOperatorWages = 0;
  let perOperatorPremiums = 0;
  for (const op of deployedOperators) {
    perOperatorWages += op.dailyWage;
    perOperatorPremiums += op.insurancePremium;
  }
  const total = fixed + perOperatorWages + perOperatorPremiums;
  const lines: DeployCostLine[] = [
    { label: 'fixed contract cost', amount: fixed, per: 'contract' },
    { label: 'wages (daily)', amount: perOperatorWages, per: 'operator' },
    { label: 'insurance premiums', amount: perOperatorPremiums, per: 'operator' },
  ];
  return { fixed, perOperatorWages, perOperatorPremiums, total, lines };
}

export function computePayoutBreakdown(contract: Contract): PayoutBreakdown {
  const p = contract.payout;
  const cashFloor = Math.floor(p.cash * p.goodFaithFraction);
  const lines: PayoutLine[] = [
    { label: 'cash on success', amount: p.cash },
    {
      label: 'secondary bonus cash',
      amount: p.secondaryBonusCash,
      note: 'paid only if all secondary objectives complete',
    },
    {
      label: 'cash on partial failure',
      amount: cashFloor,
      note: `${Math.round(p.goodFaithFraction * 100)}% good-faith payment`,
    },
    { label: 'salvage priority picks', amount: p.salvagePriorityPicks },
    { label: 'reputation', amount: p.reputationDelta },
  ];
  return {
    cashFloor,
    cashFull: p.cash,
    secondaryBonusCash: p.secondaryBonusCash,
    salvagePriorityPicks: p.salvagePriorityPicks,
    reputationDelta: p.reputationDelta,
    lines,
  };
}

export function computeNetEconomics(
  contract: Contract,
  deployedOperators: readonly Operator[],
): NetEconomics {
  const deployCost = computeDeployCost(contract, deployedOperators);
  const payout = computePayoutBreakdown(contract);
  return {
    deployCost,
    payout,
    netIfPrimarySuccess: payout.cashFull + payout.secondaryBonusCash - deployCost.total,
    netIfPrimaryFailGoodFaith: payout.cashFloor - deployCost.total,
  };
}
