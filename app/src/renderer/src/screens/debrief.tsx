import type { PerUnitStats } from '@shared/snapshot';
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
  const stats = debrief.stats;
  const playerUnits: PerUnitStats[] = (stats?.perUnit ?? []).filter((u) => u.teamId === 0);
  const totalMinutes = stats ? Math.round((stats.totalTicks / 30 / 60) * 10) / 10 : null;

  const enemyKills = stats
    ? stats.perUnit.filter((u) => u.teamId === 0).reduce((n, u) => n + u.kills, 0)
    : 0;
  const enemyDowns = stats
    ? stats.perUnit.filter((u) => u.teamId === 0).reduce((n, u) => n + u.downs, 0)
    : 0;
  const playerWounds = stats
    ? stats.perUnit.filter((u) => u.teamId === 0).reduce((n, u) => n + u.woundsReceived, 0)
    : 0;

  return (
    <div className="screen">
      <div className="screen-header">
        <h2>Debrief</h2>
      </div>
      <div className={`debrief-banner ${won ? 'won' : 'lost'}`}>
        {won ? 'Contract completed' : 'Contract failed'}
      </div>

      <section className="debrief-summary">
        <dl>
          <dt>end state</dt>
          <dd>{debrief.endReason ?? '—'}</dd>
          <dt>duration</dt>
          <dd className="mono">{totalMinutes !== null ? `${totalMinutes} min` : '—'}</dd>
          <dt>gross payout</dt>
          <dd className="mono accent">{debrief.payout.toLocaleString()} cr</dd>
          <dt>deploy cost</dt>
          <dd className="mono danger">−{debrief.deployCost.toLocaleString()} cr</dd>
          <dt>net</dt>
          <dd className={`mono ${debrief.netCash < 0 ? 'danger' : 'ok'}`}>
            {debrief.netCash >= 0 ? '+' : ''}
            {debrief.netCash.toLocaleString()} cr
          </dd>
          <dt>enemy down</dt>
          <dd className="mono">
            {enemyKills} killed · {enemyDowns - enemyKills} wounded
          </dd>
          <dt>wounds taken</dt>
          <dd className={`mono ${playerWounds > 5 ? 'danger' : ''}`}>{playerWounds} total</dd>
        </dl>
      </section>

      {stats && stats.highlights.length > 0 ? (
        <section className="debrief-highlights">
          <h3>Standout moments</h3>
          <ul>
            {stats.highlights.map((h) => {
              const op = h.operatorId ? bundle.operators.get(h.operatorId) : null;
              const callsign = op?.callsign ?? h.operatorId ?? `unit-${h.unitId}`;
              const key = `${h.kind}-${h.unitId}-${h.text}`;
              return (
                <li key={key} className={`highlight highlight-${h.kind}`}>
                  <span className="highlight-callsign">"{callsign}"</span>
                  <span className="highlight-text">{h.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="debrief-roster">
        <h3>Operator report</h3>
        {playerUnits.length === 0 ? (
          <p className="mono dim">No roster data.</p>
        ) : (
          <table className="dossier">
            <thead>
              <tr>
                <th>callsign</th>
                <th>status</th>
                <th className="num">K</th>
                <th className="num">D</th>
                <th className="num">wounds</th>
                <th className="num">shots</th>
                <th className="num">hits</th>
                <th className="num">blk</th>
                <th className="num">miss</th>
                <th className="num">acc</th>
                <th className="num">stab</th>
              </tr>
            </thead>
            <tbody>
              {playerUnits.map((u) => {
                const op = u.operatorId ? bundle.operators.get(u.operatorId) : null;
                const acc =
                  u.shotsFired === 0 ? '—' : `${Math.round((u.hitsLanded / u.shotsFired) * 100)}%`;
                return (
                  <tr key={u.unitId} className={u.survived ? '' : 'row-casualty'}>
                    <td>
                      <span className="callsign">
                        "{op?.callsign ?? u.operatorId ?? `u${u.unitId}`}"
                      </span>{' '}
                      <span className="dim">{op?.name ?? ''}</span>
                    </td>
                    <td>
                      {u.survived ? (
                        <span className="ok">standing</span>
                      ) : (
                        <span className="danger">down</span>
                      )}
                    </td>
                    <td className="num mono">{u.kills}</td>
                    <td className="num mono">{u.downs}</td>
                    <td className={`num mono ${u.woundsReceived > 0 ? 'danger' : ''}`}>
                      {u.woundsReceived}
                    </td>
                    <td className="num mono">{u.shotsFired}</td>
                    <td className="num mono">{u.hitsLanded}</td>
                    <td className="num mono dim">{u.shotsBlocked}</td>
                    <td className="num mono dim">{u.shotsMissed}</td>
                    <td className="num mono">{acc}</td>
                    <td className="num mono">{u.alliesStabilized}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

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
