import { computeDeployCost, computePayoutBreakdown } from '@sim/contract-economics';
import { useEffect, useMemo } from 'react';
import { getContent } from '../content';
import { useSimSnapshot } from '../hooks/use-sim';
import { CombatHud } from '../hud/CombatHud';
import type { HudObjective } from '../hud/hud-types';
import { CombatView } from '../render/combat-view';
import { getSimBridge } from '../sim-bridge';
import { useAppState } from '../stores/app-state';
import { type SimSpeed, useSettings } from '../stores/settings';

const SPEEDS: readonly SimSpeed[] = [0.5, 1, 2, 4, 8];

export function Deploy(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  const contractId = useAppState((s) => s.selectedContractId);
  const deploySelection = useAppState((s) => s.deploySelection);
  const setDebrief = useAppState((s) => s.setDebrief);
  const simSpeed = useSettings((s) => s.simSpeed);
  const setSimSpeed = useSettings((s) => s.setSimSpeed);
  const paused = useSettings((s) => s.simPaused);
  const togglePause = useSettings((s) => s.togglePause);
  const setPaused = useSettings((s) => s.setPaused);
  const { snapshot, world, ended } = useSimSnapshot();

  useEffect(() => {
    getSimBridge().send({ type: 'setSpeed', multiplier: simSpeed });
  }, [simSpeed]);

  useEffect(() => {
    getSimBridge().send({ type: paused ? 'pause' : 'resume' });
  }, [paused]);

  useEffect(() => {
    return () => {
      setPaused(false);
    };
  }, [setPaused]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === ' ') {
        e.preventDefault();
        togglePause();
        return;
      }
      const idx = ['1', '2', '3', '4', '5'].indexOf(e.key);
      if (idx >= 0) {
        setSimSpeed(SPEEDS[idx]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause, setSimSpeed]);

  useEffect(() => {
    if (!ended || !snapshot) return;
    const bundle = getContent();
    const contract = contractId ? bundle.contracts.get(contractId) : null;
    const playerUnits = snapshot.units.filter((u) => u.teamId === 0);
    const casualties = playerUnits
      .filter((u) => u.actionKind === 'dead')
      .map((u) => u.operatorId ?? `unit-${u.id}`);
    const survivors = playerUnits
      .filter((u) => u.actionKind !== 'dead')
      .map((u) => u.operatorId ?? `unit-${u.id}`);

    let gross = 0;
    let deployCostTotal = 0;
    if (contract) {
      const breakdown = computePayoutBreakdown(contract);
      // Binary success per ADR 011 Addendum 2 §C. TODO(#89): when the
      // objective runtime lands, gate secondaryBonusCash on all secondary
      // objectives complete rather than the blanket team-0 win.
      gross =
        ended.winner === 0
          ? breakdown.cashFull + breakdown.secondaryBonusCash
          : breakdown.cashFloor;
      const deployedOps = deploySelection
        .map((id) => bundle.operators.get(id))
        .filter((o): o is NonNullable<typeof o> => !!o);
      deployCostTotal = computeDeployCost(contract, deployedOps).total;
    }

    setDebrief({
      winner: ended.winner,
      endReason: ended.endReason,
      casualties,
      survivors,
      payout: gross,
      deployCost: deployCostTotal,
      netCash: gross - deployCostTotal,
      stats: ended.stats,
    });
    setTimeout(() => go('debrief'), 800);
  }, [ended, snapshot, contractId, deploySelection, setDebrief, go]);

  const team0Alive =
    snapshot?.units.filter((u) => u.teamId === 0 && u.actionKind !== 'dead').length ?? 0;
  const team1Alive =
    snapshot?.units.filter((u) => u.teamId === 1 && u.actionKind !== 'dead').length ?? 0;

  const hudObjectives = useMemo<readonly HudObjective[]>(() => {
    if (!contractId) return [];
    const bundle = getContent();
    const contract = bundle.contracts.get(contractId);
    if (!contract) return [];
    return contract.objectives.map((o) => ({
      kind: o.kind,
      description: o.description,
      status: 'active' as const,
    }));
  }, [contractId]);

  return (
    <div className="deploy-layout">
      <aside className="deploy-hud-left">
        <h3>Team A</h3>
        <div className="mono">{team0Alive} active</div>
        <hr />
        <h3>Control</h3>
        <div className="speed-controls">
          <button
            type="button"
            className={`btn btn-small${paused ? ' active' : ''}`}
            onClick={togglePause}
            title="Pause/resume (Space)"
          >
            {paused ? '▶ resume' : '❙❙ pause'}
          </button>
        </div>
        <h3 style={{ marginTop: 10 }}>Speed</h3>
        <div className="speed-controls">
          {SPEEDS.map((s, i) => (
            <button
              key={s}
              type="button"
              className={`btn btn-small${simSpeed === s ? ' active' : ''}`}
              onClick={() => setSimSpeed(s)}
              title={`Set speed to ${s}× (${i + 1})`}
            >
              {s}×
            </button>
          ))}
        </div>
        <p className="mono dim" style={{ marginTop: 6, fontSize: 10 }}>
          shortcuts · space: pause · 1–5: speed
        </p>
        <hr />
        <h3>Tick</h3>
        <div className="mono">{snapshot?.tick ?? 0}</div>
      </aside>
      <main className="deploy-main">
        {world ? (
          <>
            <CombatView world={world} snapshot={snapshot} />
            <CombatHud world={world} snapshot={snapshot} objectives={hudObjectives} />
          </>
        ) : (
          <div className="loading">Starting sim…</div>
        )}
      </main>
      <aside className="deploy-hud-right">
        <h3>Opposition</h3>
        <div className="mono">{team1Alive} active</div>
        <hr />
        <h3>Units</h3>
        <ul className="unit-list">
          {snapshot?.units.map((u) => (
            <li key={u.id} className={`unit-item team-${u.teamId}`}>
              <span className="name">#{u.id}</span>
              <span className="mono blood">{Math.round(u.blood)}</span>
              <span className="action">{u.actionKind}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
