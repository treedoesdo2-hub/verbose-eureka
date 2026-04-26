// S6 — NEON WIRE debrief / AAR (after-action report).
// 3-column: classified rail (left) | center map + key numbers | side
// ledger (right) + footer with archive / next-contract chips.
//
// AAR squad-snapshot mechanic (#466–#469) is deferred to DEFERRED.md;
// the center map renders a placeholder schematic until the sim-side
// snapshot capture lands.

import type { AARSquadSnapshot, MatchHighlight, PerUnitStats } from '@shared/snapshot';
import { useMemo, useState } from 'react';
import { getContent } from '../content';
import { useHotkeys } from '../hooks/useHotkeys';
import { NW, NWChip, NWCTA, NWPanel, NWStatusDot, type NWAccent } from '../neonwire';
import { useAppState } from '../stores/app-state';

export function Debrief(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  const debrief = useAppState((s) => s.lastDebrief);
  const bundle = getContent();

  useHotkeys([{ key: 'Escape', handler: () => go('menu') }]);

  if (!debrief) {
    return (
      <div
        style={{
          background: NW.bg0,
          color: NW.fg0,
          fontFamily: NW.body,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <span style={{ fontFamily: NW.mono, fontSize: 12, color: NW.fg2, letterSpacing: '0.14em' }}>
          NO MATCH ON FILE
        </span>
        <NWChip onClick={() => go('menu')}>← MENU</NWChip>
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
  const survivors = playerUnits.filter((u) => u.survived).length;
  const casualties = playerUnits.length - survivors;

  return (
    <div
      style={{
        background: NW.bg0,
        color: NW.fg0,
        fontFamily: NW.body,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '320px 1fr 360px',
          gap: 12,
          padding: 12,
        }}
      >
        <LeftRail
          won={won}
          endReason={debrief.endReason}
          totalMinutes={totalMinutes}
          payout={debrief.payout}
          deployCost={debrief.deployCost}
          netCash={debrief.netCash}
          casualties={casualties}
          survivors={survivors}
        />
        <CenterAARMap snapshots={stats?.snapshots ?? []} totalTicks={stats?.totalTicks ?? 0} />
        <RightLedger
          stats={stats}
          enemyKills={enemyKills}
          enemyDowns={enemyDowns}
          playerWounds={playerWounds}
          playerUnits={playerUnits}
          bundle={bundle}
          won={won}
        />
      </div>
      <Footer
        onAnotherContract={() => go('board')}
        onMenu={() => go('menu')}
        won={won}
      />
    </div>
  );
}

function LeftRail({
  won,
  endReason,
  totalMinutes,
  payout,
  deployCost,
  netCash,
  casualties,
  survivors,
}: {
  won: boolean;
  endReason: string | undefined;
  totalMinutes: number | null;
  payout: number;
  deployCost: number;
  netCash: number;
  casualties: number;
  survivors: number;
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      {/* Amber diagonal-hatch classified banner */}
      <div
        style={{
          height: 14,
          flexShrink: 0,
          backgroundImage: `repeating-linear-gradient(45deg, ${NW.amber} 0 8px, transparent 8px 16px)`,
          opacity: 0.6,
        }}
        aria-hidden
      />
      <NWPanel title="DOC HEADER">
        <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, lineHeight: 1.6 }}>
          OP · LATEST
          <br />
          DATE · {new Date().toISOString().slice(0, 10)}
          <br />
          AUTHOR · S3-OPS
          <br />
          DIST · BN CMD ONLY
        </div>
      </NWPanel>
      <NWPanel title="EXECUTIVE SUMMARY" accent={won ? 'cyan' : 'magenta'}>
        <div
          style={{
            fontFamily: NW.display,
            fontSize: 22,
            fontWeight: 700,
            color: won ? NW.cyan : NW.magenta,
            letterSpacing: '0.06em',
          }}
        >
          {won ? 'MISSION COMPLETE' : 'CONTRACT FORFEIT'}
        </div>
        <div style={{ fontFamily: NW.mono, fontSize: 11, color: NW.fg1, marginTop: 8 }}>
          {endReason ?? 'Outcome unrecorded.'}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginTop: 12,
            fontFamily: NW.mono,
            fontSize: 10,
          }}
        >
          <KV label="DURATION" value={totalMinutes !== null ? `${totalMinutes} min` : '—'} />
          <KV label="SURVIVORS" value={String(survivors)} tone="green" />
          <KV label="CASUALTIES" value={String(casualties)} tone={casualties > 0 ? 'magenta' : undefined} />
        </div>
      </NWPanel>
      <NWPanel title="CONTRACT PERFORMANCE" accent="amber">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            fontFamily: NW.mono,
            fontSize: 10,
          }}
        >
          <KV label="GROSS PAYOUT" value={`¥${payout.toLocaleString()}`} tone="amber" />
          <KV label="DEPLOY COST" value={`−¥${deployCost.toLocaleString()}`} tone="magenta" />
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: NW.display,
            fontSize: 22,
            fontWeight: 700,
            color: netCash >= 0 ? NW.green : NW.magenta,
            letterSpacing: '0.04em',
          }}
        >
          {netCash >= 0 ? '+' : ''}¥{netCash.toLocaleString()}
        </div>
        <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.14em' }}>
          NET CASH
        </div>
      </NWPanel>
    </div>
  );
}

function CenterAARMap({
  snapshots,
  totalTicks,
}: {
  snapshots: readonly AARSquadSnapshot[];
  totalTicks: number;
}): React.JSX.Element {
  // Scrubber index — defaults to the last snapshot. Clicking a scrubber
  // dot or pressing ←/→ would also work; for MVP the click handler on
  // the scrubber dots is enough.
  const [phaseIdx, setPhaseIdx] = useState<number>(Math.max(0, snapshots.length - 1));
  // Determine the world bounds from snapshot positions so the SVG fits
  // the play area (we don't have a world-size value in MatchStats).
  const bounds = useMemo(() => computeBounds(snapshots), [snapshots]);

  if (snapshots.length === 0) {
    return (
      <NWPanel title="MAP · AAR SNAPSHOTS" padding={0} style={{ minHeight: 0 }}>
        <div
          style={{
            padding: 32,
            fontFamily: NW.mono,
            fontSize: 11,
            color: NW.fg2,
            textAlign: 'center',
          }}
        >
          NO SNAPSHOT DATA · match too short
        </div>
      </NWPanel>
    );
  }

  const cur = snapshots[Math.min(phaseIdx, snapshots.length - 1)];
  // Build a path that connects each squad's center across all snapshots
  // so the player sees movement, not just the final pin.
  const squadIds = uniqueSquadIds(snapshots);

  const w = bounds.maxX - bounds.minX || 100;
  const h = bounds.maxY - bounds.minY || 100;
  const pad = Math.max(w, h) * 0.08;
  const vbX = bounds.minX - pad;
  const vbY = bounds.minY - pad;
  const vbW = w + 2 * pad;
  const vbH = h + 2 * pad;

  return (
    <NWPanel
      title={`MAP · AAR SNAPSHOTS · ${snapshots.length}`}
      padding={0}
      style={{ minHeight: 0, overflow: 'hidden' }}
    >
      <div
        style={{
          background: NW.bg2,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 360,
        }}
      >
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: 'auto', flex: 1 }}
        >
          <title>after-action-report regional map</title>
          <defs>
            <pattern id="aar-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M 10 0 H 0 V 10"
                stroke={NW.line}
                strokeWidth="0.3"
                fill="none"
                opacity="0.5"
              />
            </pattern>
          </defs>
          <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="url(#aar-grid)" />

          {/* Friendly squad axes — connect the centers across all
              snapshots, then dot the current snapshot. */}
          {squadIds.map((sqId, i) => {
            const points = snapshots
              .map((s) => s.squads.find((q) => (q.squadId ?? '__unassigned__') === sqId))
              .filter((q): q is NonNullable<typeof q> => !!q && q.aliveCount > 0);
            if (points.length < 2) return null;
            const path = points.map((p, j) =>
              `${j === 0 ? 'M' : 'L'} ${p.centerX.toFixed(2)} ${p.centerY.toFixed(2)}`,
            ).join(' ');
            return (
              <path
                key={sqId}
                d={path}
                fill="none"
                stroke={squadColor(i)}
                strokeWidth={Math.max(0.5, vbW / 200)}
                strokeDasharray="2 1.5"
                opacity={0.55}
              />
            );
          })}

          {/* Hostile center axis. */}
          {(() => {
            const hpts = snapshots.map((s) => s.hostileCenter).filter((h): h is NonNullable<typeof h> => !!h);
            if (hpts.length < 2) return null;
            const path = hpts.map((p, j) =>
              `${j === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
            ).join(' ');
            return (
              <path d={path} fill="none" stroke={NW.magenta} strokeWidth={Math.max(0.5, vbW / 200)} strokeDasharray="3 2" opacity={0.5} />
            );
          })()}

          {/* Current-phase squad markers. */}
          {cur.squads.map((q, i) => {
            const sqId = q.squadId ?? '__unassigned__';
            const idx = squadIds.indexOf(sqId);
            const c = squadColor(idx >= 0 ? idx : i);
            return (
              <g key={sqId}>
                <circle
                  cx={q.centerX}
                  cy={q.centerY}
                  r={Math.max(1.5, vbW / 60)}
                  fill={c}
                  opacity={q.aliveCount > 0 ? 0.85 : 0.35}
                />
                <text
                  x={q.centerX}
                  y={q.centerY - vbW / 40}
                  fill={c}
                  fontSize={vbW / 50}
                  fontFamily={NW.mono}
                  textAnchor="middle"
                  letterSpacing="0.4"
                >
                  {sqId === '__unassigned__' ? 'TF' : sqId.slice(-3).toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Hostile center for current phase. */}
          {cur.hostileCenter && (
            <circle
              cx={cur.hostileCenter.x}
              cy={cur.hostileCenter.y}
              r={Math.max(1.5, vbW / 60)}
              fill={NW.magenta}
              stroke={NW.bg0}
              strokeWidth={0.4}
            />
          )}
        </svg>

        {/* Timeline scrubber (#292.12). One dot per snapshot; clicking a
            dot rewinds the visible squads. */}
        <div
          style={{
            padding: '8px 14px',
            borderTop: `1px solid ${NW.line}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div
            style={{
              fontFamily: NW.mono,
              fontSize: 9,
              color: NW.fg2,
              letterSpacing: '0.16em',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>◆ TIMELINE</span>
            <span>
              T+{tickToTimeStr(cur.tick)} ·{' '}
              {totalTicks > 0 ? Math.round((cur.tick / totalTicks) * 100) : 0}%
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {snapshots.map((s, i) => (
              <button
                key={s.tick}
                type="button"
                onClick={() => setPhaseIdx(i)}
                title={`T+${tickToTimeStr(s.tick)} · ${s.squads.length} squads`}
                style={{
                  flex: 1,
                  height: 12,
                  background: i === phaseIdx ? NW.cyan : NW.line2,
                  boxShadow: i === phaseIdx ? `0 0 6px ${NW.cyan}80` : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  clipPath: 'polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </NWPanel>
  );
}

function computeBounds(snapshots: readonly AARSquadSnapshot[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const s of snapshots) {
    for (const q of s.squads) {
      if (q.aliveCount === 0) continue;
      minX = Math.min(minX, q.centerX);
      minY = Math.min(minY, q.centerY);
      maxX = Math.max(maxX, q.centerX);
      maxY = Math.max(maxY, q.centerY);
    }
    if (s.hostileCenter) {
      minX = Math.min(minX, s.hostileCenter.x);
      minY = Math.min(minY, s.hostileCenter.y);
      maxX = Math.max(maxX, s.hostileCenter.x);
      maxY = Math.max(maxY, s.hostileCenter.y);
    }
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }
  return { minX, minY, maxX, maxY };
}

function uniqueSquadIds(snapshots: readonly AARSquadSnapshot[]): string[] {
  const set = new Set<string>();
  for (const s of snapshots) {
    for (const q of s.squads) set.add(q.squadId ?? '__unassigned__');
  }
  return [...set];
}

function squadColor(index: number): string {
  const palette = [NW.cyan, NW.green, NW.amber];
  return palette[index % palette.length];
}

function tickToTimeStr(tick: number): string {
  const seconds = Math.floor(tick / 30);
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function RightLedger({
  stats,
  enemyKills,
  enemyDowns,
  playerWounds,
  playerUnits,
  bundle,
  won,
}: {
  stats: ReturnType<typeof useAppState.getState>['lastDebrief'] extends infer T
    ? T extends { stats: infer S }
      ? S
      : null
    : null;
  enemyKills: number;
  enemyDowns: number;
  playerWounds: number;
  playerUnits: PerUnitStats[];
  bundle: ReturnType<typeof getContent>;
  won: boolean;
}): React.JSX.Element {
  const highlights = stats?.highlights ?? [];
  const commsLines = useMemo(
    () => buildCommsExtracts(stats, playerUnits, bundle),
    [stats, playerUnits, bundle],
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <NWPanel title="KEY · LOSS LEDGER" accent="magenta">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            fontFamily: NW.mono,
            fontSize: 10,
          }}
        >
          <KV label="ENEMY KILLED" value={String(enemyKills)} tone="green" />
          <KV
            label="ENEMY DOWN"
            value={String(Math.max(0, enemyDowns - enemyKills))}
            tone="amber"
          />
          <KV label="WOUNDS TAKEN" value={String(playerWounds)} tone={playerWounds > 5 ? 'magenta' : undefined} />
        </div>
      </NWPanel>
      <NWPanel
        title="OPERATOR REPORT"
        padding={0}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {playerUnits.length === 0 ? (
            <div style={{ padding: 14, fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>
              no roster data
            </div>
          ) : (
            playerUnits.map((u) => {
              const op = u.operatorId ? bundle.operators.get(u.operatorId) : null;
              const acc =
                u.shotsFired === 0
                  ? '—'
                  : `${Math.round((u.hitsLanded / u.shotsFired) * 100)}%`;
              return (
                <div
                  key={u.unitId}
                  style={{
                    padding: '8px 14px',
                    borderBottom: `1px solid ${NW.line}`,
                    background: u.survived ? 'transparent' : 'rgba(255,45,154,0.06)',
                    borderLeft: `2px solid ${u.survived ? 'transparent' : NW.magenta}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: NW.display,
                        fontSize: 12,
                        fontWeight: 700,
                        color: u.survived ? NW.fg0 : NW.magenta,
                        letterSpacing: '0.04em',
                      }}
                    >
                      "{op?.callsign ?? u.operatorId ?? `u${u.unitId}`}"
                    </span>
                    <span
                      style={{
                        fontFamily: NW.mono,
                        fontSize: 9,
                        color: u.survived ? NW.green : NW.magenta,
                        letterSpacing: '0.14em',
                      }}
                    >
                      {u.survived ? '◆ STANDING' : '✕ DOWN'}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: NW.mono,
                      fontSize: 10,
                      color: NW.fg2,
                      display: 'flex',
                      gap: 10,
                      marginTop: 2,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>K{u.kills}</span>
                    <span>D{u.downs}</span>
                    <span>WND{u.woundsReceived}</span>
                    <span>SHT{u.shotsFired}</span>
                    <span>HIT{u.hitsLanded}</span>
                    <span>ACC{acc}</span>
                    {u.alliesStabilized > 0 ? (
                      <span style={{ color: NW.green }}>STAB{u.alliesStabilized}</span>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </NWPanel>
      <CommsExtractsPanel lines={commsLines} />
      <CommendationsPanel highlights={highlights} bundle={bundle} />
      <IntelGainedPanel
        won={won}
        enemyKills={enemyKills}
        enemyDowns={enemyDowns}
      />
    </div>
  );
}

// Comms extracts (#292.14). Reconstructs notable RTO transmissions
// from the per-unit stats: first kill, casualty calls, medic stabilize
// callouts. Stub-quality copy until the message bus surfaces real
// timestamps.
type CommsLine = {
  ts: string;
  src: string;
  tone: NWAccent;
  text: string;
};

function buildCommsExtracts(
  stats: ReturnType<typeof useAppState.getState>['lastDebrief'] extends infer T
    ? T extends { stats: infer S }
      ? S
      : null
    : null,
  playerUnits: PerUnitStats[],
  bundle: ReturnType<typeof getContent>,
): CommsLine[] {
  if (!stats) return [];
  const lines: CommsLine[] = [];
  lines.push({ ts: 'T+00:00', src: 'CMD', tone: 'cyan', text: 'spinning up — comms green' });
  // First confirmed kill — pick the player unit with highest kills.
  const aces = [...playerUnits].sort((a, b) => b.kills - a.kills);
  if (aces[0] && aces[0].kills > 0) {
    const op = aces[0].operatorId ? bundle.operators.get(aces[0].operatorId) : null;
    lines.push({
      ts: estimatedTs(stats.totalTicks, 0.25),
      src: op?.callsign?.slice(0, 3).toUpperCase() ?? 'A·1',
      tone: 'cyan',
      text: 'tango down — engaging next contact',
    });
  }
  // Casualty calls.
  const casualties = playerUnits.filter((u) => !u.survived);
  for (const c of casualties.slice(0, 2)) {
    const op = c.operatorId ? bundle.operators.get(c.operatorId) : null;
    lines.push({
      ts: estimatedTs(stats.totalTicks, 0.5),
      src: 'CAS',
      tone: 'magenta',
      text: `"${op?.callsign ?? c.operatorId ?? `u${c.unitId}`}" down — evac requested`,
    });
  }
  // Stabilize callouts.
  const medics = playerUnits.filter((u) => u.alliesStabilized > 0);
  for (const m of medics.slice(0, 1)) {
    const op = m.operatorId ? bundle.operators.get(m.operatorId) : null;
    lines.push({
      ts: estimatedTs(stats.totalTicks, 0.65),
      src: op?.callsign?.slice(0, 3).toUpperCase() ?? 'MED',
      tone: 'green',
      text: `${m.alliesStabilized} pax stabilized; bleed-out averted`,
    });
  }
  lines.push({
    ts: estimatedTs(stats.totalTicks, 1),
    src: 'CMD',
    tone: 'amber',
    text: 'extraction complete — net up',
  });
  return lines;
}

function estimatedTs(totalTicks: number, frac: number): string {
  const seconds = Math.floor((totalTicks * frac) / 30);
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `T+${m}:${s}`;
}

function CommsExtractsPanel({ lines }: { lines: readonly CommsLine[] }): React.JSX.Element {
  return (
    <NWPanel title="COMMS · EXTRACTS" padding={0} style={{ flexShrink: 0 }}>
      <div style={{ padding: 8 }}>
        {lines.map((l, i) => (
          <div
            key={`${l.ts}:${l.text}`}
            style={{
              fontFamily: NW.mono,
              fontSize: 10,
              color: NW.fg1,
              padding: '3px 0',
              display: 'flex',
              gap: 6,
              borderBottom: i < lines.length - 1 ? `1px solid ${NW.line}` : 'none',
            }}
          >
            <span style={{ color: NW.fg2 }}>{l.ts}</span>
            <span
              style={{
                color:
                  l.tone === 'amber'
                    ? NW.amber
                    : l.tone === 'magenta'
                      ? NW.magenta
                      : l.tone === 'green'
                        ? NW.green
                        : NW.cyan,
                fontWeight: 700,
              }}
            >
              {l.src}
            </span>
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    </NWPanel>
  );
}

// Commendations / reprimands (#292.16). Player-side highlights map to
// commendations (ace, medic, held-under-fire); heavy-casualty maps to
// a reprimand-flavoured red-bordered entry.
function CommendationsPanel({
  highlights,
  bundle,
}: {
  highlights: readonly MatchHighlight[];
  bundle: ReturnType<typeof getContent>;
}): React.JSX.Element | null {
  if (highlights.length === 0) return null;
  return (
    <NWPanel title="COMMENDATIONS · REPRIMANDS" style={{ flexShrink: 0 }}>
      {highlights.slice(0, 6).map((h) => {
        const op = h.operatorId ? bundle.operators.get(h.operatorId) : null;
        const callsign = op?.callsign ?? h.operatorId ?? `unit-${h.unitId}`;
        const isReprimand = h.kind === 'heavy-casualty';
        const tone: NWAccent = isReprimand ? 'magenta' : h.kind === 'medic' ? 'green' : 'amber';
        const c =
          tone === 'magenta' ? NW.magenta : tone === 'green' ? NW.green : NW.amber;
        return (
          <div
            key={`${h.kind}-${h.unitId}-${h.text}`}
            style={{
              padding: '6px 8px',
              borderLeft: `2px solid ${c}`,
              fontFamily: NW.mono,
              fontSize: 10,
              color: NW.fg1,
              marginBottom: 4,
              background: NW.bg2,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: c, fontWeight: 700, letterSpacing: '0.14em' }}>
                {isReprimand ? 'REPRIMAND' : 'COMMENDATION'} · {h.kind.replace(/-/g, ' ').toUpperCase()}
              </span>
            </div>
            <div style={{ marginTop: 2 }}>
              <span style={{ color: c }}>"{callsign}"</span> — {h.text}
            </div>
          </div>
        );
      })}
    </NWPanel>
  );
}

// Intel gained (#292.17). Static-tone summary of what the unit learned
// from the engagement — derived from outcome + scorecard until the
// intel-fragment system lands.
function IntelGainedPanel({
  won,
  enemyKills,
  enemyDowns,
}: {
  won: boolean;
  enemyKills: number;
  enemyDowns: number;
}): React.JSX.Element {
  const fragments: { tone: NWAccent; text: string }[] = [];
  if (enemyKills > 0) {
    fragments.push({
      tone: 'cyan',
      text: `${enemyKills} hostile KIA — equipment salvage logged for armory pickup`,
    });
  }
  if (enemyDowns > enemyKills) {
    fragments.push({
      tone: 'amber',
      text: `${enemyDowns - enemyKills} hostile downed — interrogation potential pending field-medic call`,
    });
  }
  if (won) {
    fragments.push({
      tone: 'green',
      text: 'sector control retained — patrol routes to cycle within 24h',
    });
  } else {
    fragments.push({
      tone: 'magenta',
      text: 'objective contested — rival faction movements logged for next cycle',
    });
  }
  return (
    <NWPanel title="INTEL · GAINED" style={{ flexShrink: 0 }}>
      {fragments.map((f, i) => (
        <div
          key={`${f.tone}:${f.text}`}
          style={{
            padding: '4px 0',
            fontFamily: NW.mono,
            fontSize: 10,
            color: NW.fg1,
            display: 'flex',
            gap: 6,
            borderBottom: i < fragments.length - 1 ? `1px dotted ${NW.line}` : 'none',
          }}
        >
          <NWStatusDot tone={f.tone} size={6} />
          <span>{f.text}</span>
        </div>
      ))}
    </NWPanel>
  );
}

function Footer({
  onAnotherContract,
  onMenu,
  won,
}: {
  onAnotherContract: () => void;
  onMenu: () => void;
  won: boolean;
}): React.JSX.Element {
  return (
    <div
      style={{
        height: 64,
        flexShrink: 0,
        background: NW.bg1,
        borderTop: `1px solid ${NW.line}`,
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span
        style={{
          fontFamily: NW.mono,
          fontSize: 10,
          color: NW.fg2,
          letterSpacing: '0.14em',
        }}
      >
        ARCHIVE · AAR-{Date.now().toString(36).toUpperCase()}
      </span>
      <span style={{ flex: 1 }} />
      <NWChip onClick={onMenu}>MAIN MENU</NWChip>
      <NWCTA primary={won} onClick={onAnotherContract}>
        ANOTHER CONTRACT
      </NWCTA>
    </div>
  );
}

function KV({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'amber' | 'green' | 'magenta';
}): React.JSX.Element {
  const c =
    tone === 'amber' ? NW.amber : tone === 'green' ? NW.green : tone === 'magenta' ? NW.magenta : NW.fg0;
  return (
    <div>
      <div style={{ color: NW.fg2, letterSpacing: '0.16em', fontSize: 9 }}>{label}</div>
      <div
        style={{
          color: c,
          fontFamily: NW.display,
          fontSize: 14,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}
