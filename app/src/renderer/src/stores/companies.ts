// Company + Battalion stores (#533 / ADR 016 §S7).
//
// The S7 ORBAT screen previously fell back to grouping squads by branch
// because no Company/Battalion content existed. This store seeds a
// default battalion and three companies so the org tree is real.
// Squads are linked to companies via `squad.companyId`; the ORBAT
// screen reads from these stores to render the column header
// (designator + name) and the battalion banner (designator + motto).
//
// Persistence: Zustand + localStorage, like the squads store. On first
// load we seed the defaults; subsequent loads honor whatever the
// player has authored.

import {
  type Battalion,
  type Company,
  newBattalionId,
  newCompanyId,
} from '@schema/squad';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const storage = createJSONStorage<CompaniesState>(
  () =>
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage
      : noopStorage,
);

export type CompaniesState = {
  battalion: Battalion;
  companies: readonly Company[];
};

// Default battalion + companies. The battalion is "PAYROLL"; companies
// are organized by broad branch family (combat / support / staff) so
// every authored squad slots cleanly into one of them. This matches the
// 3-column ORBAT mockup the design provides.
function seedDefaults(): CompaniesState {
  const bnId = newBattalionId();
  return {
    battalion: {
      id: bnId,
      name: '"PAYROLL" Private Military Battalion',
      designator: '1ST BN',
      motto: 'CASH ON DELIVERY',
    },
    companies: [
      {
        id: newCompanyId(),
        name: 'Alpha — Combat',
        designator: 'A CO',
        branch: 'infantry',
        battalionId: bnId,
      },
      {
        id: newCompanyId(),
        name: 'Bravo — Support',
        designator: 'B CO',
        branch: 'support',
        battalionId: bnId,
      },
      {
        id: newCompanyId(),
        name: 'Headquarters',
        designator: 'HQ CO',
        branch: 'command',
        battalionId: bnId,
      },
    ],
  };
}

export const useCompanies = create<CompaniesState>()(
  persist(immer(() => seedDefaults()), {
    name: 'merc-autobattler-companies-v1',
    storage,
  }),
);

// Map a squad branch onto the canonical company id for that branch.
// Combat branches → A CO; support family → B CO; command → HQ.
export function defaultCompanyForBranch(
  state: CompaniesState,
  branch: Company['branch'],
): Company | undefined {
  const combatBranches = new Set<Company['branch']>(['infantry', 'recon', 'mechanized']);
  const supportBranches = new Set<Company['branch']>(['support', 'medical', 'engineering']);
  if (combatBranches.has(branch)) return state.companies.find((c) => c.designator === 'A CO');
  if (supportBranches.has(branch)) return state.companies.find((c) => c.designator === 'B CO');
  if (branch === 'command') return state.companies.find((c) => c.designator === 'HQ CO');
  return state.companies[0];
}
