import type { ScenarioRequest } from '@shared/messages';
import { useState } from 'react';
import { getContent } from '../content';
import { getSimBridge } from '../sim-bridge';
import { useAppState } from '../stores/app-state';
import { useLoadouts } from '../stores/loadouts';

export function Briefing(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  const contractId = useAppState((s) => s.selectedContractId);
  const bundle = getContent();
  const contract = contractId ? bundle.contracts.get(contractId) : null;
  const loadoutsStore = useLoadouts((s) => s.byOperator);

  const operators = [...bundle.operators.values()].slice(0, contract?.maxOperators ?? 6);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(operators.map((o) => o.id)));

  function toggle(id: string): void {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function launch(): void {
    if (!contract) return;
    const deployed = operators.filter((o) => selected.has(o.id));
    const perOperatorLoadouts: ScenarioRequest['perOperatorLoadouts'] = {};
    for (const op of deployed) {
      const l = loadoutsStore.get(op.id);
      if (l) {
        perOperatorLoadouts[op.id] = {
          primaryWeaponId: l.primaryWeaponId,
          sidearmId: l.sidearmId,
          armorId: l.armorId,
          utilityIds: [...l.utilityIds],
        };
      } else {
        const tpl = bundle.templates.get(op.defaultTemplateId);
        if (tpl) {
          perOperatorLoadouts[op.id] = {
            primaryWeaponId: tpl.primaryWeaponId,
            sidearmId: tpl.sidearmId,
            armorId: tpl.armorId,
            utilityIds: [...tpl.utilityIds],
          };
        }
      }
    }

    const bridge = getSimBridge();
    bridge.send({
      type: 'startSim',
      payload: {
        seed: Date.now() & 0xffff,
        contractId: contract.id,
        simSpeedMultiplier: 1,
        scenarioRequest: {
          seed: Date.now() & 0xffff,
          contractId: contract.id,
          mapId: contract.mapId,
          deployedOperatorIds: deployed.map((o) => o.id),
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

  const canLaunch =
    selected.size >= contract.minOperators && selected.size <= contract.maxOperators;

  return (
    <div className="screen">
      <div className="screen-header">
        <button type="button" className="btn btn-small" onClick={() => go('board')}>
          ← board
        </button>
        <h2>Briefing · {contract.name}</h2>
      </div>
      <p className="briefing">{contract.briefing}</p>
      <h3>Deploy operators ({selected.size} selected)</h3>
      <div className="operator-grid">
        {operators.map((op) => {
          const tpl = bundle.templates.get(op.defaultTemplateId);
          return (
            <label key={op.id} className={`operator-card${selected.has(op.id) ? ' selected' : ''}`}>
              <input type="checkbox" checked={selected.has(op.id)} onChange={() => toggle(op.id)} />
              <header>
                <span className="callsign">"{op.callsign}"</span>
                <span className="name">{op.name}</span>
                <span className={`tier tier-${op.tier}`}>{op.tier}</span>
              </header>
              <div className="stats mono">
                AIM {op.stats.aim} · MOV {op.stats.move} · GRT {op.stats.grit} · AWR{' '}
                {op.stats.awareness} · MED {op.stats.medical}
              </div>
              <div className="loadout mono">{tpl?.name ?? op.defaultTemplateId}</div>
            </label>
          );
        })}
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={!canLaunch} onClick={launch}>
          Deploy
        </button>
      </div>
    </div>
  );
}
