// S7 ORBAT — order of battle screen, NEON WIRE.
// Shows the company's squads grouped by branch with APP-6-style plaques,
// a battalion banner, and per-squad readiness bars.
//
// MVP scope:
// - Battalion banner (top strip): designator + motto + headcount roll-up.
// - Company columns: squads grouped by branch, one column per branch
//   actually present in the roster. (No multi-company support yet — the
//   schema gained a Company entity, but content authoring is post-MVP;
//   see DEFERRED.md.)
// - Per-squad plaques: callsign + branch tone + readiness bar
//   (members.length / soulsAuthorized).
// - Drill-in panel (right): selected squad's roster with stat readout.
// - Filter chips: branch toggle bar.

import type { Branch, Squad } from '@schema/squad';
import { useMemo, useState } from 'react';
import { getContent } from '../content';
import {
  HEX_CLIP_TL_BR,
  NW,
  NWBar,
  NWChip,
  NWPanel,
  type NWAccent,
} from '../neonwire';
import { useAppState } from '../stores/app-state';
import { useHotkeys } from '../hooks/useHotkeys';
import { useSquads } from '../stores/squads';

const ALL_BRANCHES: Branch[] = [
  'infantry',
  'mechanized',
  'recon',
  'support',
  'medical',
  'engineering',
  'command',
];

function branchTone(b: Branch): NWAccent {
  switch (b) {
    case 'command':
      return 'amber';
    case 'recon':
      return 'green';
    case 'medical':
      return 'magenta';
    case 'engineering':
      return 'amber';
    case 'mechanized':
    case 'support':
    case 'infantry':
    default:
      return 'cyan';
  }
}

function readinessTier(filled: number, authorized: number): 'ready' | 'refit' | 'depleted' | 'out' {
  if (authorized === 0) return 'out';
  const ratio = filled / authorized;
  if (ratio >= 0.85) return 'ready';
  if (ratio >= 0.5) return 'refit';
  if (ratio > 0) return 'depleted';
  return 'out';
}

function tierColor(t: ReturnType<typeof readinessTier>): string {
  switch (t) {
    case 'ready':
      return NW.green;
    case 'refit':
      return NW.cyan;
    case 'depleted':
      return NW.amber;
    case 'out':
      return NW.magenta;
  }
}

export function Orbat(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  const squadMap = useSquads((s) => s.squads);
  const order = useSquads((s) => s.order);
  const squads = useMemo(
    () => order.map((id) => squadMap.get(id)).filter((x): x is Squad => !!x),
    [squadMap, order],
  );
  const [activeBranches, setActiveBranches] = useState<Set<Branch>>(new Set(ALL_BRANCHES));
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(squads[0]?.id ?? null);

  useHotkeys([{ key: 'Escape', handler: () => go('menu') }]);

  function toggleBranch(b: Branch): void {
    setActiveBranches((s) => {
      const next = new Set(s);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      // Keep at least one selected — empty filter = show all.
      return next.size === 0 ? new Set(ALL_BRANCHES) : next;
    });
  }

  const branchesPresent = useMemo(() => {
    const present = new Set<Branch>();
    for (const sq of squads) present.add(sq.branch);
    return [...present];
  }, [squads]);

  const visibleSquads = useMemo(
    () => squads.filter((sq) => activeBranches.has(sq.branch)),
    [squads, activeBranches],
  );

  const selectedSquad = useMemo(
    () => visibleSquads.find((sq) => sq.id === selectedSquadId) ?? visibleSquads[0] ?? null,
    [visibleSquads, selectedSquadId],
  );

  // TO&E roll-up for the battalion banner.
  const totalAuthorized = squads.reduce((s, sq) => s + sq.soulsAuthorized, 0);
  const totalFilled = squads.reduce((s, sq) => s + sq.members.length, 0);

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
        position: 'relative',
      }}
    >
      <BattalionBanner
        totalAuthorized={totalAuthorized}
        totalFilled={totalFilled}
        onBack={() => go('menu')}
      />

      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${NW.line}`,
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          background: NW.bg1,
        }}
      >
        <span
          style={{
            fontFamily: NW.mono,
            fontSize: 9,
            color: NW.fg2,
            letterSpacing: '0.18em',
            alignSelf: 'center',
            marginRight: 6,
          }}
        >
          ◆ FILTER
        </span>
        {ALL_BRANCHES.map((b) => (
          <NWChip
            key={b}
            small
            primary={activeBranches.has(b)}
            onClick={() => toggleBranch(b)}
            title={branchesPresent.includes(b) ? `${b} squads` : `no ${b} squads in roster`}
          >
            {b.toUpperCase()}
          </NWChip>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gap: 12,
          padding: 12,
          minHeight: 0,
        }}
      >
        <CompanyColumns
          squads={visibleSquads}
          selectedSquadId={selectedSquad?.id ?? null}
          onSelect={setSelectedSquadId}
        />
        <SquadDrillIn squad={selectedSquad} />
      </div>
    </div>
  );
}

function BattalionBanner({
  totalAuthorized,
  totalFilled,
  onBack,
}: {
  totalAuthorized: number;
  totalFilled: number;
  onBack: () => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        height: 88,
        flexShrink: 0,
        background: NW.bg1,
        borderBottom: `1px solid ${NW.line}`,
        padding: '0 20px',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <NWChip small onClick={onBack} title="Back to menu (Esc)" kbd="Esc">
        ← MENU
      </NWChip>
      <div>
        <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.cyan, letterSpacing: '0.2em' }}>
          ◆ BATTALION
        </div>
        <div
          style={{
            fontFamily: NW.display,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: NW.fg0,
          }}
        >
          1ST BN · "PAYROLL"
        </div>
        <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.1em' }}>
          ID 00001 · DEPOT · OSAKA-1
        </div>
      </div>
      <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: NW.mono, fontSize: 9, color: NW.fg2, letterSpacing: '0.18em' }}>
            HEADCOUNT
          </div>
          <div
            style={{
              fontFamily: NW.display,
              fontSize: 22,
              fontWeight: 700,
              color: NW.fg0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {totalFilled}{' '}
            <span style={{ color: NW.fg2, fontSize: 14 }}>/ {totalAuthorized}</span>
          </div>
        </div>
        <div style={{ width: 140 }}>
          <NWBar
            value={totalAuthorized > 0 ? totalFilled / totalAuthorized : 0}
            tone={totalFilled / totalAuthorized < 0.5 ? 'magenta' : 'cyan'}
          />
        </div>
      </div>
    </div>
  );
}

function CompanyColumns({
  squads,
  selectedSquadId,
  onSelect,
}: {
  squads: Squad[];
  selectedSquadId: string | null;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  // Group squads by branch. Each unique branch becomes a column —
  // visually equivalent to a "company" for now (true companies require
  // content authoring, deferred).
  const byBranch = new Map<Branch, Squad[]>();
  for (const sq of squads) {
    const arr = byBranch.get(sq.branch) ?? [];
    arr.push(sq);
    byBranch.set(sq.branch, arr);
  }
  const columns = [...byBranch.entries()];

  if (columns.length === 0) {
    return (
      <NWPanel title="ORBAT · COMPANIES">
        <div
          style={{
            padding: 20,
            fontFamily: NW.mono,
            fontSize: 11,
            color: NW.fg2,
            textAlign: 'center',
            letterSpacing: '0.08em',
          }}
        >
          NO SQUADS — author one in the armory squads tab
        </div>
      </NWPanel>
    );
  }

  return (
    <NWPanel
      title="ORBAT · COMPANIES"
      padding={0}
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: 14,
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(180px, 1fr))`,
          gap: 14,
        }}
      >
        {columns.map(([branch, sqs]) => (
          <CompanyColumn
            key={branch}
            branch={branch}
            squads={sqs}
            selectedSquadId={selectedSquadId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </NWPanel>
  );
}

function CompanyColumn({
  branch,
  squads,
  selectedSquadId,
  onSelect,
}: {
  branch: Branch;
  squads: Squad[];
  selectedSquadId: string | null;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const tone = branchTone(branch);
  return (
    <div>
      <div
        style={{
          fontFamily: NW.mono,
          fontSize: 9,
          letterSpacing: '0.18em',
          color: tone === 'amber' ? NW.amber : tone === 'green' ? NW.green : NW.cyan,
          padding: '4px 0 8px 0',
          borderBottom: `1px solid ${NW.line}`,
          marginBottom: 8,
        }}
      >
        ◆ {branch.toUpperCase()} · {squads.length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {squads.map((sq) => (
          <SquadPlaque
            key={sq.id}
            squad={sq}
            tone={tone}
            selected={selectedSquadId === sq.id}
            onClick={() => onSelect(sq.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SquadPlaque({
  squad,
  tone,
  selected,
  onClick,
}: {
  squad: Squad;
  tone: NWAccent;
  selected: boolean;
  onClick: () => void;
}): React.JSX.Element {
  const filled = squad.members.length;
  const authorized = squad.soulsAuthorized;
  const tier = readinessTier(filled, authorized);
  const tierC = tierColor(tier);
  const c =
    tone === 'amber' ? NW.amber : tone === 'green' ? NW.green : tone === 'magenta' ? NW.magenta : NW.cyan;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '10px 12px',
        clipPath: HEX_CLIP_TL_BR,
        WebkitClipPath: HEX_CLIP_TL_BR,
        background: selected ? `${c}1f` : NW.bg2,
        boxShadow: `inset 0 0 0 1px ${selected ? c : NW.line2}`,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontFamily: NW.display,
            fontSize: 14,
            fontWeight: 700,
            color: selected ? c : NW.fg0,
            letterSpacing: '0.04em',
          }}
        >
          {squad.name}
        </span>
        <span
          style={{ flex: 1, fontFamily: NW.mono, fontSize: 9, color: NW.fg2, textAlign: 'right' }}
        >
          SQD
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontFamily: NW.mono,
          fontSize: 10,
          color: NW.fg2,
        }}
      >
        <span>
          {filled}/{authorized}
        </span>
        <span style={{ color: tierC, letterSpacing: '0.1em' }}>{tier.toUpperCase()}</span>
      </div>
      <NWBar value={authorized > 0 ? filled / authorized : 0} tone={tone} />
    </button>
  );
}

function SquadDrillIn({ squad }: { squad: Squad | null }): React.JSX.Element {
  const bundle = getContent();
  return (
    <NWPanel
      title={squad ? `SQUAD · ${squad.name.toUpperCase()}` : 'SQUAD · —'}
      accent="amber"
      padding={0}
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
    >
      {squad ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: NW.mono,
                fontSize: 9,
                color: NW.cyan,
                letterSpacing: '0.18em',
                marginBottom: 6,
              }}
            >
              ◆ TO&E
            </div>
            <div
              style={{
                fontFamily: NW.mono,
                fontSize: 11,
                color: NW.fg1,
                lineHeight: 1.5,
              }}
            >
              BRANCH · {squad.branch.toUpperCase()}
              <br />
              AUTHORIZED · {squad.soulsAuthorized}
              <br />
              FILLED · {squad.members.length}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: NW.mono,
                fontSize: 9,
                color: NW.cyan,
                letterSpacing: '0.18em',
                marginBottom: 6,
              }}
            >
              ◆ ROSTER
            </div>
            {squad.members.length === 0 ? (
              <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>no members</div>
            ) : (
              squad.members.map((m, i) => {
                const op = bundle.operators.get(m.operatorId);
                return (
                  <div
                    key={`${m.operatorId}:${i}`}
                    style={{
                      padding: '6px 10px',
                      clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
                      background: NW.bg2,
                      boxShadow: `inset 0 0 0 1px ${NW.line2}`,
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: NW.display,
                        fontSize: 12,
                        fontWeight: 700,
                        color: NW.fg0,
                        letterSpacing: '0.04em',
                      }}
                    >
                      "{op?.callsign ?? m.operatorId}"
                    </div>
                    <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>
                      {op?.name ?? '—'} · {(op?.tier ?? 'green').toUpperCase()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: 20,
            fontFamily: NW.mono,
            fontSize: 11,
            color: NW.fg2,
            textAlign: 'center',
          }}
        >
          select a squad
        </div>
      )}
    </NWPanel>
  );
}
