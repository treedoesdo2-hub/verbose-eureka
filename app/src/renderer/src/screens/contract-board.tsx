// S4 — NEON WIRE contract board.
// 2-column: contract filters + list (left, ~560) | detail + map preview
// + actions (right). Click row → detail populates and (eventual) map
// zoom. ACCEPT → S5 briefing.

import type { Contract } from '@schema/contract';
import { interpolateBriefing } from '@sim/mapgen/contract-binder';
import { useMemo, useState } from 'react';
import { getContent } from '../content';
import { useHotkeys } from '../hooks/useHotkeys';
import { NW, NWBar, NWChip, NWCTA, NWPanel } from '../neonwire';
import { useAppState } from '../stores/app-state';

type FilterTab = 'all' | 'urban' | 'rural' | 'industrial' | 'priority';

export function ContractBoard(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  const selectContract = useAppState((s) => s.selectContract);
  const bundle = getContent();
  const contracts = useMemo(() => [...bundle.contracts.values()], [bundle]);

  const [tab, setTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(contracts[0]?.id ?? null);

  useHotkeys([{ key: 'Escape', handler: () => go('menu') }]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      const biome = (c.modifiers?.biomeHint ?? '').toString();
      if (tab === 'urban' && !biome.includes('urban')) return false;
      if (tab === 'rural' && !biome.includes('rural')) return false;
      if (tab === 'industrial' && !biome.includes('industrial')) return false;
      if (tab === 'priority' && c.difficultyRating < 4) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [contracts, tab, search]);

  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const totalPayout = filtered.reduce((s, c) => s + c.payout.cash, 0);
  const avgDifficulty =
    filtered.length === 0
      ? 0
      : filtered.reduce((s, c) => s + c.difficultyRating, 0) / filtered.length;

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
      <Header onBack={() => go('menu')} count={filtered.length} />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '560px 1fr',
          gap: 12,
          padding: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <NWPanel
            title="FILTERS"
            padding={0}
            style={{ flexShrink: 0 }}
          >
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: 10,
                borderBottom: `1px solid ${NW.line}`,
                flexWrap: 'wrap',
              }}
            >
              {(['all', 'urban', 'rural', 'industrial', 'priority'] as FilterTab[]).map((t) => (
                <NWChip key={t} small primary={tab === t} onClick={() => setTab(t)}>
                  {t.toUpperCase()}
                </NWChip>
              ))}
            </div>
            <div style={{ padding: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: NW.mono,
                  fontSize: 10,
                  padding: '4px 8px',
                  color: NW.fg2,
                  boxShadow: `inset 0 0 0 1px ${NW.line2}`,
                }}
              >
                <span style={{ color: NW.cyan }}>▸</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="search contracts…"
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontFamily: NW.mono,
                    fontSize: 10,
                    color: NW.fg0,
                  }}
                />
              </div>
            </div>
          </NWPanel>

          <NWPanel
            title="CONTRACTS"
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
              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    fontFamily: NW.mono,
                    fontSize: 11,
                    color: NW.fg2,
                    textAlign: 'center',
                  }}
                >
                  no contracts match
                </div>
              ) : (
                filtered.map((c) => (
                  <ContractRow
                    key={c.id}
                    contract={c}
                    bundle={bundle}
                    selected={c.id === selected?.id}
                    onSelect={() => setSelectedId(c.id)}
                  />
                ))
              )}
            </div>
          </NWPanel>

          <NWPanel title="ROLL-UP" accent="cyan" style={{ flexShrink: 0 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 10,
                fontFamily: NW.mono,
                fontSize: 10,
              }}
            >
              <Stat label="LISTED" value={String(filtered.length)} />
              <Stat label="TOTAL PAY" value={`¥${totalPayout.toLocaleString()}`} />
              <Stat label="AVG DIFF" value={avgDifficulty.toFixed(1)} />
            </div>
          </NWPanel>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <ContractMap contract={selected} />
          <ContractDetail contract={selected} bundle={bundle} />
          <ContractActions
            contract={selected}
            onAccept={() => {
              if (selected) {
                selectContract(selected.id);
                go('briefing');
              }
            }}
            onDecline={() => setSelectedId(null)}
          />
        </div>
      </div>
    </div>
  );
}

function Header({
  onBack,
  count,
}: {
  onBack: () => void;
  count: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        height: 56,
        flexShrink: 0,
        background: NW.bg1,
        borderBottom: `1px solid ${NW.line}`,
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <NWChip small onClick={onBack} kbd="Esc">
        ← MENU
      </NWChip>
      <span
        style={{
          fontFamily: NW.display,
          fontSize: 20,
          fontWeight: 700,
          color: NW.fg0,
          letterSpacing: '0.06em',
        }}
      >
        CONTRACT BOARD
      </span>
      <span style={{ flex: 1 }} />
      <span style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.14em' }}>
        ON THE WIRE · {count}
      </span>
    </div>
  );
}

function ContractRow({
  contract,
  bundle,
  selected,
  onSelect,
}: {
  contract: Contract;
  bundle: ReturnType<typeof getContent>;
  selected: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  const c = contract;
  const map = bundle.maps.get(c.mapId);
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 12,
        padding: '10px 14px',
        borderBottom: `1px solid ${NW.line}`,
        background: selected ? NW.cyanSoft : 'transparent',
        borderLeft: `2px solid ${selected ? NW.cyan : 'transparent'}`,
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        border: 'none',
        borderTop: 'none',
        borderRight: 'none',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: NW.display,
            fontSize: 13,
            fontWeight: 700,
            color: selected ? NW.cyan : NW.fg0,
            letterSpacing: '0.04em',
          }}
        >
          {c.name}
        </div>
        <div
          style={{
            fontFamily: NW.mono,
            fontSize: 10,
            color: NW.fg2,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span>{(c.modifiers?.biomeHint ?? '—').toString().toUpperCase()}</span>
          <span>·</span>
          <span>{map?.name ?? c.mapId}</span>
          <span>·</span>
          <span>{c.objectives.length} OBJ</span>
        </div>
      </div>
      <div
        style={{
          textAlign: 'right',
          fontFamily: NW.mono,
          fontSize: 10,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div style={{ color: NW.amber, fontWeight: 700 }}>¥{c.payout.cash.toLocaleString()}</div>
        <div style={{ color: NW.fg2 }}>
          {'●'.repeat(c.difficultyRating)}
          {'○'.repeat(5 - c.difficultyRating)}
        </div>
      </div>
    </button>
  );
}

function ContractMap({ contract }: { contract: Contract | null }): React.JSX.Element {
  return (
    <NWPanel
      title="MAP PREVIEW"
      padding={0}
      style={{ height: 200, flexShrink: 0, overflow: 'hidden' }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: NW.bg2,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {contract ? (
          <svg viewBox="0 0 200 100" style={{ width: '100%', height: '100%' }}>
            <defs>
              <pattern id="cm-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path
                  d="M 10 0 H 0 V 10"
                  stroke={NW.line}
                  strokeWidth="0.3"
                  fill="none"
                  opacity="0.6"
                />
              </pattern>
            </defs>
            <rect width="200" height="100" fill="url(#cm-grid)" />
            {/* Schematic: insertion ▸ objective ▸ extraction */}
            <line
              x1="20"
              y1="50"
              x2="180"
              y2="50"
              stroke={NW.cyan}
              strokeWidth="0.6"
              strokeDasharray="3 2"
              opacity="0.6"
            />
            <circle cx="20" cy="50" r="4" fill={NW.green} />
            <text x="20" y="68" fill={NW.green} fontSize="6" fontFamily={NW.mono} textAnchor="middle">
              INFIL
            </text>
            <circle cx="100" cy="50" r="6" fill={NW.amber} />
            <text x="100" y="68" fill={NW.amber} fontSize="6" fontFamily={NW.mono} textAnchor="middle">
              OBJ
            </text>
            <circle cx="180" cy="50" r="4" fill={NW.cyan} />
            <text x="180" y="68" fill={NW.cyan} fontSize="6" fontFamily={NW.mono} textAnchor="middle">
              EXFIL
            </text>
          </svg>
        ) : (
          <span style={{ fontFamily: NW.mono, fontSize: 11, color: NW.fg2 }}>
            select a contract
          </span>
        )}
      </div>
    </NWPanel>
  );
}

function ContractDetail({
  contract,
  bundle,
}: {
  contract: Contract | null;
  bundle: ReturnType<typeof getContent>;
}): React.JSX.Element {
  if (!contract) {
    return (
      <NWPanel title="DETAIL" accent="amber" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ fontFamily: NW.mono, fontSize: 11, color: NW.fg2 }}>
          pick a contract to see details
        </div>
      </NWPanel>
    );
  }
  const map = bundle.maps.get(contract.mapId);
  return (
    <NWPanel
      title={`DETAIL · ${contract.id.toUpperCase()}`}
      accent="amber"
      style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
    >
      <div
        style={{
          fontFamily: NW.display,
          fontSize: 18,
          fontWeight: 700,
          color: NW.fg0,
          letterSpacing: '0.04em',
        }}
      >
        {contract.name}
      </div>
      <div
        style={{
          fontFamily: NW.mono,
          fontSize: 11,
          color: NW.fg1,
          lineHeight: 1.5,
          marginTop: 8,
        }}
      >
        {interpolateBriefing(contract.briefing, null)}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginTop: 14,
          fontFamily: NW.mono,
          fontSize: 10,
        }}
      >
        <Stat label="MAP" value={map?.name ?? contract.mapId} />
        <Stat
          label="TEAM"
          value={`${contract.minOperators}–${contract.maxOperators ?? '∞'}`}
        />
        <Stat
          label="RECOMMENDED"
          value={`${contract.recommendedOperators.veteran}v ${contract.recommendedOperators.regular}r ${contract.recommendedOperators.green}g`}
        />
        <Stat label="DIFFICULTY" value={`${contract.difficultyRating}/5`} />
        <Stat label="BASE PAY" value={`¥${contract.payout.cash.toLocaleString()}`} tone="amber" />
        {contract.payout.secondaryBonusCash > 0 ? (
          <Stat
            label="BONUS"
            value={`¥${contract.payout.secondaryBonusCash.toLocaleString()}`}
            tone="green"
          />
        ) : null}
        <Stat label="DEPLOY COST" value={`¥${contract.deployCost.fixedPerContract.toLocaleString()}`} />
        <Stat
          label="REP DELTA"
          value={
            contract.payout.reputationDelta > 0
              ? `+${contract.payout.reputationDelta}`
              : `${contract.payout.reputationDelta}`
          }
        />
      </div>
      <div
        style={{
          marginTop: 14,
          fontFamily: NW.mono,
          fontSize: 9,
          color: NW.cyan,
          letterSpacing: '0.18em',
        }}
      >
        ◆ OPPOSITION
      </div>
      <div
        style={{
          fontFamily: NW.mono,
          fontSize: 11,
          color: NW.fg1,
          marginTop: 4,
        }}
      >
        {contract.enemies.archetypes.map((a) => `${a.count}× ${a.archetype}`).join(' · ')}
      </div>
      <div
        style={{
          marginTop: 14,
          fontFamily: NW.mono,
          fontSize: 9,
          color: NW.cyan,
          letterSpacing: '0.18em',
        }}
      >
        ◆ OBJECTIVES
      </div>
      <ul
        style={{
          margin: 0,
          padding: '4px 0 0 16px',
          fontFamily: NW.mono,
          fontSize: 11,
          color: NW.fg1,
          lineHeight: 1.6,
        }}
      >
        {contract.objectives.map((o) => (
          <li key={o.id}>
            <span style={{ color: NW.amber, letterSpacing: '0.1em' }}>{o.kind.toUpperCase()}</span>
            {' · '}
            {o.description}
          </li>
        ))}
      </ul>
    </NWPanel>
  );
}

function ContractActions({
  contract,
  onAccept,
  onDecline,
}: {
  contract: Contract | null;
  onAccept: () => void;
  onDecline: () => void;
}): React.JSX.Element {
  return (
    <NWPanel title="ACTIONS" style={{ flexShrink: 0 }}>
      {!contract ? (
        <div style={{ fontFamily: NW.mono, fontSize: 11, color: NW.fg2 }}>
          no contract selected
        </div>
      ) : (
        <>
          <NWBar
            value={Math.min(1, contract.payout.cash / 100000)}
            tone="amber"
            height={6}
          />
          <div
            style={{
              fontFamily: NW.mono,
              fontSize: 10,
              color: NW.fg2,
              marginTop: 6,
              letterSpacing: '0.14em',
            }}
          >
            PAYOUT INDEX · {Math.round(Math.min(1, contract.payout.cash / 100000) * 100)}%
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <NWCTA primary onClick={onAccept}>
              ACCEPT
            </NWCTA>
            <NWChip onClick={onDecline}>DECLINE</NWChip>
          </div>
        </>
      )}
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
  tone?: 'amber' | 'green';
}): React.JSX.Element {
  return (
    <div>
      <div style={{ color: NW.fg2, letterSpacing: '0.16em', fontSize: 9 }}>{label}</div>
      <div
        style={{
          color: tone === 'amber' ? NW.amber : tone === 'green' ? NW.green : NW.fg0,
          fontFamily: NW.display,
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}
