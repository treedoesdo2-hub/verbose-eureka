import React from 'react';
import type { HudObjective } from './hud-types';

type Props = {
  objectives: readonly HudObjective[];
};

const KIND_BADGE: Record<HudObjective['kind'], string> = {
  extract: 'EXTR',
  defend: 'DEF',
  secure: 'SEC',
};

function ObjectivesImpl({ objectives }: Props): React.JSX.Element | null {
  if (objectives.length === 0) return null;
  return (
    <div className="hud-panel hud-objectives">
      <h4>Objectives</h4>
      <ul>
        {objectives.map((o) => (
          <li key={`${o.kind}:${o.description}`}>
            <span className="mono badge">{KIND_BADGE[o.kind]}</span>
            <span className="desc">{o.description}</span>
            <span className={`mono status-${o.status}`}>{o.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const Objectives = React.memo(ObjectivesImpl);
