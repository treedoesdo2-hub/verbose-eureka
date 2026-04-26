// S1 — NEON WIRE main menu / HQ dashboard.
// 3-column layout: company card + nav stack + funds (left) | holo-map
// (center) | priority contract + contract teaser + ticker (right).
//
// Map is a hex-tiled district SVG at city scale — built with foresight
// for S9 zoom-out (#289.20). Hex geometry is reusable.

import type { Contract } from '@schema/contract';
import { useMemo } from 'react';
import { getContent } from '../content';
import {
  NW,
  NWBar,
  NWChip,
  NWCTA,
  NWLogo,
  NWPanel,
  NWStatusDot,
} from '../neonwire';
import { useAppState } from '../stores/app-state';
import { useCampaign } from '../stores/campaign';
import { useSquads } from '../stores/squads';

export function MainMenu(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  const selectContract = useAppState((s) => s.selectContract);
  const currency = useCampaign((s) => s.currency);
  const turn = useCampaign((s) => s.turn);
  const squads = useSquads((s) => s.squads);
  const bundle = getContent();

  const contracts = useMemo(() => [...bundle.contracts.values()], [bundle]);
  const priorityContract = contracts[0] ?? null;
  const otherContracts = contracts.slice(1, 6);
  const totalSquads = squads.size;
  const totalOperators = useMemo(() => {
    let n = 0;
    for (const sq of squads.values()) n += sq.members.length;
    return n;
  }, [squads]);

  return (
    <div
      style={{
        background: NW.bg0,
        color: NW.fg0,
        fontFamily: NW.body,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <SystemStrip />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '280px 1fr 440px',
          gap: 12,
          padding: 12,
        }}
      >
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <CompanyCard
            squadCount={totalSquads}
            operatorCount={totalOperators}
            turn={turn}
          />
          <NavStack go={go} />
          <FundsCard currency={currency} />
        </div>

        {/* Center holo-map */}
        <NWPanel
          title="SECTOR · OSAKA-1"
          padding={0}
          style={{ overflow: 'hidden', minHeight: 0 }}
          right={
            <>
              <NWChip small primary>
                SECTOR
              </NWChip>
              <NWChip small>CONTRACTS</NWChip>
              <NWChip small>RIVALS</NWChip>
            </>
          }
        >
          <HoloMap contracts={contracts.slice(0, 5)} />
        </NWPanel>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <PriorityContract
            contract={priorityContract}
            onAccept={() => {
              if (priorityContract) {
                selectContract(priorityContract.id);
                go('briefing');
              }
            }}
            onDecline={() => go('board')}
          />
          <ContractTeaser
            contracts={otherContracts}
            onPick={(c) => {
              selectContract(c.id);
              go('board');
            }}
          />
          <Ticker />
        </div>
      </div>
    </div>
  );
}

function SystemStrip(): React.JSX.Element {
  const now = useMemo(() => new Date().toISOString().slice(0, 10), []);
  return (
    <div
      style={{
        height: 32,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 20px',
        borderBottom: `1px solid ${NW.line}`,
        background: NW.bg1,
        fontFamily: NW.mono,
        fontSize: 11,
        color: NW.fg2,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      <NWLogo />
      <span style={{ color: NW.fgDim }}>║</span>
      <span style={{ color: NW.fg1 }}>NET · SECURE · Q-ENCR</span>
      <span style={{ color: NW.fgDim }}>║</span>
      <span style={{ color: NW.cyan }}>▸ /HQ</span>
      <span style={{ flex: 1 }} />
      <NWStatusDot tone="green" pulse />
      <span style={{ color: NW.fg1 }}>SYNCED · {now}</span>
    </div>
  );
}

function CompanyCard({
  squadCount,
  operatorCount,
  turn,
}: {
  squadCount: number;
  operatorCount: number;
  turn: number;
}): React.JSX.Element {
  return (
    <NWPanel title="COMPANY">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            fontFamily: NW.display,
            fontSize: 20,
            fontWeight: 700,
            color: NW.fg0,
            letterSpacing: '0.06em',
          }}
        >
          PAYROLL PMC
        </div>
        <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.1em' }}>
          LIC · OS-PMC-00418
          <br />
          HQ · OSAKA-1 · DEPOT
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
            marginTop: 4,
            fontFamily: NW.mono,
            fontSize: 10,
            color: NW.fg2,
          }}
        >
          <Stat label="SQUADS" value={String(squadCount)} />
          <Stat label="OPERATORS" value={String(operatorCount)} />
          <Stat label="TURN" value={String(turn)} />
          <Stat label="STATUS" value="READY" tone="green" />
        </div>
      </div>
    </NWPanel>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'green' | 'amber';
}): React.JSX.Element {
  return (
    <div>
      <div style={{ color: NW.fg2, letterSpacing: '0.16em', fontSize: 9 }}>{label}</div>
      <div
        style={{
          color: tone === 'green' ? NW.green : tone === 'amber' ? NW.amber : NW.fg0,
          fontFamily: NW.display,
          fontSize: 16,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function NavStack({
  go,
}: {
  go: (s: 'board' | 'armory' | 'orbat') => void;
}): React.JSX.Element {
  const items: { label: string; key: string; target: 'board' | 'armory' | 'orbat'; tone?: 'amber' }[] = [
    { label: 'CONTRACT BOARD', key: 'C', target: 'board', tone: 'amber' },
    { label: 'ARMORY', key: 'A', target: 'armory' },
    { label: 'ORBAT', key: 'O', target: 'orbat' },
  ];
  return (
    <NWPanel title="NAV">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it) => (
          <button
            key={it.target}
            type="button"
            onClick={() => go(it.target)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              borderLeft: `2px solid ${it.tone === 'amber' ? NW.amber : NW.line2}`,
              fontFamily: NW.mono,
              fontSize: 11,
              color: it.tone === 'amber' ? NW.amber : NW.fg1,
              letterSpacing: '0.14em',
              cursor: 'pointer',
              textAlign: 'left',
              textTransform: 'uppercase',
            }}
          >
            <span>▸ {it.label}</span>
            <span style={{ color: NW.fg2, fontSize: 9 }}>{it.key}</span>
          </button>
        ))}
      </div>
    </NWPanel>
  );
}

function FundsCard({ currency }: { currency: number }): React.JSX.Element {
  return (
    <NWPanel title="FUNDS" accent="amber">
      <div
        style={{
          fontFamily: NW.display,
          fontSize: 26,
          fontWeight: 700,
          color: NW.amber,
          letterSpacing: '0.04em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        ¥{currency.toLocaleString()}
      </div>
      <div
        style={{
          fontFamily: NW.mono,
          fontSize: 10,
          color: NW.fg2,
          marginTop: 4,
          letterSpacing: '0.14em',
        }}
      >
        TREASURY · LIQUID
      </div>
      <div style={{ marginTop: 10 }}>
        <NWBar value={Math.min(1, currency / 100000)} tone="amber" />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          marginTop: 10,
          fontFamily: NW.mono,
          fontSize: 10,
          color: NW.fg2,
        }}
      >
        <Stat label="REVENUE" value="¥0" />
        <Stat label="BURN" value="¥0" />
        <Stat label="ASSETS" value="¥0" />
        <Stat label="DEBT" value="¥0" />
      </div>
    </NWPanel>
  );
}

function HoloMap({ contracts }: { contracts: Contract[] }): React.JSX.Element {
  // Hex-tiled districts, schematic. The hex grid is a vocabulary
  // we can re-render at theater scale for S9; same `hexAt(col,row)`
  // helper, just zoomed out (#289.20).
  const cols = 11;
  const rows = 7;
  const hexes: { col: number; row: number; cx: number; cy: number; tone: 'bg' | 'aoi' | 'rival' }[] = [];
  const HEX_R = 22;
  const HEX_W = HEX_R * Math.sqrt(3);
  const HEX_H = HEX_R * 1.5;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * HEX_W + (row % 2 === 1 ? HEX_W / 2 : 0);
      const cy = row * HEX_H;
      let tone: 'bg' | 'aoi' | 'rival' = 'bg';
      if (col === 6 && row === 3) tone = 'aoi';
      if (col === 8 && row === 4) tone = 'rival';
      hexes.push({ col, row, cx, cy, tone });
    }
  }
  const W = (cols + 0.5) * HEX_W;
  const H = (rows + 0.5) * HEX_H;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320 }}>
      <svg
        viewBox={`0 -${HEX_R} ${W} ${H + HEX_R}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <title>HQ holographic map</title>
        <defs>
          <pattern id="hm-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 H 0 V 20"
              stroke={NW.line}
              strokeWidth="0.4"
              fill="none"
              opacity="0.4"
            />
          </pattern>
        </defs>
        <rect x="0" y={`-${HEX_R}`} width={W} height={H + HEX_R} fill="url(#hm-grid)" />

        {/* River — diagonal across map */}
        <path
          d={`M 0 ${H * 0.25} L ${W * 0.4} ${H * 0.45} L ${W * 0.7} ${H * 0.6} L ${W} ${H * 0.55}`}
          stroke={NW.cyan}
          strokeWidth="3"
          fill="none"
          opacity="0.25"
        />

        {hexes.map((h) => {
          const fill =
            h.tone === 'aoi'
              ? `${NW.cyan}33`
              : h.tone === 'rival'
                ? `${NW.magenta}33`
                : 'transparent';
          const stroke =
            h.tone === 'aoi' ? NW.cyan : h.tone === 'rival' ? NW.magenta : NW.line2;
          const sw = h.tone === 'bg' ? 0.4 : 1.4;
          return <Hex key={`${h.cx}-${h.cy}`} cx={h.cx} cy={h.cy} r={HEX_R} fill={fill} stroke={stroke} sw={sw} />;
        })}

        {/* Drone track — amber dashed path with pulse */}
        <path
          d={`M ${W * 0.1} ${H * 0.7} Q ${W * 0.4} ${H * 0.3} ${W * 0.7} ${H * 0.45}`}
          stroke={NW.amber}
          strokeWidth="1.4"
          strokeDasharray="6 4"
          fill="none"
          opacity="0.7"
        />

        {/* Contract pins */}
        {contracts.map((c, i) => {
          const cx = (i + 1) * (W / (contracts.length + 1));
          const cy = H * 0.55;
          return (
            <g key={c.id}>
              <Hex cx={cx} cy={cy} r={6} fill={NW.amber} stroke={NW.amber} sw={1} />
              <text
                x={cx}
                y={cy + 14}
                fill={NW.fg1}
                fontSize="6"
                fontFamily={NW.mono}
                textAnchor="middle"
                letterSpacing="0.4"
              >
                {c.id.slice(0, 8).toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Compass + scale strip */}
        <g transform={`translate(${W - 60} ${H - 20})`}>
          <text fill={NW.fg2} fontSize="6" fontFamily={NW.mono} letterSpacing="0.4">
            2KM ─────
          </text>
        </g>
        <g transform={`translate(20 ${H - 20})`}>
          <text fill={NW.fg2} fontSize="8" fontFamily={NW.mono} letterSpacing="0.4">
            N ↑
          </text>
        </g>
      </svg>

      {/* Atmo / wind / civ strip */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: 12,
          display: 'flex',
          gap: 12,
          fontFamily: NW.mono,
          fontSize: 10,
          color: NW.fg2,
          letterSpacing: '0.12em',
          pointerEvents: 'none',
        }}
      >
        <span>ATMO · 18°C · CLEAR</span>
        <span>WIND · 4kt NE</span>
        <span>CIV · DENSE</span>
        <span style={{ flex: 1 }} />
        <span>CONTRACTS · {contracts.length}</span>
      </div>
    </div>
  );
}

function Hex({
  cx,
  cy,
  r,
  fill,
  stroke,
  sw,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke: string;
  sw: number;
}): React.JSX.Element {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth={sw} />;
}

function PriorityContract({
  contract,
  onAccept,
  onDecline,
}: {
  contract: Contract | null;
  onAccept: () => void;
  onDecline: () => void;
}): React.JSX.Element {
  if (!contract) {
    return (
      <NWPanel title="PRIORITY CONTRACT" accent="amber">
        <div style={{ fontFamily: NW.mono, fontSize: 11, color: NW.fg2 }}>
          no contracts on the wire
        </div>
      </NWPanel>
    );
  }
  const payout = contract.payout?.cash ?? 0;
  const biome = contract.modifiers?.biomeHint ?? 'unknown';
  return (
    <NWPanel
      title="PRIORITY CONTRACT"
      accent="amber"
      style={{ position: 'relative' }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          backgroundImage: `repeating-linear-gradient(45deg, ${NW.amber}80 0 6px, transparent 6px 12px)`,
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          fontFamily: NW.display,
          fontSize: 18,
          fontWeight: 700,
          color: NW.amber,
          letterSpacing: '0.04em',
        }}
      >
        {contract.name}
      </div>
      <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, marginTop: 4 }}>
        {contract.id} · {biome.toString().toUpperCase()} · {contract.objectives.length} OBJ
      </div>
      <div
        style={{
          fontFamily: NW.mono,
          fontSize: 11,
          color: NW.fg1,
          marginTop: 8,
          lineHeight: 1.4,
        }}
      >
        {contract.briefing}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 14,
          marginTop: 12,
          alignItems: 'baseline',
          fontFamily: NW.mono,
          fontSize: 10,
        }}
      >
        <span style={{ color: NW.fg2 }}>PAY</span>
        <span
          style={{
            color: NW.amber,
            fontFamily: NW.display,
            fontSize: 16,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          ¥{payout.toLocaleString()}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <NWCTA primary onClick={onAccept}>
          ACCEPT
        </NWCTA>
        <NWChip onClick={onDecline}>DECLINE</NWChip>
      </div>
    </NWPanel>
  );
}

function ContractTeaser({
  contracts,
  onPick,
}: {
  contracts: Contract[];
  onPick: (c: Contract) => void;
}): React.JSX.Element {
  return (
    <NWPanel
      title="CONTRACT BOARD"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      padding={0}
    >
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {contracts.length === 0 ? (
          <div style={{ padding: 14, fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>
            no other contracts on the wire
          </div>
        ) : (
          contracts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                padding: '8px 14px',
                borderBottom: `1px solid ${NW.line}`,
                background: 'transparent',
                border: 'none',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: NW.display,
                    fontSize: 12,
                    fontWeight: 700,
                    color: NW.fg0,
                    letterSpacing: '0.04em',
                  }}
                >
                  {c.name}
                </div>
                <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>
                  {(c.modifiers?.biomeHint ?? '—').toString().toUpperCase()}
                </div>
              </div>
              <div
                style={{
                  fontFamily: NW.mono,
                  fontSize: 10,
                  color: NW.amber,
                  alignSelf: 'center',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ¥{(c.payout?.cash ?? 0).toLocaleString()}
              </div>
            </button>
          ))
        )}
      </div>
    </NWPanel>
  );
}

function Ticker(): React.JSX.Element {
  const lines = [
    'OS-PMC-00418 · CLEAR · NO HOLDS',
    'RIVAL · "RYUUSEI" · MOVED HQ → KOBE',
    'GRID · ATMO STABLE · TYPHOON BAND CLEARED',
  ];
  return (
    <NWPanel title="DARKNET · TICKER">
      {lines.map((l, i) => (
        <div
          key={l}
          style={{
            fontFamily: NW.mono,
            fontSize: 10,
            color: i === 0 ? NW.green : NW.fg1,
            letterSpacing: '0.08em',
            padding: '4px 0',
            borderBottom: i < lines.length - 1 ? `1px dotted ${NW.line2}` : 'none',
          }}
        >
          ▸ {l}
        </div>
      ))}
    </NWPanel>
  );
}

