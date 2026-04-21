import { beforeEach, describe, expect, it } from 'vitest';
import { useSquads } from './squads';

describe('squads store', () => {
  beforeEach(() => {
    useSquads.setState({ squads: new Map(), order: [] });
  });

  it('creates a squad with a given name', () => {
    const id = useSquads.getState().create('Alpha');
    const sq = useSquads.getState().squads.get(id);
    expect(sq?.name).toBe('Alpha');
    expect(sq?.members.length).toBe(0);
    expect(useSquads.getState().order).toEqual([id]);
  });

  it('renames a squad', () => {
    const id = useSquads.getState().create('Alpha');
    useSquads.getState().rename(id, 'Reaper');
    expect(useSquads.getState().squads.get(id)?.name).toBe('Reaper');
  });

  it('removes a squad', () => {
    const id = useSquads.getState().create('Alpha');
    useSquads.getState().remove(id);
    expect(useSquads.getState().squads.has(id)).toBe(false);
    expect(useSquads.getState().order).toEqual([]);
  });

  it('assigning an operator to a new squad removes them from any previous squad', () => {
    const alpha = useSquads.getState().create('Alpha');
    const bravo = useSquads.getState().create('Bravo');
    useSquads.getState().addMember(alpha, {
      operatorId: 'op-1',
      loadout: { items: [] },
    });
    expect(useSquads.getState().squadOf('op-1')?.id).toBe(alpha);

    useSquads.getState().addMember(bravo, {
      operatorId: 'op-1',
      loadout: { items: [] },
    });
    expect(useSquads.getState().squadOf('op-1')?.id).toBe(bravo);
    expect(useSquads.getState().squads.get(alpha)?.members.length).toBe(0);
  });

  it('setMemberLoadout updates the loadout items', () => {
    const id = useSquads.getState().create('Alpha');
    useSquads.getState().addMember(id, {
      operatorId: 'op-1',
      loadout: { items: [] },
    });
    useSquads.getState().setMemberLoadout(id, 'op-1', {
      items: [{ type: 'weapon', id: 'ar-01', zone: 'right_hand' }],
    });
    const m = useSquads.getState().squads.get(id)?.members[0];
    expect(m?.loadout.items.length).toBe(1);
    expect(m?.loadout.items[0].id).toBe('ar-01');
  });

  it('list returns squads in creation order', () => {
    const a = useSquads.getState().create('A');
    const b = useSquads.getState().create('B');
    const c = useSquads.getState().create('C');
    expect(
      useSquads
        .getState()
        .list()
        .map((s) => s.id),
    ).toEqual([a, b, c]);
  });
});
