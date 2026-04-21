import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

enableMapSet();

export type StockpileState = {
  quantities: Map<string, number>;
  add: (itemId: string, count?: number) => void;
  remove: (itemId: string, count?: number) => boolean;
  available: (itemId: string) => number;
};

export const useStockpile = create<StockpileState>()(
  immer((set, get) => ({
    quantities: new Map(),
    add: (itemId, count = 1) =>
      set((s) => {
        s.quantities.set(itemId, (s.quantities.get(itemId) ?? 0) + count);
      }),
    remove: (itemId, count = 1) => {
      const have = get().quantities.get(itemId) ?? 0;
      if (have < count) return false;
      set((s) => {
        const next = have - count;
        if (next === 0) s.quantities.delete(itemId);
        else s.quantities.set(itemId, next);
      });
      return true;
    },
    available: (itemId) => get().quantities.get(itemId) ?? 0,
  })),
);
