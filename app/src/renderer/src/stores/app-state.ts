import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type Screen = 'menu' | 'board' | 'armory' | 'briefing' | 'deploy' | 'debrief';

export type DebriefSummary = {
  winner: number | null;
  endReason: string | undefined;
  casualties: string[];
  survivors: string[];
  payout: number;
};

export type AppStateStore = {
  screen: Screen;
  selectedContractId: string | null;
  lastDebrief: DebriefSummary | null;
  go: (screen: Screen) => void;
  selectContract: (id: string | null) => void;
  setDebrief: (d: DebriefSummary | null) => void;
};

export const useAppState = create<AppStateStore>()(
  immer((set) => ({
    screen: 'menu',
    selectedContractId: null,
    lastDebrief: null,
    go: (screen) =>
      set((s) => {
        s.screen = screen;
      }),
    selectContract: (id) =>
      set((s) => {
        s.selectedContractId = id;
      }),
    setDebrief: (d) =>
      set((s) => {
        s.lastDebrief = d;
      }),
  })),
);
