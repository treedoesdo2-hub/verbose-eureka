// S6 — NEON WIRE debrief / AAR (after-action report).
// 3-column: classified rail (left) | center map + key numbers | side
// ledger (right) + footer with archive / next-contract chips.
//
// AAR squad-snapshot mechanic (#466–#469) is deferred to DEFERRED.md;
// the center map renders a placeholder schematic until the sim-side
// snapshot capture lands.

import type { PerUnitStats } from '@shared/snapshot';
import { useMemo } from 'react';
import { getContent } from '../content';
import { useHotkeys } from '../hooks/useHotkeys';
import { NW, NWChip, NWCTA, NWPanel } from '../neonwire';
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
        <CenterAARMap />
        <RightLedger
          stats={stats}
          enemyKills={enemyKills}
          enemyDowns={enemyDowns}
          playerWounds={playerWounds}
          playerUnits={playerUnits}
          bundle={bundle}
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

function CenterAARMap(): React.JSX.Element {
  return (
    <NWPanel
      title="MAP · AAR SNAPSHOTS"
      padding={0}
      style={{ minHeight: 0, overflow: 'hidden' }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: NW.bg2,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 320,
        }}
      >
        <svg viewBox="0 0 200 100" style={{ width: '100%', height: 'auto', flex: 1 }}>
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
          <rect width="200" height="100" fill="url(#aar-grid)" />
          {/* Phase lines — placeholder schematic until #466–#469 wires real
              squad-position snapshots. */}
          {[0.25, 0.5, 0.75].map((p, i) => (
            <line
              key={i}
              x1={p * 200}
              y1={10}
              x2={p * 200}
              y2={90}
              stroke={NW.cyan}
              strokeWidth="0.4"
              strokeDasharray="2 3"
              opacity="0.3"
            />
          ))}
          {/* Axis of advance */}
          <path
            d="M 20 80 L 60 60 L 100 50 L 140 50 L 180 50"
            stroke={NW.cyan}
            strokeWidth="1"
            fill="none"
            opacity="0.7"
          />
          {/* T0 / T0.25 / T0.5 / T0.75 / T1.0 markers */}
          {[
            [20, 80],
            [60, 60],
            [100, 50],
            [140, 50],
            [180, 50],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill={NW.amber} />
              <text
                x={x}
                y={y - 6}
                fill={NW.amber}
                fontSize="5"
                fontFamily={NW.mono}
                textAnchor="middle"
                letterSpacing="0.2"
              >
                T{i === 0 ? '0' : `0.${i * 25}`.replace(/0$/, '5')}
              </text>
            </g>
          ))}
        </svg>
        <div
          style={{
            padding: 14,
            borderTop: `1px solid ${NW.line}`,
            fontFamily: NW.mono,
            fontSize: 10,
            color: NW.fg2,
            letterSpacing: '0.12em',
          }}
        >
          <span style={{ color: NW.amber }}>◆ NOTE</span> · per-quarter squad
          snapshots are deferred — see DEFERRED.md (#292.09–#292.12). The
          axis above is a placeholder schematic.
        </div>
      </div>
    </NWPanel>
  );
}

function RightLedger({
  stats,
  enemyKills,
  enemyDowns,
  playerWounds,
  playerUnits,
  bundle,
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
}): React.JSX.Element {
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
      {stats && stats.highlights.length > 0 ? (
        <NWPanel title="STANDOUT MOMENTS" style={{ flexShrink: 0 }}>
          {stats.highlights.slice(0, 4).map((h) => {
            const op = h.operatorId ? bundle.operators.get(h.operatorId) : null;
            const callsign = op?.callsign ?? h.operatorId ?? `unit-${h.unitId}`;
            return (
              <div
                key={`${h.kind}-${h.unitId}-${h.text}`}
                style={{
                  padding: '6px 0',
                  borderBottom: `1px dotted ${NW.line2}`,
                  fontFamily: NW.mono,
                  fontSize: 10,
                  color: NW.fg1,
                  display: 'flex',
                  gap: 8,
                }}
              >
                <span style={{ color: NW.amber, letterSpacing: '0.14em' }}>"{callsign}"</span>
                <span>{h.text}</span>
              </div>
            );
          })}
        </NWPanel>
      ) : null}
    </div>
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
