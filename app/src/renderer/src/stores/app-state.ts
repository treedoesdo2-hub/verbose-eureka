import type { MatchStats } from '@shared/snapshot';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type Screen = 'menu' | 'board' | 'armory' | 'briefing' | 'deploy' | 'debrief' | 'orbat';

export type DebriefSummary = {
  winner: number | null;
  endReason: string | undefined;
  casualties: string[];
  survivors: string[];
  payout: number;
  deployCost: number;
  netCash: number;
  stats: MatchStats | null;
};

export type AppStateStore = {
  screen: Screen;
  selectedContractId: string | null;
  deploySelection: string[];
  lastDebrief: DebriefSummary | null;
  go: (screen: Screen) => void;
  selectContract: (id: string | null) => void;
  setDeploySelection: (ids: string[]) => void;
  clearDeploySelection: () => void;
  setDebrief: (d: DebriefSummary | null) => void;
};

export const useAppState = create<AppStateStore>()(
  immer((set) => ({
    screen: 'menu',
    selectedContractId: null,
    deploySelection: [],
    lastDebrief: null,
    go: (screen) =>
      set((s) => {
        s.screen = screen;
      }),
    selectContract: (id) =>
      set((s) => {
        s.selectedContractId = id;
        if (id === null) s.deploySelection = [];
      }),
    setDeploySelection: (ids) =>
      set((s) => {
        s.deploySelection = ids;
      }),
    clearDeploySelection: () =>
      set((s) => {
        s.deploySelection = [];
      }),
    setDebrief: (d) => set(() => ({ lastDebrief: d }), false),
  })),
);
