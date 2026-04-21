import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type Density = 'compact' | 'normal' | 'spacious';

export type UiPrefsStore = {
  theme: Theme;
  density: Density;
  setTheme: (t: Theme) => void;
  setDensity: (d: Density) => void;
  toggleTheme: () => void;
};

const noopStorage = {
  getItem: (): null => null,
  setItem: (): void => undefined,
  removeItem: (): void => undefined,
};

export const useUiPrefs = create<UiPrefsStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      density: 'normal',
      setTheme: (t) => set({ theme: t }),
      setDensity: (d) => set({ density: d }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'merc-autobattler-ui-prefs-v1',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' && window.localStorage ? window.localStorage : noopStorage,
      ),
    },
  ),
);
