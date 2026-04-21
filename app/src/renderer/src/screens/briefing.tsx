import type { ScenarioRequest, WireLoadout } from '@shared/messages';
import { useMemo, useState } from 'react';
import { getContent } from '../content';
import { getSimBridge } from '../sim-bridge';
import { useAppState } from '../stores/app-state';
import { useSquads } from '../stores/squads';

export function Briefing(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  const contractId = useAppState((s) => s.selectedContractId);
  const bundle = getContent();
  const contract = contractId ? bundle.contracts.get(contractId) : null;
  const squadMap = useSquads((s) => s.squads);
  const order = useSquads((s) => s.order);
  const squads = useMemo(
    () => order.map((id) => squadMap.get(id)).filter((x): x is NonNullable<typeof x> => !!x),
    [squadMap, order],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const deployedOperators = useMemo(() => {
    const ids = new Set<string>();
    for (const sq of squads) {
      if (!selected.has(sq.id)) continue;
      for (const m of sq.members) ids.add(m.operatorId);
    }
    return ids;
  }, [squads, selected]);

  function toggle(id: string): void {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function launch(): void {
    if (!contract) return;
    const perOperatorLoadouts: ScenarioRequest['perOperatorLoadouts'] = {};
    const deployedIds: string[] = [];
    for (const sq of squads) {
      if (!selected.has(sq.id)) continue;
      for (const m of sq.members) {
        deployedIds.push(m.operatorId);
        const wire: WireLoadout = {
          items: [...m.loadout.items],
          templateId: m.templateId,
        };
        perOperatorLoadouts[m.operatorId] = wire;
      }
    }

    const bridge = getSimBridge();
    const seed = Date.now() & 0xffff;
    bridge.send({
      type: 'startSim',
      payload: {
        seed,
        contractId: contract.id,
        simSpeedMultiplier: 4,
        scenarioRequest: {
          seed,
          contractId: contract.id,
          mapId: contract.mapId,
          deployedOperatorIds: deployedIds,
          perOperatorLoadouts,
        },
      },
    });
    go('deploy');
  }

  if (!contract) {
    return (
      <div className="screen">
        <button type="button" className="btn btn-small" onClick={() => go('board')}>
          ← board
        </button>
        <p>No contract selected.</p>
      </div>
    );
  }

  const opCount = deployedOperators.size;
  const canLaunch = opCount >= contract.minOperators && opCount <= contract.maxOperators;
  const underCap = opCount < contract.minOperators;
  const overCap = opCount > contract.maxOperators;

  return (
    <div className="screen">
      <div className="screen-header">
        <button type="button" className="btn btn-small" onClick={() => go('board')}>
          ← board
        </button>
        <h2>Briefing · {contract.name}</h2>
      </div>
      <p className="briefing">{contract.briefing}</p>

      <section className="briefing-spec">
        <dl>
          <dt>payout</dt>
          <dd>
            <span className="accent">${contract.payout.toLocaleString()}</span>
          </dd>
          <dt>map</dt>
          <dd>
            <span className="mono">{contract.mapId}</span>
          </dd>
          <dt>operators</dt>
          <dd className="mono">
            {contract.minOperators}–{contract.maxOperators}
          </dd>
          <dt>objectives</dt>
          <dd>
            <ul className="obj-list">
              {contract.objectives.map((o) => (
                <li key={o.description}>
                  <span className="mono dim">{o.kind}</span> {o.description}
                </li>
              ))}
            </ul>
          </dd>
        </dl>
      </section>

      <h3>
        Deployment · {opCount} operator{opCount === 1 ? '' : 's'} across {selected.size} squad
        {selected.size === 1 ? '' : 's'}{' '}
        {underCap ? (
          <span className="danger">
            (need {contract.minOperators - opCount} more)
          </span>
        ) : overCap ? (
          <span className="danger">(over cap by {opCount - contract.maxOperators})</span>
        ) : (
          <span className="ok">(ready)</span>
        )}
      </h3>
      {squads.length === 0 ? (
        <div className="briefing-no-squads">
          <p>No squads exist yet. Head to the Armory to form a squad before deploying.</p>
          <button type="button" className="btn" onClick={() => go('armory')}>
            → Armory
          </button>
        </div>
      ) : (
        <div className="squad-picker-grid">
          {squads.map((sq) => {
            const isSelected = selected.has(sq.id);
            return (
              <label
                key={sq.id}
                className={`squad-card${isSelected ? ' selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(sq.id)}
                />
                <header>
                  <span className="squad-name">{sq.name}</span>
                  <span className="mono dim">
                    {sq.members.length} op{sq.members.length === 1 ? '' : 's'}
                  </span>
                </header>
                <ul className="squad-members mono">
                  {sq.members.length === 0 ? (
                    <li className="dim">— empty —</li>
                  ) : (
                    sq.members.map((m) => {
                      const op = bundle.operators.get(m.operatorId);
                      return (
                        <li key={m.operatorId}>
                          "{op?.callsign ?? m.operatorId}"{' '}
                          <span className="dim">{op?.name ?? ''}</span>
                        </li>
                      );
                    })
                  )}
                </ul>
              </label>
            );
          })}
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn" onClick={() => go('armory')}>
          Edit Armory
        </button>
        <button type="button" className="btn btn-primary" disabled={!canLaunch} onClick={launch}>
          Deploy
        </button>
      </div>
    </div>
  );
}
