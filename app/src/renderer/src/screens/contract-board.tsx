import { getContent } from '../content';
import { useAppState } from '../stores/app-state';

export function ContractBoard(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  const selectContract = useAppState((s) => s.selectContract);
  const bundle = getContent();
  const contracts = [...bundle.contracts.values()];

  return (
    <div className="screen">
      <div className="screen-header">
        <button type="button" className="btn btn-small" onClick={() => go('menu')}>
          ← menu
        </button>
        <h2>Contract board</h2>
      </div>
      <div className="contract-list">
        {contracts.map((c) => (
          <div key={c.id} className="contract-card">
            <header>
              <span className="title">{c.name}</span>
              <span className="pay mono">{c.payout.toLocaleString()} cr</span>
            </header>
            <p className="briefing">{c.briefing}</p>
            <dl>
              <dt>map</dt>
              <dd>{bundle.maps.get(c.mapId)?.name ?? c.mapId}</dd>
              <dt>team size</dt>
              <dd>
                {c.minOperators}–{c.maxOperators}
              </dd>
              <dt>opposition</dt>
              <dd>{c.enemies.archetypes.map((a) => `${a.count}× ${a.archetype}`).join(', ')}</dd>
            </dl>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  selectContract(c.id);
                  go('briefing');
                }}
              >
                Accept
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
