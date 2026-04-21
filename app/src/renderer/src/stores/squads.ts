import { newSquadId, type Squad, type SquadMember } from '@schema/squad';
import type { Loadout } from '@sim/loadout';
import { enableMapSet } from 'immer';
import { create } from 'zustand';
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

export const useSquads = create<SquadsState>()(
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
);
