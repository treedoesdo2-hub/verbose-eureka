import type { ScenarioRequest, WireLoadout } from '@shared/messages';
import { useMemo, useState } from 'react';
import { getContent } from '../content';
import { getSimBridge } from '../sim-bridge';
import { useAppState } from '../stores/app-state';
import { useSquads } from '../stores/squads';

const ELEMENT_ROLES = ['Primary', 'Secondary', 'Support', 'Reserve'] as const;
const EMPTY_SLOT = '';

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

  // Deployment-order slots: each element is either a squad id or the empty
  // string. This is the form-filling primitive — commanders fill in numbered
  // elements, they don't check boxes on a grid.
  const [slots, setSlots] = useState<string[]>(() => ELEMENT_ROLES.map(() => EMPTY_SLOT));

  function assign(slotIdx: number, squadId: string): void {
    setSlots((prev) => {
      const next = [...prev];
      // Clear duplicates — a squad can only occupy one slot at a time.
      for (let i = 0; i < next.length; i++) {
        if (next[i] === squadId) next[i] = EMPTY_SLOT;
      }
      next[slotIdx] = squadId;
      return next;
    });
  }

  const assignedSquads = useMemo(
    () => slots.map((id) => squadMap.get(id)).filter((s): s is NonNullable<typeof s> => !!s),
    [slots, squadMap],
  );

  const deployedOperatorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const sq of assignedSquads) {
      for (const m of sq.members) ids.add(m.operatorId);
    }
    return ids;
  }, [assignedSquads]);

  function launch(): void {
    if (!contract) return;
    const perOperatorLoadouts: ScenarioRequest['perOperatorLoadouts'] = {};
    const deployedIds: string[] = [];
    for (const sq of assignedSquads) {
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

  const opCount = deployedOperatorIds.size;
  const canLaunch = opCount >= contract.minOperators && opCount <= contract.maxOperators;
  const underCap = opCount < contract.minOperators;
  const overCap = opCount > contract.maxOperators;

  return (
    <div className="screen deployment-order">
      <div className="screen-header">
        <button type="button" className="btn btn-small" onClick={() => go('board')}>
          ← board
        </button>
        <h2>Deployment Order · {contract.name}</h2>
      </div>

      <section className="order-doc">
        <header className="order-doc-header">
          <span className="order-doc-seal mono">OP-{contract.id.toUpperCase()}</span>
          <span className="order-doc-title">Commander's Deployment Order</span>
        </header>

        <dl className="order-fields">
          <dt>contract</dt>
          <dd>{contract.name}</dd>
          <dt>briefing</dt>
          <dd className="briefing-narrative">{contract.briefing}</dd>
          <dt>payout</dt>
          <dd>
            <span className="accent mono">${contract.payout.toLocaleString()}</span>
          </dd>
          <dt>map</dt>
          <dd className="mono">{bundle.maps.get(contract.mapId)?.name ?? contract.mapId}</dd>
          <dt>team size</dt>
          <dd className="mono">
            {contract.minOperators}–{contract.maxOperators} operators
          </dd>
          <dt>objectives</dt>
          <dd>
            <ol className="order-objectives">
              {contract.objectives.map((o) => (
                <li key={o.description}>
                  <span className="mono dim">{o.kind}</span> {o.description}
                </li>
              ))}
            </ol>
          </dd>
        </dl>
      </section>

      <section className="order-elements">
        <h3>Element assignment</h3>
        {squads.length === 0 ? (
          <div className="briefing-no-squads">
            <p>No squads exist yet. Head to the Armory to form a squad before deploying.</p>
            <button type="button" className="btn" onClick={() => go('armory')}>
              → Armory
            </button>
          </div>
        ) : (
          <table className="order-slot-table">
            <tbody>
              {ELEMENT_ROLES.map((role, idx) => {
                const currentId = slots[idx];
                const sq = currentId ? squadMap.get(currentId) : null;
                return (
                  <tr key={role}>
                    <th scope="row">
                      <span className="mono dim">0{idx + 1}</span>
                      <span className="order-slot-role">{role}</span>
                    </th>
                    <td>
                      <select
                        className="order-slot-select"
                        value={currentId}
                        onChange={(e) => assign(idx, e.target.value)}
                      >
                        <option value={EMPTY_SLOT}>— no element assigned —</option>
                        {squads.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.members.length} op
                            {s.members.length === 1 ? '' : 's'})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="mono dim order-slot-roster">
                      {sq
                        ? sq.members.length === 0
                          ? '— empty —'
                          : sq.members
                              .map(
                                (m) =>
                                  `"${bundle.operators.get(m.operatorId)?.callsign ?? m.operatorId}"`,
                              )
                              .join(' · ')
                        : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="order-footer">
        <div className="order-totals">
          <span className="mono dim">total strength</span>{' '}
          <span className="mono accent">{opCount}</span>{' '}
          <span className="mono dim">
            op{opCount === 1 ? '' : 's'} across {assignedSquads.length} element
            {assignedSquads.length === 1 ? '' : 's'}
          </span>{' '}
          {underCap ? (
            <span className="danger">need {contract.minOperators - opCount} more</span>
          ) : overCap ? (
            <span className="danger">over cap by {opCount - contract.maxOperators}</span>
          ) : (
            <span className="ok">ready</span>
          )}
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => go('armory')}>
            Edit Armory
          </button>
          <button type="button" className="btn btn-primary" disabled={!canLaunch} onClick={launch}>
            Deploy
          </button>
        </div>
      </section>
    </div>
  );
}
