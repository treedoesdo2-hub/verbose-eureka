import { ALL_BODY_ZONES, type BodyZone, ZONE_CAPACITY_KG } from '@schema/common';
import type { Operator } from '@schema/operator';
import type { SquadMember } from '@schema/squad';
import type { LoadoutItem } from '@sim/loadout';
import {
  deriveCombatProfile,
  emptyLoadout,
  INFANTRY_WEIGHT_KG_BUDGET,
  loadoutFromTemplate,
  validateLoadout,
} from '@sim/loadout';
import { useState } from 'react';
import { contentLookup, getContent } from '../content';
import { useAppState } from '../stores/app-state';
import { useSquads } from '../stores/squads';

export function Armory(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  const squads = useSquads((s) => s.list());
  const createSquad = useSquads((s) => s.create);
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(squads[0]?.id ?? null);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);

  const bundle = getContent();
  const selectedSquad = selectedSquadId
    ? useSquads.getState().squads.get(selectedSquadId) ?? null
    : null;
  const selectedMember =
    selectedSquad && selectedOperatorId
      ? selectedSquad.members.find((m) => m.operatorId === selectedOperatorId) ?? null
      : null;

  function handleCreate(): void {
    const name = window.prompt('Squad name', `Squad ${squads.length + 1}`)?.trim();
    if (!name) return;
    const id = createSquad(name);
    setSelectedSquadId(id);
    setSelectedOperatorId(null);
  }

  return (
    <div className="screen armory-screen">
      <div className="screen-header">
        <button type="button" className="btn btn-small" onClick={() => go('menu')}>
          ← menu
        </button>
        <h2>Armory · Squads</h2>
      </div>
      <div className="armory-grid">
        <SquadListPane
          squads={squads}
          selectedId={selectedSquadId}
          onSelect={(id) => {
            setSelectedSquadId(id);
            setSelectedOperatorId(null);
          }}
          onCreate={handleCreate}
        />
        <SquadDetailPane
          squad={selectedSquad}
          operators={[...bundle.operators.values()]}
          selectedOperatorId={selectedOperatorId}
          onSelectMember={setSelectedOperatorId}
        />
        {selectedSquad && selectedMember ? (
          <LoadoutEditorPane squadId={selectedSquad.id} member={selectedMember} />
        ) : (
          <div className="armory-editor empty">
            <p className="mono dim">Select a squad member to edit their loadout.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SquadListPane({
  squads,
  selectedId,
  onSelect,
  onCreate,
}: {
  squads: ReturnType<typeof useSquads.getState>['list'] extends () => infer R ? R : never;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}): React.JSX.Element {
  const rename = useSquads((s) => s.rename);
  const remove = useSquads((s) => s.remove);

  return (
    <aside className="armory-squads">
      <header className="pane-header">
        <h3>Squads</h3>
        <button type="button" className="btn btn-small" onClick={onCreate}>
          + new
        </button>
      </header>
      {squads.length === 0 ? (
        <p className="mono dim">No squads yet. Create one to start.</p>
      ) : (
        <ul className="op-list">
          {squads.map((sq) => (
            <li key={sq.id} className={selectedId === sq.id ? 'active' : ''}>
              <button type="button" onClick={() => onSelect(sq.id)}>
                {sq.name}{' '}
                <span className="mono dim">
                  · {sq.members.length} {sq.members.length === 1 ? 'op' : 'ops'}
                </span>
              </button>
              {selectedId === sq.id ? (
                <div className="squad-row-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => {
                      const next = window.prompt('Rename squad', sq.name)?.trim();
                      if (next) rename(sq.id, next);
                    }}
                  >
                    rename
                  </button>
                  <button
                    type="button"
                    className="btn btn-small danger"
                    onClick={() => {
                      if (window.confirm(`Delete squad "${sq.name}"?`)) remove(sq.id);
                    }}
                  >
                    delete
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function SquadDetailPane({
  squad,
  operators,
  selectedOperatorId,
  onSelectMember,
}: {
  squad: { id: string; name: string; members: SquadMember[] } | null;
  operators: Operator[];
  selectedOperatorId: string | null;
  onSelectMember: (id: string) => void;
}): React.JSX.Element {
  const addMember = useSquads((s) => s.addMember);
  const removeMember = useSquads((s) => s.removeMember);
  const bundle = getContent();
  const lookup = contentLookup();

  if (!squad) {
    return (
      <section className="armory-members empty">
        <p className="mono dim">Select or create a squad.</p>
      </section>
    );
  }

  const assigned = new Set(squad.members.map((m) => m.operatorId));
  const unassigned = operators.filter((o) => !assigned.has(o.id));

  return (
    <section className="armory-members">
      <header className="pane-header">
        <h3>{squad.name} · roster</h3>
      </header>
      {squad.members.length === 0 ? (
        <p className="mono dim">No operators in this squad yet.</p>
      ) : (
        <ul className="member-list">
          {squad.members.map((m) => {
            const op = bundle.operators.get(m.operatorId);
            const profile = deriveCombatProfile(m.loadout, lookup);
            return (
              <li
                key={m.operatorId}
                className={`member-row ${selectedOperatorId === m.operatorId ? 'active' : ''}`}
              >
                <button type="button" onClick={() => onSelectMember(m.operatorId)}>
                  <span className="callsign">"{op?.callsign ?? m.operatorId}"</span>
                  <span className="name">{op?.name ?? ''}</span>
                  <span
                    className="mono dim"
                    title={`${profile.totalWeightKg.toFixed(1)} kg carried; mobility penalty −${profile.mobilityPenalty}% to move/accuracy from weight`}
                  >
                    {profile.totalWeightKg.toFixed(1)} kg · −{profile.mobilityPenalty}%
                  </span>
                </button>
                {op ? (
                  <div
                    className="member-stats mono dim"
                    title="AIM: shooting accuracy · MOV: movement speed · GRT: grit (pain tolerance) · AWR: awareness · MED: medical skill"
                  >
                    <span title="AIM: shooting accuracy">AIM {op.stats.aim}</span>{' '}
                    <span title="MOV: movement speed">MOV {op.stats.move}</span>{' '}
                    <span title="GRT: grit (pain tolerance)">GRT {op.stats.grit}</span>{' '}
                    <span title="AWR: awareness (spotting)">AWR {op.stats.awareness}</span>{' '}
                    <span title="MED: medical skill (self/buddy aid)">
                      MED {op.stats.medical}
                    </span>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    removeMember(squad.id, m.operatorId);
                  }}
                >
                  remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {unassigned.length > 0 ? (
        <>
          <h3 style={{ marginTop: 14 }}>Add operator</h3>
          <div className="add-member-grid">
            {unassigned.map((op) => {
              const tpl = bundle.templates.get(op.defaultTemplateId);
              const loadout = tpl ? loadoutFromTemplate(tpl, lookup) : emptyLoadout();
              return (
                <button
                  type="button"
                  key={op.id}
                  className="btn btn-small"
                  onClick={() => {
                    addMember(squad.id, {
                      operatorId: op.id,
                      loadout: { items: [...loadout.items] },
                      templateId: op.defaultTemplateId,
                    });
                    onSelectMember(op.id);
                  }}
                >
                  + "{op.callsign}" {op.name}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}

function LoadoutEditorPane({
  squadId,
  member,
}: {
  squadId: string;
  member: SquadMember;
}): React.JSX.Element {
  const setMemberLoadout = useSquads((s) => s.setMemberLoadout);
  const bundle = getContent();
  const lookup = contentLookup();
  const op = bundle.operators.get(member.operatorId);

  const validation = validateLoadout(member.loadout, lookup);
  const profile = deriveCombatProfile(member.loadout, lookup);

  function updateItems(next: LoadoutItem[]): void {
    setMemberLoadout(squadId, member.operatorId, { items: next });
  }

  function addItem(zone: BodyZone, type: 'weapon' | 'armor' | 'utility', id: string): void {
    updateItems([...member.loadout.items, { type, id, zone }]);
  }

  function removeItem(index: number): void {
    const next = [...member.loadout.items];
    next.splice(index, 1);
    updateItems(next);
  }

  const weaponsAt = (zone: BodyZone) =>
    [...bundle.weapons.values()].filter((w) => {
      if (zone === 'waist') return w.hardpoint === 'sidearm';
      if (zone === 'left_hand' || zone === 'right_hand') return true;
      return false;
    });
  const armorAt = (zone: BodyZone) =>
    [...bundle.armor.values()].filter((a) => a.placements.some((p) => p.zone === zone));
  const utilitiesAt = (zone: BodyZone) =>
    [...bundle.utility.values()].filter((u) => u.allowedZones.includes(zone));

  return (
    <section className="armory-editor">
      <header className="pane-header">
        <h3>
          Loadout · "{op?.callsign ?? member.operatorId}" {op?.name ?? ''}
        </h3>
      </header>
      <div className="weight-bar">
        <div
          className="weight-bar-label mono"
          title={`Carried weight (kilograms) vs infantry budget. Over-budget → invalid. Mobility penalty is applied to move and accuracy.`}
        >
          <span title="total kilograms carried">
            {profile.totalWeightKg.toFixed(1)} / {INFANTRY_WEIGHT_KG_BUDGET} kg
          </span>
          <span className="dim" title="movement + accuracy penalty from weight">
            {' '}
            · mobility −{profile.mobilityPenalty}%
          </span>
        </div>
        <div
          className={`weight-bar-fill ${validation.valid ? '' : 'over'}`}
          style={{
            width: `${Math.min(100, (profile.totalWeightKg / INFANTRY_WEIGHT_KG_BUDGET) * 100)}%`,
          }}
        />
      </div>

      <div className="zone-grid">
        {ALL_BODY_ZONES.map((zone) => {
          const itemsHere = member.loadout.items
            .map((it, i) => ({ it, i }))
            .filter((x) => x.it.zone === zone);
          const zoneKg = itemsHere.reduce((acc, { it }) => {
            if (it.type === 'weapon') return acc + (lookup.weapon(it.id)?.weightKg ?? 0);
            if (it.type === 'armor') {
              const a = lookup.armor(it.id);
              const p = a?.placements.find((pp) => pp.zone === zone);
              return acc + (p?.weightKg ?? 0);
            }
            if (it.type === 'utility') return acc + (lookup.utility(it.id)?.weightKg ?? 0);
            return acc;
          }, 0);
          const cap = ZONE_CAPACITY_KG[zone];
          const dr = profile.zoneDr[zone];
          const over = zoneKg > cap + 0.001;
          return (
            <div key={zone} className={`zone-card ${over ? 'over' : ''}`}>
              <header>
                <span className="zone-name">{zone.replace(/_/g, ' ')}</span>
                <span
                  className={`mono ${over ? 'danger' : 'dim'}`}
                  title="kilograms used / zone kilogram capacity"
                >
                  {zoneKg.toFixed(1)} / {cap} kg
                </span>
                {dr > 0 ? (
                  <span
                    className="mono accent"
                    title="DR: damage reduction — incoming damage is reduced by this many percent before wounding"
                  >
                    DR {dr}
                  </span>
                ) : null}
              </header>
              <ul className="zone-items">
                {itemsHere.length === 0 ? (
                  <li className="mono dim empty">— empty —</li>
                ) : (
                  itemsHere.map(({ it, i }) => {
                    const name =
                      it.type === 'weapon'
                        ? lookup.weapon(it.id)?.name
                        : it.type === 'armor'
                          ? lookup.armor(it.id)?.name
                          : lookup.utility(it.id)?.name;
                    return (
                      <li key={`${zone}-${i}`}>
                        <span className="item-type mono">{it.type[0]}</span>
                        <span className="item-name">{name ?? it.id}</span>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => removeItem(i)}
                        >
                          ×
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="zone-add">
                <AddItemDropdown
                  weapons={weaponsAt(zone)}
                  armor={armorAt(zone)}
                  utilities={utilitiesAt(zone)}
                  onPick={(type, id) => addItem(zone, type, id)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {validation.errors.length > 0 ? (
        <ul className="validation-errors mono">
          {validation.errors.map((e) => (
            <li key={e}>⚠ {e}</li>
          ))}
        </ul>
      ) : (
        <p className="mono ok">✓ loadout valid</p>
      )}
    </section>
  );
}

function AddItemDropdown({
  weapons,
  armor,
  utilities,
  onPick,
}: {
  weapons: { id: string; name: string; weightKg: number }[];
  armor: { id: string; name: string }[];
  utilities: { id: string; name: string; weightKg: number }[];
  onPick: (type: 'weapon' | 'armor' | 'utility', id: string) => void;
}): React.JSX.Element {
  const total = weapons.length + armor.length + utilities.length;
  if (total === 0) return <span className="mono dim">no items</span>;

  return (
    <select
      className="mono"
      value=""
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return;
        const [type, id] = v.split(':', 2) as ['weapon' | 'armor' | 'utility', string];
        onPick(type, id);
        e.target.value = '';
      }}
    >
      <option value="">+ add item…</option>
      {weapons.length > 0 ? (
        <optgroup label="weapons">
          {weapons.map((w) => (
            <option key={w.id} value={`weapon:${w.id}`}>
              {w.name} · {w.weightKg} kg
            </option>
          ))}
        </optgroup>
      ) : null}
      {armor.length > 0 ? (
        <optgroup label="armor">
          {armor.map((a) => (
            <option key={a.id} value={`armor:${a.id}`}>
              {a.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {utilities.length > 0 ? (
        <optgroup label="utilities">
          {utilities.map((u) => (
            <option key={u.id} value={`utility:${u.id}`}>
              {u.name} · {u.weightKg} kg
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}
