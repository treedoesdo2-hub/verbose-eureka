import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type CampaignState = {
  currency: number;
  turn: number;
  availableContracts: string[];
  activeContract: string | null;
  deployed: string[];
  addCurrency: (n: number) => void;
  spendCurrency: (n: number) => boolean;
  advanceTurn: () => void;
  setAvailableContracts: (ids: string[]) => void;
  activateContract: (id: string) => void;
  completeContract: () => void;
  deploy: (operatorIds: string[]) => void;
};

export const useCampaign = create<CampaignState>()(
  immer((set, get) => ({
    currency: 0,
    turn: 0,
    availableContracts: [],
    activeContract: null,
    deployed: [],
    addCurrency: (n) =>
      set((s) => {
        s.currency += n;
      }),
    spendCurrency: (n) => {
      if (get().currency < n) return false;
      set((s) => {
        s.currency -= n;
      });
      return true;
    },
    advanceTurn: () =>
      set((s) => {
        s.turn += 1;
      }),
    setAvailableContracts: (ids) =>
      set((s) => {
        s.availableContracts = ids;
      }),
    activateContract: (id) =>
      set((s) => {
        s.activeContract = id;
      }),
    completeContract: () =>
      set((s) => {
        s.activeContract = null;
        s.deployed = [];
      }),
    deploy: (operatorIds) =>
      set((s) => {
        s.deployed = [...operatorIds];
      }),
  })),
);
