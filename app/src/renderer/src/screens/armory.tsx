import { ALL_BODY_ZONES } from '@schema/common';
import type { Loadout } from '@sim/loadout';
import { deriveCombatProfile, emptyLoadout, validateLoadout } from '@sim/loadout';
import { useState } from 'react';
import { contentLookup, getContent } from '../content';
import { equipLoadout } from '../services/equip';
import { useAppState } from '../stores/app-state';
import { useLoadouts } from '../stores/loadouts';
import { useSettings } from '../stores/settings';

export function Armory(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  const advanced = useSettings((s) => s.advancedLoadoutMode);
  const toggleAdvanced = useSettings((s) => s.toggleAdvancedLoadout);
  const bundle = getContent();
  const operators = [...bundle.operators.values()];
  const [selected, setSelected] = useState<string>(operators[0]?.id ?? '');
  const lookup = contentLookup();

  const loadoutsStore = useLoadouts();
  const loadout: Loadout =
    loadoutsStore.byOperator.get(selected) ??
    (() => {
      const op = bundle.operators.get(selected);
      const tpl = op ? bundle.templates.get(op.defaultTemplateId) : null;
      if (!tpl) return emptyLoadout();
      return {
        primaryWeaponId: tpl.primaryWeaponId,
        sidearmId: tpl.sidearmId,
        armorId: tpl.armorId,
        utilityIds: [...tpl.utilityIds],
      };
    })();

  const validation = validateLoadout(loadout, lookup);
  const profile = deriveCombatProfile(loadout, lookup);

  function apply(patch: Partial<Loadout>): void {
    const next = { ...loadout, ...patch };
    const r = equipLoadout(selected, next, lookup);
    if (!r.ok) {
      loadoutsStore.set(selected, next);
    }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button type="button" className="btn btn-small" onClick={() => go('menu')}>
          ← menu
        </button>
        <h2>Armory</h2>
        <label className="toggle">
          <input type="checkbox" checked={advanced} onChange={toggleAdvanced} />
          advanced mode
        </label>
      </div>
      <div className="armory-layout">
        <aside>
          <h3>Operators</h3>
          <ul className="op-list">
            {operators.map((op) => (
              <li key={op.id} className={selected === op.id ? 'active' : ''}>
                <button type="button" onClick={() => setSelected(op.id)}>
                  "{op.callsign}" · {op.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main>
          {advanced ? (
            <AdvancedView loadout={loadout} apply={apply} />
          ) : (
            <DefaultView loadout={loadout} apply={apply} />
          )}
          <section className="profile-summary">
            <h3>Profile</h3>
            <dl>
              <dt>tonnage</dt>
              <dd className="mono">
                {validation.tonnage.toFixed(1)} / 25
                {!validation.valid ? <span className="danger"> · invalid</span> : null}
              </dd>
              <dt>mobility penalty</dt>
              <dd className="mono">{profile.mobilityPenalty}%</dd>
            </dl>
            {advanced ? (
              <dl className="zone-dr mono">
                {ALL_BODY_ZONES.map((z) => (
                  <div key={z}>
                    <dt>{z}</dt>
                    <dd>{profile.zoneDr[z]} DR</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {validation.errors.length > 0 ? (
              <ul className="danger">
                {validation.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}

function DefaultView({
  loadout,
  apply,
}: {
  loadout: Loadout;
  apply: (patch: Partial<Loadout>) => void;
}): React.JSX.Element {
  const bundle = getContent();
  return (
    <section>
      <h3>Template</h3>
      <div className="template-list">
        {[...bundle.templates.values()].map((t) => {
          const active =
            t.primaryWeaponId === loadout.primaryWeaponId && t.armorId === loadout.armorId;
          return (
            <button
              type="button"
              key={t.id}
              className={`btn${active ? ' btn-primary' : ''}`}
              onClick={() =>
                apply({
                  primaryWeaponId: t.primaryWeaponId,
                  sidearmId: t.sidearmId,
                  armorId: t.armorId,
                  utilityIds: [...t.utilityIds],
                })
              }
            >
              {t.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AdvancedView({
  loadout,
  apply,
}: {
  loadout: Loadout;
  apply: (patch: Partial<Loadout>) => void;
}): React.JSX.Element {
  const bundle = getContent();
  return (
    <section className="advanced-view">
      <h3>Primary weapon</h3>
      <Selector
        items={[...bundle.weapons.values()].filter((w) => w.hardpoint === 'primary')}
        selected={loadout.primaryWeaponId}
        onChange={(id) => apply({ primaryWeaponId: id })}
      />
      <h3>Sidearm</h3>
      <Selector
        items={[...bundle.weapons.values()].filter((w) => w.hardpoint === 'sidearm')}
        selected={loadout.sidearmId}
        onChange={(id) => apply({ sidearmId: id })}
      />
      <h3>Armor</h3>
      <Selector
        items={[...bundle.armor.values()]}
        selected={loadout.armorId}
        onChange={(id) => apply({ armorId: id })}
      />
      <h3>Utilities</h3>
      <div className="util-grid">
        {[...bundle.utility.values()].map((u) => {
          const count = loadout.utilityIds.filter((uid) => uid === u.id).length;
          return (
            <div key={u.id} className="util-item">
              <span>
                {u.name}
                {count > 0 ? <span className="mono"> ×{count}</span> : null}
              </span>
              <div className="util-actions">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => apply({ utilityIds: [...loadout.utilityIds, u.id] })}
                >
                  +
                </button>
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={count === 0}
                  onClick={() => {
                    const next = [...loadout.utilityIds];
                    const idx = next.indexOf(u.id);
                    if (idx >= 0) next.splice(idx, 1);
                    apply({ utilityIds: next });
                  }}
                >
                  −
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Selector<T extends { id: string; name: string; tonnage?: number }>({
  items,
  selected,
  onChange,
}: {
  items: T[];
  selected: string | null;
  onChange: (id: string | null) => void;
}): React.JSX.Element {
  return (
    <div className="selector">
      <button
        type="button"
        className={`btn${selected === null ? ' btn-primary' : ''}`}
        onClick={() => onChange(null)}
      >
        none
      </button>
      {items.map((i) => (
        <button
          type="button"
          key={i.id}
          className={`btn${selected === i.id ? ' btn-primary' : ''}`}
          onClick={() => onChange(i.id)}
        >
          {i.name}
          {i.tonnage !== undefined ? <span className="mono"> · {i.tonnage}t</span> : null}
        </button>
      ))}
    </div>
  );
}
