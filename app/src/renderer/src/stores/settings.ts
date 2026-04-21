import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type SimSpeed = 0.5 | 1 | 2 | 4 | 8;

export type SettingsState = {
  volume: number;
  simSpeed: SimSpeed;
  advancedLoadoutMode: boolean;
  setVolume: (v: number) => void;
  setSimSpeed: (s: SimSpeed) => void;
  toggleAdvancedLoadout: () => void;
};

export const useSettings = create<SettingsState>()(
  immer((set) => ({
    volume: 1,
    simSpeed: 1 as SimSpeed,
    advancedLoadoutMode: false,
    setVolume: (v) =>
      set((s) => {
        s.volume = Math.max(0, Math.min(1, v));
      }),
    setSimSpeed: (speed) =>
      set((s) => {
        s.simSpeed = speed;
      }),
    toggleAdvancedLoadout: () =>
      set((s) => {
        s.advancedLoadoutMode = !s.advancedLoadoutMode;
      }),
  })),
);
