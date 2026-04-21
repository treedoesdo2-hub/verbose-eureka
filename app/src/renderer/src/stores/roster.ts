import type { Operator } from '@schema/operator';
import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

enableMapSet();

export type HiredOperator = {
  operator: Operator;
  hiredAt: number;
  contractsCompleted: number;
  injuries: string[];
  alive: boolean;
};

export type RosterState = {
  hired: Map<string, HiredOperator>;
  availablePool: Map<string, Operator>;
  initialize: (pool: Iterable<Operator>) => void;
  hire: (operatorId: string, contractTurn: number) => void;
  fire: (operatorId: string) => void;
  markKilled: (operatorId: string) => void;
  recordContractCompleted: (operatorIds: string[]) => void;
};

export const useRoster = create<RosterState>()(
  immer((set) => ({
    hired: new Map(),
    availablePool: new Map(),
    initialize: (pool) =>
      set((s) => {
        s.availablePool = new Map();
        for (const op of pool) s.availablePool.set(op.id, op);
      }),
    hire: (operatorId, contractTurn) =>
      set((s) => {
        const op = s.availablePool.get(operatorId);
        if (!op) return;
        s.availablePool.delete(operatorId);
        s.hired.set(operatorId, {
          operator: op,
          hiredAt: contractTurn,
          contractsCompleted: 0,
          injuries: [],
          alive: true,
        });
      }),
    fire: (operatorId) =>
      set((s) => {
        const h = s.hired.get(operatorId);
        if (!h) return;
        s.hired.delete(operatorId);
        if (h.alive) s.availablePool.set(operatorId, h.operator);
      }),
    markKilled: (operatorId) =>
      set((s) => {
        const h = s.hired.get(operatorId);
        if (h) h.alive = false;
      }),
    recordContractCompleted: (operatorIds) =>
      set((s) => {
        for (const id of operatorIds) {
          const h = s.hired.get(id);
          if (h) h.contractsCompleted += 1;
        }
      }),
  })),
);
