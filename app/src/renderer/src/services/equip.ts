import type { ContentLookup, Loadout } from '@sim/loadout';
import { itemCounts, validateLoadout } from '@sim/loadout';
import { useLoadouts } from '../stores/loadouts';
import { useStockpile } from '../stores/stockpile';

type EquipResult = { ok: true } | { ok: false; error: string };

function diff(
  prev: Loadout,
  next: Loadout,
): { toRemove: Map<string, number>; toReturn: Map<string, number> } {
  const prevC = itemCounts(prev);
  const nextC = itemCounts(next);
  const toRemove = new Map<string, number>();
  const toReturn = new Map<string, number>();

  for (const [id, n] of nextC) {
    const p = prevC.get(id) ?? 0;
    if (n > p) toRemove.set(id, n - p);
  }
  for (const [id, p] of prevC) {
    const n = nextC.get(id) ?? 0;
    if (p > n) toReturn.set(id, p - n);
  }
  return { toRemove, toReturn };
}

export function equipLoadout(
  operatorId: string,
  nextLoadout: Loadout,
  content: ContentLookup,
): EquipResult {
  const validation = validateLoadout(nextLoadout, content);
  if (!validation.valid) return { ok: false, error: validation.errors.join('; ') };

  const loadoutsStore = useLoadouts.getState();
  const stockpile = useStockpile.getState();

  const prev = loadoutsStore.get(operatorId);
  const d = diff(prev, nextLoadout);

  for (const [id, n] of d.toRemove) {
    if (stockpile.available(id) < n) {
      return { ok: false, error: `stockpile lacks ${n}× ${id}` };
    }
  }

  for (const [id, n] of d.toReturn) stockpile.add(id, n);
  for (const [id, n] of d.toRemove) stockpile.remove(id, n);
  loadoutsStore.set(operatorId, nextLoadout);

  return { ok: true };
}

export function unequipLoadout(operatorId: string): void {
  const loadoutsStore = useLoadouts.getState();
  const stockpile = useStockpile.getState();
  const prev = loadoutsStore.get(operatorId);
  for (const [id, n] of itemCounts(prev)) stockpile.add(id, n);
  loadoutsStore.clear(operatorId);
}
