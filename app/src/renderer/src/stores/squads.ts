import { newSquadId, type Squad, type SquadMember } from '@schema/squad';
import type { Loadout } from '@sim/loadout';
import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

enableMapSet();

export type SquadsState = {
  squads: Map<string, Squad>;
  order: string[];

  create: (name: string) => string;
  rename: (squadId: string, name: string) => void;
  remove: (squadId: string) => void;

  addMember: (squadId: string, member: SquadMember) => void;
  removeMember: (squadId: string, operatorId: string) => void;
  setMemberLoadout: (squadId: string, operatorId: string, loadout: Loadout) => void;

  squadOf: (operatorId: string) => Squad | undefined;
  list: () => Squad[];
};

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const mapStorage = createJSONStorage<{ squads: Map<string, Squad>; order: string[] }>(
  () => (typeof window !== 'undefined' && window.localStorage ? window.localStorage : noopStorage),
  {
    reviver: (_, value) => {
      if (value && typeof value === 'object' && '__t' in value && (value as { __t: string }).__t === 'Map') {
        return new Map((value as { __t: string; v: [string, Squad][] }).v);
      }
      return value;
    },
    replacer: (_, value) => {
      if (value instanceof Map) {
        return { __t: 'Map', v: [...value.entries()] };
      }
      return value;
    },
  },
);

export const useSquads = create<SquadsState>()(
  persist(
    immer((set, get) => ({
      squads: new Map(),
      order: [],

      create: (name) => {
        const id = newSquadId();
        set((s) => {
          s.squads.set(id, { id, name: name.trim() || 'Squad', members: [] });
          s.order.push(id);
        });
        return id;
      },

      rename: (squadId, name) =>
        set((s) => {
          const sq = s.squads.get(squadId);
          if (!sq) return;
          sq.name = name.trim() || sq.name;
        }),

      remove: (squadId) =>
        set((s) => {
          s.squads.delete(squadId);
          s.order = s.order.filter((id) => id !== squadId);
        }),

      addMember: (squadId, member) =>
        set((s) => {
          const sq = s.squads.get(squadId);
          if (!sq) return;
          for (const other of s.squads.values()) {
            if (other.id === squadId) continue;
            other.members = other.members.filter((m) => m.operatorId !== member.operatorId);
          }
          const existing = sq.members.findIndex((m) => m.operatorId === member.operatorId);
          if (existing >= 0) sq.members[existing] = member;
          else sq.members.push(member);
        }),

      removeMember: (squadId, operatorId) =>
        set((s) => {
          const sq = s.squads.get(squadId);
          if (!sq) return;
          sq.members = sq.members.filter((m) => m.operatorId !== operatorId);
        }),

      setMemberLoadout: (squadId, operatorId, loadout) =>
        set((s) => {
          const sq = s.squads.get(squadId);
          if (!sq) return;
          const m = sq.members.find((mm) => mm.operatorId === operatorId);
          if (!m) return;
          m.loadout = { items: [...loadout.items] };
        }),

      squadOf: (operatorId) => {
        for (const sq of get().squads.values()) {
          if (sq.members.some((m) => m.operatorId === operatorId)) return sq;
        }
        return undefined;
      },

      list: () => {
        const { squads, order } = get();
        return order.map((id) => squads.get(id)).filter((x): x is Squad => !!x);
      },
    })),
    {
      name: 'merc-autobattler-squads-v1',
      storage: mapStorage,
      partialize: (s) => ({ squads: s.squads, order: s.order }),
    },
  ),
);
