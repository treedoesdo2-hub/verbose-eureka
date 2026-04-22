import React from 'react';
import type { HudEventEntry } from './hud-types';

type Props = {
  entries: readonly HudEventEntry[];
};

function EventFeedImpl({ entries }: Props): React.JSX.Element {
  const reversed = [...entries].reverse();
  return (
    <div className="hud-panel hud-event-feed">
      <ul>
        {reversed.map((e) => (
          <li key={e.id} className={`evt evt-${e.severity}`}>
            <span className="mono tick">t{e.tick}</span> {e.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const EventFeed = React.memo(EventFeedImpl);
