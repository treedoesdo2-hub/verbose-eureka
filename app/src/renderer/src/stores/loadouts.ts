import type { Loadout } from '@sim/loadout';
import { emptyLoadout } from '@sim/loadout';
import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

enableMapSet();

export type LoadoutsState = {
  byOperator: Map<string, Loadout>;
  set: (operatorId: string, loadout: Loadout) => void;
  clear: (operatorId: string) => void;
  get: (operatorId: string) => Loadout;
};

export const useLoadouts = create<LoadoutsState>()(
  immer((set, get) => ({
    byOperator: new Map(),
    set: (operatorId, loadout) =>
      set((s) => {
        s.byOperator.set(operatorId, {
          ...loadout,
          utilityIds: [...loadout.utilityIds],
        });
      }),
    clear: (operatorId) =>
      set((s) => {
        s.byOperator.delete(operatorId);
      }),
    get: (operatorId) => get().byOperator.get(operatorId) ?? emptyLoadout(),
  })),
);
