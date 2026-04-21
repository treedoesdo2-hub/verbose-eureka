import { getContent } from '../content';
import { useAppState } from '../stores/app-state';

export function Debrief(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  const debrief = useAppState((s) => s.lastDebrief);
  const bundle = getContent();

  if (!debrief) {
    return (
      <div className="screen screen-center">
        <p>No match to debrief.</p>
        <button type="button" className="btn" onClick={() => go('menu')}>
          Back to menu
        </button>
      </div>
    );
  }

  const won = debrief.winner === 0;

  return (
    <div className="screen">
      <div className="screen-header">
        <h2>Debrief</h2>
      </div>
      <div className={`debrief-banner ${won ? 'won' : 'lost'}`}>
        {won ? 'Contract completed' : 'Contract failed'}
      </div>
      <dl className="debrief-stats">
        <dt>end state</dt>
        <dd>{debrief.endReason ?? '—'}</dd>
        <dt>payout</dt>
        <dd className="mono">{debrief.payout.toLocaleString()} cr</dd>
        <dt>survivors</dt>
        <dd>
          {debrief.survivors.length === 0
            ? '—'
            : debrief.survivors.map((id) => bundle.operators.get(id)?.callsign ?? id).join(', ')}
        </dd>
        <dt>casualties</dt>
        <dd className="danger">
          {debrief.casualties.length === 0
            ? 'none'
            : debrief.casualties.map((id) => bundle.operators.get(id)?.callsign ?? id).join(', ')}
        </dd>
      </dl>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => go('board')}>
          Another contract
        </button>
        <button type="button" className="btn" onClick={() => go('menu')}>
          Main menu
        </button>
      </div>
    </div>
  );
}
