import type { SimSnapshot, SnapshotUnit, WorldSnapshot } from '@shared/snapshot';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getContent } from '../content';
import { EventFeed } from './EventFeed';
import { appendEvents, formatEvent } from './event-feed';
import type { HudEventEntry, HudObjective } from './hud-types';
import { Minimap } from './Minimap';
import { Objectives } from './Objectives';
import { UnitCard } from './UnitCard';
import { deriveUnitCard } from './unit-card';

type Props = {
  world: WorldSnapshot;
  snapshot: SimSnapshot | null;
  objectives?: readonly HudObjective[];
};

const EMPTY_OBJECTIVES: readonly HudObjective[] = [];

export function CombatHud({
  world,
  snapshot,
  objectives = EMPTY_OBJECTIVES,
}: Props): React.JSX.Element {
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [feedEntries, setFeedEntries] = useState<HudEventEntry[]>([]);
  const lastIngestedTick = useRef<number>(-1);

  const bundle = getContent();
  const ops = bundle.operators;

  const unitsById = useMemo(() => {
    const map = new Map<number, SnapshotUnit>();
    if (snapshot) for (const u of snapshot.units) map.set(u.id, u);
    return map;
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.tick === lastIngestedTick.current) return;
    lastIngestedTick.current = snapshot.tick;
    const formatted: HudEventEntry[] = [];
    for (const ev of snapshot.events) {
      const entry = formatEvent(ev, unitsById, ops);
      if (entry) formatted.push(entry);
    }
    if (formatted.length === 0) return;
    setFeedEntries((cur) => appendEvents(cur, formatted));
  }, [snapshot, unitsById, ops]);

  const selectedCard = useMemo(() => {
    if (selectedUnitId === null) return null;
    const u = unitsById.get(selectedUnitId);
    if (!u) return null;
    return deriveUnitCard(u, unitsById, ops);
  }, [selectedUnitId, unitsById, ops]);

  const units = snapshot?.units ?? [];

  return (
    <div className="combat-hud">
      <div className="hud-top-left">
        <Objectives objectives={objectives} />
      </div>
      <div className="hud-top-right">
        <Minimap
          world={world}
          units={units}
          selectedUnitId={selectedUnitId}
          onSelectUnit={setSelectedUnitId}
        />
      </div>
      <div className="hud-bottom-left">
        <EventFeed entries={feedEntries} />
      </div>
      <div className="hud-bottom-right">
        <UnitCard data={selectedCard} onClose={() => setSelectedUnitId(null)} />
      </div>
    </div>
  );
}
