import React from 'react';
import type { UnitCardData } from './unit-card';

type Props = {
  data: UnitCardData | null;
  onClose?: () => void;
};

function bloodClass(pct: number): string {
  if (pct > 0.5) return 'blood-hi';
  if (pct > 0.25) return 'blood-mid';
  return 'blood-lo';
}

function UnitCardImpl({ data, onClose }: Props): React.JSX.Element | null {
  if (!data) return null;
  return (
    <div className="hud-panel hud-unit-card">
      <header>
        <div>
          <span className={`team-swatch team-${data.teamId}`} />{' '}
          <span className="callsign">"{data.callsign}"</span>{' '}
          {data.name ? <span className="dim">{data.name}</span> : null}
        </div>
        {onClose ? (
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="close">
            ×
          </button>
        ) : null}
      </header>
      <div className="mono dim status-line">
        {data.dead
          ? 'KIA'
          : data.downed
            ? 'DOWN'
            : `${data.actionKind} · ${data.stance} · ${data.aiState}${data.alerted ? ' · alerted' : ''}`}
      </div>
      <div className={`bar ${bloodClass(data.bloodPct)}`}>
        <span style={{ width: `${Math.round(data.bloodPct * 100)}%` }} />
      </div>
      <div className="mono dim bar-label">blood {Math.round(data.bloodPct * 100)}%</div>
      <div className="bar bar-morale">
        <span style={{ width: `${Math.round(data.moralePct * 100)}%` }} />
      </div>
      <div className="mono dim bar-label">morale {Math.round(data.moralePct * 100)}%</div>
      <div className="bar bar-suppression">
        <span style={{ width: `${Math.round(data.suppressionPct * 100)}%` }} />
      </div>
      <div className="mono dim bar-label">suppression {Math.round(data.suppressionPct * 100)}%</div>
      <dl className="unit-card-stats">
        <dt>ammo</dt>
        <dd className="mono">{data.ammo}</dd>
        <dt>wounds</dt>
        <dd className="mono">
          {data.woundCount === 0
            ? 'none'
            : `${data.woundCount}${data.worstWoundSeverity ? ` (${data.worstWoundSeverity})` : ''}`}
        </dd>
        <dt>target</dt>
        <dd className="mono">{data.target ? `"${data.target.callsign}"` : '—'}</dd>
      </dl>
    </div>
  );
}

export const UnitCard = React.memo(UnitCardImpl);
