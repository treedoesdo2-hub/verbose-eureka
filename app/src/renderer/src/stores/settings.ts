import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type SimSpeed = 0.5 | 1 | 2 | 4 | 8;

export type SettingsState = {
  volume: number;
  simSpeed: SimSpeed;
  simPaused: boolean;
  setVolume: (v: number) => void;
  setSimSpeed: (s: SimSpeed) => void;
  togglePause: () => void;
  setPaused: (p: boolean) => void;
};

export const useSettings = create<SettingsState>()(
  immer((set) => ({
    volume: 1,
    simSpeed: 4 as SimSpeed,
    simPaused: false,
    setVolume: (v) =>
      set((s) => {
        s.volume = Math.max(0, Math.min(1, v));
      }),
    setSimSpeed: (speed) =>
      set((s) => {
        s.simSpeed = speed;
      }),
    togglePause: () =>
      set((s) => {
        s.simPaused = !s.simPaused;
      }),
    setPaused: (p) =>
      set((s) => {
        s.simPaused = p;
      }),
  })),
);
