// S2/S8 unified combat view (#288 / ADR 016).
//
// Full-bleed PIXI map underneath, NEON WIRE chrome floating above:
//
//   ┌──────────────────────────────────────────────────────────────────┐
//   │ system bar                                                        │
//   ├──────────────────────────────────────────────────────────────────┤
//   │ S8 banner (battalion · mini-stats · ROE · WITHDRAW)               │
//   ├─────────────┬──────────────────────────────────────┬──────────────┤
//   │ S8 op cards │ kill feed (TL) · objectives (TC) · drone (TR)       │
//   │ + 24h tick  │                                                     │
//   │             │              [PIXI combat view]                     │
//   │ controls    │ roster strip (BC) ····················· OP card (BR)│
//   ├─────────────┴──────────────────────────────────────┴──────────────┤
//   │ S8 footer (commander · ROE chips · ISSUE BN ORDER)                │
//   └──────────────────────────────────────────────────────────────────┘
//
// The PIXI layer is the source of truth for the map (silhouettes, tracers,
// muzzle flashes, smoke, suppression auras, target locks, IN-CONTACT
// pulse) — see render/combat-view.tsx + render/fx-emitter.ts. This screen
// owns the chrome around it.
//
// Selection model: a single operatorId stored locally. Click a roster
// plaque (or the PIXI canvas, eventually) to populate the selected-op
// card on the bottom-right. Selection is decoupled from camera zoom.
// Camera lives inside CombatView and is preserved across selection
// changes.
//
// Replaces: legacy Deploy.tsx + CombatHud.tsx layout.

import { computeDeployCost, computePayoutBreakdown } from '@sim/contract-economics';
import type { SimSnapshot, SnapshotUnit, WorldSnapshot } from '@shared/snapshot';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getContent } from '../content';
import { useSimSnapshot } from '../hooks/use-sim';
import { appendEvents, formatEvent } from '../hud/event-feed';
import type { HudEventEntry, HudObjective } from '../hud/hud-types';
import { deriveUnitCard } from '../hud/unit-card';
import {
  HEX_CLIP_TL_BR,
  NW,
  NWBar,
  NWChip,
  NWPanel,
  NWStatusDot,
  NWSystemBar,
  type NWAccent,
} from '../neonwire';
import { CombatView } from '../render/combat-view';
import { getSimBridge } from '../sim-bridge';
import { useAppState } from '../stores/app-state';
import { useCompanies } from '../stores/companies';
import { type SimSpeed, useSettings } from '../stores/settings';
import { useSquads } from '../stores/squads';

const SPEEDS: readonly SimSpeed[] = [0.5, 1, 2, 4, 8];

type Roe = 'hold' | 'tight' | 'free';

export function Deploy(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  const contractId = useAppState((s) => s.selectedContractId);
  const deploySelection = useAppState((s) => s.deploySelection);
  const setDebrief = useAppState((s) => s.setDebrief);
  const battalion = useCompanies((s) => s.battalion);
  const simSpeed = useSettings((s) => s.simSpeed);
  const setSimSpeed = useSettings((s) => s.setSimSpeed);
  const paused = useSettings((s) => s.simPaused);
  const togglePause = useSettings((s) => s.togglePause);
  const setPaused = useSettings((s) => s.setPaused);
  const { snapshot, world, ended } = useSimSnapshot();
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [roe, setRoe] = useState<Roe>('tight');
  const [feedEntries, setFeedEntries] = useState<HudEventEntry[]>([]);
  const lastIngestedTick = useRef<number>(-1);

  useEffect(() => {
    getSimBridge().send({ type: 'setSpeed', multiplier: simSpeed });
  }, [simSpeed]);

  useEffect(() => {
    getSimBridge().send({ type: paused ? 'pause' : 'resume' });
  }, [paused]);

  useEffect(() => {
    return () => {
      setPaused(false);
    };
  }, [setPaused]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === ' ') {
        e.preventDefault();
        togglePause();
        return;
      }
      const idx = ['1', '2', '3', '4', '5'].indexOf(e.key);
      if (idx >= 0) setSimSpeed(SPEEDS[idx]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause, setSimSpeed]);

  // Mission-end → debrief transition. Identical to the legacy flow —
  // payout/cost rollup goes into AppState, then we route after a beat.
  useEffect(() => {
    if (!ended || !snapshot) return;
    const bundle = getContent();
    const contract = contractId ? bundle.contracts.get(contractId) : null;
    const playerUnits = snapshot.units.filter((u) => u.teamId === 0);
    const casualties = playerUnits
      .filter((u) => u.actionKind === 'dead')
      .map((u) => u.operatorId ?? `unit-${u.id}`);
    const survivors = playerUnits
      .filter((u) => u.actionKind !== 'dead')
      .map((u) => u.operatorId ?? `unit-${u.id}`);

    let gross = 0;
    let deployCostTotal = 0;
    if (contract) {
      const breakdown = computePayoutBreakdown(contract);
      gross =
        ended.winner === 0
          ? breakdown.cashFull + breakdown.secondaryBonusCash
          : breakdown.cashFloor;
      const deployedOps = deploySelection
        .map((id) => bundle.operators.get(id))
        .filter((o): o is NonNullable<typeof o> => !!o);
      deployCostTotal = computeDeployCost(contract, deployedOps).total;
    }

    setDebrief({
      winner: ended.winner,
      endReason: ended.endReason,
      casualties,
      survivors,
      payout: gross,
      deployCost: deployCostTotal,
      netCash: gross - deployCostTotal,
      stats: ended.stats,
    });
    setTimeout(() => go('debrief'), 800);
  }, [ended, snapshot, contractId, deploySelection, setDebrief, go]);

  const bundle = getContent();
  const ops = bundle.operators;

  const callsignByOpId = useMemo(() => {
    const map = new Map<string, string>();
    for (const op of ops.values()) map.set(op.id, op.callsign);
    return map;
  }, [ops]);

  const unitsById = useMemo(() => {
    const map = new Map<number, SnapshotUnit>();
    if (snapshot) for (const u of snapshot.units) map.set(u.id, u);
    return map;
  }, [snapshot]);

  // Ingest events into the kill-feed buffer — once per tick.
  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.tick === lastIngestedTick.current) return;
    lastIngestedTick.current = snapshot.tick;
    const formatted: HudEventEntry[] = [];
    for (const ev of snapshot.events) {
      const entry = formatEvent(ev, unitsById, ops);
      if (entry) formatted.push(entry);
    }
    if (formatted.length === 0) return;
    setFeedEntries((cur) => appendEvents(cur, formatted));
  }, [snapshot, unitsById, ops]);

  const selectedCard = useMemo(() => {
    if (selectedUnitId === null) return null;
    const u = unitsById.get(selectedUnitId);
    if (!u) return null;
    return deriveUnitCard(u, unitsById, ops);
  }, [selectedUnitId, unitsById, ops]);

  // Battalion-roll-up stats for the S8 banner.
  const friendlies = snapshot?.units.filter((u) => u.teamId === 0) ?? [];
  const hostiles = snapshot?.units.filter((u) => u.teamId === 1) ?? [];
  const team0Alive = friendlies.filter((u) => u.actionKind !== 'dead').length;
  const team1Alive = hostiles.filter((u) => u.actionKind !== 'dead').length;
  const team0Down = friendlies.filter((u) => u.actionKind === 'downed').length;
  const team0Dead = friendlies.filter((u) => u.actionKind === 'dead').length;
  const inContact = friendlies.some((u) => u.actionKind === 'firing' || u.alerted);

  const objectives = useObjectives(snapshot, contractId);

  // Auto-select the first friendly that's still up if nothing's selected.
  useEffect(() => {
    if (selectedUnitId !== null) {
      const u = unitsById.get(selectedUnitId);
      if (u && u.actionKind !== 'dead') return;
    }
    const first = friendlies.find((u) => u.actionKind !== 'dead');
    if (first) setSelectedUnitId(first.id);
  }, [selectedUnitId, friendlies, unitsById]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: NW.bg0,
        color: NW.fg0,
        fontFamily: NW.body,
        overflow: 'hidden',
      }}
    >
      {/* PIXI map fills the entire screen — chrome floats over it. */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {world ? (
          <CombatView
            world={world}
            snapshot={snapshot}
            selectedUnitId={selectedUnitId}
            callsigns={callsignByOpId}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              fontFamily: NW.mono,
              fontSize: 12,
              color: NW.fg2,
              letterSpacing: '0.18em',
            }}
          >
            ◆ STARTING SIM …
          </div>
        )}
      </div>

      {/* Foreground chrome — every panel below is pointer-events: auto on
          its own panel; the empty space between panels is pointer-events:
          none so PIXI gestures (drag-pan, wheel-zoom) keep working. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <NWSystemBar
            path={`COMBAT · ${battalion.designator}`}
            timestamp={`T+${formatTick(snapshot?.tick ?? 0)}`}
            right={<NWStatusDot tone={inContact ? 'magenta' : 'cyan'} pulse={inContact} />}
          />
        </div>

        <div style={{ pointerEvents: 'auto' }}>
          <S8Banner
            battalion={battalion}
            friendlyAlive={team0Alive}
            friendlyDown={team0Down}
            friendlyDead={team0Dead}
            hostileAlive={team1Alive}
            roe={roe}
            setRoe={setRoe}
            onWithdraw={() => {
              getSimBridge().send({ type: 'stopSim' });
              setPaused(false);
              go('menu');
            }}
            paused={paused}
            togglePause={togglePause}
            simSpeed={simSpeed}
            setSimSpeed={setSimSpeed}
          />
        </div>

        {/* Middle row: floating panels over PIXI. */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {/* Top-left: kill feed. */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              width: 320,
              maxHeight: 200,
              pointerEvents: 'auto',
            }}
          >
            <KillFeed entries={feedEntries} />
          </div>

          {/* Top-center: objectives bar. */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'auto',
              maxWidth: 520,
            }}
          >
            <ObjectivesBar objectives={objectives} />
          </div>

          {/* Top-right: drone overwatch (chrome stub per ADR 016). */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 240,
              pointerEvents: 'auto',
            }}
          >
            <DroneOverwatchPanel />
          </div>

          {/* Left rail: S8 op cards (one per company column with squads
              deployed). Falls back to a single roll-up card when there's
              only one team-0 group on the map. */}
          <div
            style={{
              position: 'absolute',
              top: 220,
              left: 12,
              width: 240,
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <S8OpCards
              friendlies={friendlies}
              ops={ops}
              selectedUnitId={selectedUnitId}
              onSelect={setSelectedUnitId}
            />
            <BCAttrTicker friendlyDead={team0Dead} hostileDead={hostiles.filter((u) => u.actionKind === 'dead').length} />
          </div>

          {/* Right rail: comms log + decision queue (S8 stubs). */}
          <div
            style={{
              position: 'absolute',
              top: 220,
              right: 12,
              width: 240,
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <CommsLogStub />
            <DecisionQueueStub />
          </div>

          {/* Bottom-center: squad roster strip. */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'auto',
            }}
          >
            <SquadRosterStrip
              friendlies={friendlies}
              ops={ops}
              selectedUnitId={selectedUnitId}
              onSelect={setSelectedUnitId}
            />
          </div>

          {/* Bottom-right: S2 selected-operator card. */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              width: 260,
              pointerEvents: 'auto',
            }}
          >
            <S2SelectedOperatorCard
              data={selectedCard}
              onClose={() => setSelectedUnitId(null)}
            />
          </div>
        </div>

        <div style={{ pointerEvents: 'auto' }}>
          <S8Footer
            commander={`CMDR · "${pickCommanderCallsign(friendlies, ops)}"`}
            roe={roe}
          />
        </div>
      </div>
    </div>
  );
}

// ── S8 banner ─────────────────────────────────────────────────────────────
function S8Banner({
  battalion,
  friendlyAlive,
  friendlyDown,
  friendlyDead,
  hostileAlive,
  roe,
  setRoe,
  onWithdraw,
  paused,
  togglePause,
  simSpeed,
  setSimSpeed,
}: {
  battalion: { designator: string; name: string };
  friendlyAlive: number;
  friendlyDown: number;
  friendlyDead: number;
  hostileAlive: number;
  roe: Roe;
  setRoe: (r: Roe) => void;
  onWithdraw: () => void;
  paused: boolean;
  togglePause: () => void;
  simSpeed: SimSpeed;
  setSimSpeed: (s: SimSpeed) => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        height: 64,
        background: NW.bg1,
        borderBottom: `1px solid ${NW.line}`,
        padding: '0 16px',
        display: 'grid',
        gridTemplateColumns: '320px 1fr auto',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: NW.mono,
            fontSize: 9,
            color: NW.cyan,
            letterSpacing: '0.2em',
          }}
        >
          ◆ COMBAT · BATTALION
        </div>
        <div
          style={{
            fontFamily: NW.display,
            fontSize: 18,
            fontWeight: 700,
            color: NW.fg0,
            letterSpacing: '0.06em',
          }}
        >
          {battalion.designator} · {battalion.name}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <BannerStat label="EFFECTIVES" value={String(friendlyAlive)} tone="cyan" />
        <BannerStat label="DOWNED" value={String(friendlyDown)} tone={friendlyDown > 0 ? 'amber' : 'fg'} />
        <BannerStat label="KIA" value={String(friendlyDead)} tone={friendlyDead > 0 ? 'magenta' : 'fg'} />
        <BannerStat label="HOSTILE" value={String(hostileAlive)} tone="red" />
        <BannerStat
          label="TEMPO"
          value={paused ? 'HOLD' : `${simSpeed}×`}
          tone={paused ? 'amber' : 'cyan'}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <NWChip small primary={paused} onClick={togglePause} kbd="␣" title="Pause / resume">
          {paused ? '▶' : '❙❙'}
        </NWChip>
        {SPEEDS.map((s, i) => (
          <NWChip
            key={s}
            small
            active={simSpeed === s}
            onClick={() => setSimSpeed(s)}
            title={`Speed ${s}× (${i + 1})`}
          >
            {s}×
          </NWChip>
        ))}
        <span style={{ width: 8 }} />
        <RoeChips roe={roe} setRoe={setRoe} />
        <span style={{ width: 8 }} />
        <NWChip small danger onClick={onWithdraw} title="Withdraw and abort the contract">
          WITHDRAW
        </NWChip>
      </div>
    </div>
  );
}

function BannerStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: NWAccent | 'fg';
}): React.JSX.Element {
  const c =
    tone === 'fg' ? NW.fg0 : tone === 'amber' ? NW.amber : tone === 'magenta' ? NW.magenta : tone === 'red' ? NW.red : NW.cyan;
  return (
    <div>
      <div
        style={{
          fontFamily: NW.mono,
          fontSize: 9,
          color: NW.fg2,
          letterSpacing: '0.18em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: NW.display,
          fontSize: 20,
          fontWeight: 700,
          color: c,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function RoeChips({ roe, setRoe }: { roe: Roe; setRoe: (r: Roe) => void }): React.JSX.Element {
  return (
    <>
      <span
        style={{
          fontFamily: NW.mono,
          fontSize: 9,
          color: NW.fg2,
          letterSpacing: '0.18em',
          marginRight: 4,
        }}
      >
        ROE
      </span>
      {(['hold', 'tight', 'free'] as const).map((r) => (
        <NWChip key={r} small active={roe === r} onClick={() => setRoe(r)} title={`ROE: ${r}`}>
          {r.toUpperCase()}
        </NWChip>
      ))}
    </>
  );
}

// ── S8 op cards (left rail) ───────────────────────────────────────────────
function S8OpCards({
  friendlies,
  ops,
  selectedUnitId,
  onSelect,
}: {
  friendlies: readonly SnapshotUnit[];
  ops: ReadonlyMap<string, ReturnType<typeof getContent>['operators'] extends ReadonlyMap<string, infer V> ? V : never>;
  selectedUnitId: number | null;
  onSelect: (id: number) => void;
}): React.JSX.Element {
  // Group friendlies by their persisted squad (looked up via operatorId
  // against the squads store). Units with no operator or no matching
  // squad fall through to a synthetic TEAM bucket.
  const squadOf = useSquads((s) => s.squadOf);
  const groups = useMemo(() => groupBySquad(friendlies, squadOf), [friendlies, squadOf]);
  return (
    <NWPanel title="OP CARDS" padding={0}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: 8,
          maxHeight: 260,
          overflow: 'auto',
        }}
      >
        {groups.map((g, i) => {
          const alive = g.units.filter((u) => u.actionKind !== 'dead');
          const dead = g.units.length - alive.length;
          const avgBlood = alive.length === 0
            ? 0
            : alive.reduce((s, u) => s + u.blood, 0) / alive.length / 100;
          const avgSupp = alive.length === 0
            ? 0
            : alive.reduce((s, u) => s + u.suppression, 0) / alive.length;
          const inContact = alive.some((u) => u.actionKind === 'firing' || u.alerted);
          const isSelected = g.units.some((u) => u.id === selectedUnitId);
          const tone: NWAccent = inContact ? 'magenta' : alive.length === 0 ? 'red' : 'cyan';
          return (
            <button
              key={g.label}
              type="button"
              onClick={() => {
                const first = alive[0] ?? g.units[0];
                if (first) onSelect(first.id);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '6px 8px',
                background: isSelected ? NW.cyanSoft : NW.bg2,
                boxShadow: `inset 0 0 0 1px ${isSelected ? NW.cyan : NW.line2}`,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                clipPath: HEX_CLIP_TL_BR,
                WebkitClipPath: HEX_CLIP_TL_BR,
              }}
              title={`${g.label} — click to select first effective`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <NWStatusDot tone={tone} pulse={inContact} size={6} />
                <span
                  style={{
                    fontFamily: NW.display,
                    fontSize: 12,
                    fontWeight: 700,
                    color: NW.fg0,
                    letterSpacing: '0.04em',
                  }}
                >
                  {g.label}
                </span>
                <span
                  style={{
                    flex: 1,
                    textAlign: 'right',
                    fontFamily: NW.mono,
                    fontSize: 10,
                    color: NW.fg2,
                  }}
                >
                  {alive.length}/{g.units.length}
                </span>
              </div>
              <NWBar value={avgBlood} tone={avgBlood < 0.4 ? 'magenta' : 'cyan'} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: NW.mono,
                  fontSize: 9,
                  color: NW.fg2,
                  letterSpacing: '0.08em',
                }}
              >
                <span>SUP {Math.round(avgSupp * 100)}%</span>
                <span>{inContact ? 'IN-CONTACT' : 'STANDBY'}</span>
                {dead > 0 && <span style={{ color: NW.magenta }}>−{dead}</span>}
              </div>
            </button>
          );
        })}
        {groups.length === 0 && (
          <div
            style={{
              fontFamily: NW.mono,
              fontSize: 10,
              color: NW.fg2,
              padding: 6,
              fontStyle: 'italic',
            }}
          >
            no squads deployed
          </div>
        )}
      </div>
    </NWPanel>
  );
}

function groupBySquad(
  units: readonly SnapshotUnit[],
  squadOf: (operatorId: string) => { id: string; name: string } | undefined,
): { label: string; units: SnapshotUnit[] }[] {
  const bySquad = new Map<string, { name: string; units: SnapshotUnit[] }>();
  const unassigned: SnapshotUnit[] = [];
  for (const u of units) {
    const sq = u.operatorId ? squadOf(u.operatorId) : undefined;
    if (!sq) {
      unassigned.push(u);
      continue;
    }
    const bucket = bySquad.get(sq.id) ?? { name: sq.name, units: [] };
    bucket.units.push(u);
    bySquad.set(sq.id, bucket);
  }
  const result: { label: string; units: SnapshotUnit[] }[] = [];
  for (const { name, units: arr } of bySquad.values()) {
    result.push({ label: name.toUpperCase(), units: arr });
  }
  if (unassigned.length > 0) {
    result.push({ label: 'TASK FORCE', units: unassigned });
  }
  return result;
}

// ── BCAttrTicker (24h attrition stub) ─────────────────────────────────────
function BCAttrTicker({
  friendlyDead,
  hostileDead,
}: {
  friendlyDead: number;
  hostileDead: number;
}): React.JSX.Element {
  return (
    <NWPanel title="ATTRITION · 24H" padding={10}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          fontFamily: NW.mono,
          fontSize: 10,
          color: NW.fg1,
        }}
      >
        <div>
          <div style={{ color: NW.fg2, letterSpacing: '0.16em' }}>OURS</div>
          <div
            style={{
              fontFamily: NW.display,
              fontSize: 18,
              fontWeight: 700,
              color: friendlyDead > 0 ? NW.magenta : NW.fg0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {friendlyDead}
          </div>
        </div>
        <div>
          <div style={{ color: NW.fg2, letterSpacing: '0.16em' }}>THEIRS</div>
          <div
            style={{
              fontFamily: NW.display,
              fontSize: 18,
              fontWeight: 700,
              color: NW.cyan,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {hostileDead}
          </div>
        </div>
      </div>
    </NWPanel>
  );
}

// ── Comms / decision panels (S8 stubs) ────────────────────────────────────
function CommsLogStub(): React.JSX.Element {
  // Stub per ADR 016 §S8. Live comms hook lands when the message bus
  // surfaces RTO-grade events.
  const lines = [
    { ts: 'T+02:14', src: 'OPS', tone: 'cyan' as NWAccent, txt: 'spin up; standby' },
    { ts: 'T+04:00', src: 'A·1', tone: 'amber' as NWAccent, txt: 'contact west; pinned' },
    { ts: 'T+04:33', src: 'CAS', tone: 'magenta' as NWAccent, txt: '1× WIA, evac' },
  ];
  return (
    <NWPanel title="COMMS · LOG" padding={0}>
      <div style={{ padding: 8, maxHeight: 160, overflow: 'auto' }}>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: NW.mono,
              fontSize: 10,
              color: NW.fg1,
              padding: '3px 0',
              borderBottom: i < lines.length - 1 ? `1px solid ${NW.line}` : 'none',
              display: 'flex',
              gap: 6,
            }}
          >
            <span style={{ color: NW.fg2 }}>{l.ts}</span>
            <span style={{ color: l.tone === 'amber' ? NW.amber : l.tone === 'magenta' ? NW.magenta : NW.cyan }}>
              {l.src}
            </span>
            <span style={{ flex: 1 }}>{l.txt}</span>
          </div>
        ))}
      </div>
    </NWPanel>
  );
}

function DecisionQueueStub(): React.JSX.Element {
  // Stub per ADR 016 §S8. Real queue plugs in once BT events surface
  // commander-actionable decisions.
  return (
    <NWPanel title="DECISIONS" padding={10}>
      <div
        style={{
          fontFamily: NW.mono,
          fontSize: 10,
          color: NW.fg2,
          letterSpacing: '0.08em',
          fontStyle: 'italic',
        }}
      >
        — queue empty —
      </div>
    </NWPanel>
  );
}

// ── Drone overwatch panel (chrome stub) ───────────────────────────────────
function DroneOverwatchPanel(): React.JSX.Element {
  return (
    <NWPanel title="DRONE · OVERWATCH" accent="amber" padding={10}>
      <div
        style={{
          fontFamily: NW.mono,
          fontSize: 10,
          color: NW.fg2,
          letterSpacing: '0.1em',
        }}
      >
        <div>FEED · OFFLINE</div>
        <div style={{ marginTop: 4 }}>UAV · NONE TASKED</div>
      </div>
    </NWPanel>
  );
}

// ── Objectives bar (top-center) ───────────────────────────────────────────
function ObjectivesBar({
  objectives,
}: {
  objectives: readonly HudObjective[];
}): React.JSX.Element | null {
  if (objectives.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        background: 'rgba(10,15,30,0.85)',
        backdropFilter: 'blur(6px)',
        padding: '6px 14px',
        clipPath: HEX_CLIP_TL_BR,
        WebkitClipPath: HEX_CLIP_TL_BR,
        boxShadow: `inset 0 0 0 1px ${NW.line2}`,
      }}
    >
      {objectives.map((o, i) => {
        const c =
          o.status === 'complete' ? NW.green : o.status === 'failed' ? NW.magenta : NW.cyan;
        return (
          <div
            key={`${o.kind}:${o.description}:${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: NW.mono,
              fontSize: 10,
              color: NW.fg1,
              letterSpacing: '0.1em',
            }}
          >
            <span style={{ color: c, fontWeight: 700 }}>◆ {o.kind.toUpperCase()}</span>
            <span>{o.description}</span>
            <span style={{ color: c }}>· {o.status.toUpperCase()}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Kill feed (top-left) ──────────────────────────────────────────────────
function KillFeed({ entries }: { entries: readonly HudEventEntry[] }): React.JSX.Element {
  const reversed = [...entries].slice(-12).reverse();
  return (
    <div
      style={{
        background: 'rgba(10,15,30,0.78)',
        backdropFilter: 'blur(4px)',
        padding: 8,
        clipPath: HEX_CLIP_TL_BR,
        WebkitClipPath: HEX_CLIP_TL_BR,
        boxShadow: `inset 0 0 0 1px ${NW.line2}`,
        maxHeight: 200,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontFamily: NW.mono,
          fontSize: 9,
          color: NW.cyan,
          letterSpacing: '0.18em',
          marginBottom: 4,
        }}
      >
        ◆ KILL · FEED
      </div>
      {reversed.length === 0 ? (
        <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, fontStyle: 'italic' }}>
          — quiet —
        </div>
      ) : (
        reversed.map((e) => (
          <div
            key={e.id}
            style={{
              fontFamily: NW.mono,
              fontSize: 10,
              color: feedColor(e.severity),
              padding: '1px 0',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <span style={{ color: NW.fg2 }}>t{e.tick}</span> {e.text}
          </div>
        ))
      )}
    </div>
  );
}

function feedColor(severity: HudEventEntry['severity']): string {
  switch (severity) {
    case 'kill':
      return NW.magenta;
    case 'down':
      return NW.amber;
    case 'wound':
      return NW.fg1;
    case 'stabilize':
      return NW.green;
    case 'morale':
      return NW.cyan;
    case 'misc':
    default:
      return NW.fg2;
  }
}

// ── Squad roster strip (bottom-center) ────────────────────────────────────
function SquadRosterStrip({
  friendlies,
  ops,
  selectedUnitId,
  onSelect,
}: {
  friendlies: readonly SnapshotUnit[];
  ops: ReadonlyMap<string, ReturnType<typeof getContent>['operators'] extends ReadonlyMap<string, infer V> ? V : never>;
  selectedUnitId: number | null;
  onSelect: (id: number) => void;
}): React.JSX.Element {
  const slots = friendlies.slice(0, 8);
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        background: 'rgba(10,15,30,0.85)',
        backdropFilter: 'blur(6px)',
        padding: 6,
        clipPath: HEX_CLIP_TL_BR,
        WebkitClipPath: HEX_CLIP_TL_BR,
        boxShadow: `inset 0 0 0 1px ${NW.line2}`,
      }}
    >
      {slots.length === 0 ? (
        <div
          style={{
            fontFamily: NW.mono,
            fontSize: 10,
            color: NW.fg2,
            padding: '6px 14px',
            fontStyle: 'italic',
          }}
        >
          — no roster —
        </div>
      ) : (
        slots.map((u) => {
          const op = u.operatorId ? ops.get(u.operatorId) : null;
          const callsign = op?.callsign ?? `unit-${u.id}`;
          const dead = u.actionKind === 'dead';
          const downed = u.actionKind === 'downed';
          const selected = u.id === selectedUnitId;
          const tone: NWAccent = dead ? 'red' : downed ? 'magenta' : selected ? 'cyan' : 'cyan';
          const c = tone === 'red' ? NW.red : tone === 'magenta' ? NW.magenta : NW.cyan;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect(u.id)}
              title={`${callsign} · ${u.actionKind}`}
              style={{
                width: 88,
                background: selected ? NW.cyanSoft : NW.bg2,
                boxShadow: `inset 0 0 0 1px ${selected ? NW.cyan : NW.line2}`,
                border: 'none',
                cursor: 'pointer',
                padding: '4px 6px',
                clipPath: HEX_CLIP_TL_BR,
                WebkitClipPath: HEX_CLIP_TL_BR,
                textAlign: 'left',
                opacity: dead ? 0.4 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <NWStatusDot tone={tone} pulse={!dead && !downed && u.actionKind === 'firing'} size={5} />
                <span
                  style={{
                    fontFamily: NW.display,
                    fontSize: 10,
                    fontWeight: 700,
                    color: NW.fg0,
                    letterSpacing: '0.04em',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {callsign}
                </span>
              </div>
              <NWBar value={Math.max(0, Math.min(1, u.blood / 100))} tone={u.blood < 40 ? 'magenta' : 'cyan'} />
              <div
                style={{
                  fontFamily: NW.mono,
                  fontSize: 8,
                  color: c,
                  letterSpacing: '0.1em',
                }}
              >
                {dead ? 'KIA' : downed ? 'DOWN' : u.actionKind.slice(0, 8).toUpperCase()}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

// ── S2 selected-operator card (bottom-right) ──────────────────────────────
function S2SelectedOperatorCard({
  data,
  onClose,
}: {
  data: ReturnType<typeof deriveUnitCard> | null;
  onClose: () => void;
}): React.JSX.Element {
  if (!data) {
    return (
      <NWPanel title="OPERATOR" padding={12}>
        <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, fontStyle: 'italic' }}>
          select an operator
        </div>
      </NWPanel>
    );
  }
  // Per-zone wound flags for the 14-zone paperdoll (#288.21). The
  // armory uses 7 macro zones; the combat card subdivides arms/legs
  // and adds neck so a battlefield medic can read injury location at
  // a glance. Values come from the unit's wounds list (we map the
  // schema's 7 zones onto the 14 by splitting limb wounds across
  // upper/lower segments).
  const woundedZones = combatPaperdollWounds(data);
  const status = data.dead
    ? 'KIA'
    : data.downed
      ? 'DOWNED'
      : `${data.actionKind} · ${data.stance}${data.alerted ? ' · ALERT' : ''}`;
  return (
    <NWPanel
      title={`OPERATOR · "${data.callsign}"`}
      padding={0}
      right={
        <NWChip small onClick={onClose} title="Clear selection">
          ×
        </NWChip>
      }
    >
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <CombatPaperdoll14 woundedZones={woundedZones} dead={data.dead} downed={data.downed} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div
              style={{
                fontFamily: NW.mono,
                fontSize: 10,
                color: data.dead || data.downed ? NW.magenta : data.aiState === 'panic' ? NW.amber : NW.fg2,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {status}
            </div>
            {data.name && (
              <div
                style={{
                  fontFamily: NW.body,
                  fontSize: 11,
                  color: NW.fg1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {data.name}
              </div>
            )}
            <div
              style={{
                fontFamily: NW.mono,
                fontSize: 9,
                color: NW.fg2,
                letterSpacing: '0.14em',
              }}
            >
              WND · {data.woundCount}
              {data.worstWoundSeverity ? ` (${data.worstWoundSeverity[0]?.toUpperCase()})` : ''}
            </div>
          </div>
        </div>
        <BarRow label="HP" value={data.bloodPct} tone={data.bloodPct > 0.5 ? 'cyan' : data.bloodPct > 0.25 ? 'amber' : 'magenta'} />
        <BarRow label="MORALE" value={data.moralePct} tone={data.moralePct > 0.5 ? 'cyan' : data.moralePct > 0.25 ? 'amber' : 'magenta'} />
        <BarRow label="SUPP" value={data.suppressionPct} tone={data.suppressionPct > 0.6 ? 'magenta' : data.suppressionPct > 0.3 ? 'amber' : 'cyan'} />
        <BarRow label="STAM" value={1} tone="cyan" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
            fontFamily: NW.mono,
            fontSize: 10,
            color: NW.fg1,
            marginTop: 4,
          }}
        >
          <KvRow k="WEAP" v={`${data.ammo} rds`} />
          <KvRow k="STANCE" v={data.stance.toUpperCase()} />
          <KvRow k="WND" v={data.woundCount === 0 ? '—' : `${data.woundCount}${data.worstWoundSeverity ? ` (${data.worstWoundSeverity[0]?.toUpperCase()})` : ''}`} />
          <KvRow k="TGT" v={data.target ? `"${data.target.callsign}"` : '—'} />
        </div>
      </div>
    </NWPanel>
  );
}

// Combat 14-zone paperdoll (#288.21). Compact silhouette beside the
// HP/MORALE/SUPP bars showing wound location at a glance. 14 zones =
// head, neck, l/r shoulder, chest, abdomen, l/r upper arm, l/r
// forearm, waist, l/r thigh, l/r calf. The schema only carries 7
// macro zones (head, torso_front/back, arms, waist, legs); the limb
// zones get duplicated across upper/lower segments so the silhouette
// reads consistently.
type Combat14Zone =
  | 'head'
  | 'neck'
  | 'l_shoulder'
  | 'r_shoulder'
  | 'chest'
  | 'abdomen'
  | 'l_upper_arm'
  | 'r_upper_arm'
  | 'l_forearm'
  | 'r_forearm'
  | 'waist'
  | 'l_thigh'
  | 'r_thigh'
  | 'l_calf'
  | 'r_calf';

function combatPaperdollWounds(
  data: ReturnType<typeof deriveUnitCard>,
): Set<Combat14Zone> {
  // The unit-card data we have here doesn't include zone-resolved
  // wounds — the snapshot does. The combat-screen card derives wound
  // count + worst severity but loses zone info, so this helper takes
  // the conservative approach: map "any wound" to the torso (chest)
  // until the card derivation is extended. Severity > light upgrades
  // to abdomen as well so multi-wound units read worse.
  const zones = new Set<Combat14Zone>();
  if (data.woundCount > 0) zones.add('chest');
  if (data.woundCount > 1) zones.add('abdomen');
  if (data.woundCount > 2) zones.add('l_upper_arm');
  if (data.woundCount > 3) zones.add('r_upper_arm');
  if (data.woundCount > 4) zones.add('l_thigh');
  if (data.worstWoundSeverity === 'critical') zones.add('head');
  return zones;
}

function CombatPaperdoll14({
  woundedZones,
  dead,
  downed,
}: {
  woundedZones: Set<Combat14Zone>;
  dead: boolean;
  downed: boolean;
}): React.JSX.Element {
  const zoneFill = (z: Combat14Zone): string => {
    if (dead) return 'rgba(80,80,80,0.5)';
    if (woundedZones.has(z)) return 'rgba(255,45,154,0.55)';
    return downed ? 'rgba(255,160,32,0.25)' : 'rgba(24,224,255,0.18)';
  };
  const zoneStroke = (z: Combat14Zone): string => {
    if (dead) return '#444';
    if (woundedZones.has(z)) return NW.magenta;
    return NW.cyan;
  };
  return (
    <svg viewBox="0 0 60 110" width={64} height={118} aria-hidden>
      {/* head */}
      <circle cx="30" cy="8" r="6" fill={zoneFill('head')} stroke={zoneStroke('head')} strokeWidth="0.6" />
      {/* neck */}
      <rect x="27" y="14" width="6" height="4" fill={zoneFill('neck')} stroke={zoneStroke('neck')} strokeWidth="0.5" />
      {/* shoulders */}
      <ellipse cx="20" cy="22" rx="6" ry="3" fill={zoneFill('l_shoulder')} stroke={zoneStroke('l_shoulder')} strokeWidth="0.5" />
      <ellipse cx="40" cy="22" rx="6" ry="3" fill={zoneFill('r_shoulder')} stroke={zoneStroke('r_shoulder')} strokeWidth="0.5" />
      {/* chest */}
      <path d="M 20 24 L 40 24 L 39 40 L 21 40 Z" fill={zoneFill('chest')} stroke={zoneStroke('chest')} strokeWidth="0.6" />
      {/* abdomen */}
      <path d="M 21 40 L 39 40 L 38 52 L 22 52 Z" fill={zoneFill('abdomen')} stroke={zoneStroke('abdomen')} strokeWidth="0.6" />
      {/* upper arms */}
      <rect x="11" y="24" width="6" height="14" rx="2" fill={zoneFill('l_upper_arm')} stroke={zoneStroke('l_upper_arm')} strokeWidth="0.5" />
      <rect x="43" y="24" width="6" height="14" rx="2" fill={zoneFill('r_upper_arm')} stroke={zoneStroke('r_upper_arm')} strokeWidth="0.5" />
      {/* forearms */}
      <rect x="11" y="38" width="6" height="14" rx="2" fill={zoneFill('l_forearm')} stroke={zoneStroke('l_forearm')} strokeWidth="0.5" />
      <rect x="43" y="38" width="6" height="14" rx="2" fill={zoneFill('r_forearm')} stroke={zoneStroke('r_forearm')} strokeWidth="0.5" />
      {/* waist */}
      <rect x="22" y="52" width="16" height="6" fill={zoneFill('waist')} stroke={zoneStroke('waist')} strokeWidth="0.5" />
      {/* thighs */}
      <rect x="22" y="58" width="7" height="20" rx="2" fill={zoneFill('l_thigh')} stroke={zoneStroke('l_thigh')} strokeWidth="0.5" />
      <rect x="31" y="58" width="7" height="20" rx="2" fill={zoneFill('r_thigh')} stroke={zoneStroke('r_thigh')} strokeWidth="0.5" />
      {/* calves */}
      <rect x="22" y="78" width="7" height="22" rx="2" fill={zoneFill('l_calf')} stroke={zoneStroke('l_calf')} strokeWidth="0.5" />
      <rect x="31" y="78" width="7" height="22" rx="2" fill={zoneFill('r_calf')} stroke={zoneStroke('r_calf')} strokeWidth="0.5" />
    </svg>
  );
}

function BarRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: NWAccent;
}): React.JSX.Element {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: NW.mono,
          fontSize: 9,
          color: NW.fg2,
          letterSpacing: '0.16em',
          marginBottom: 2,
        }}
      >
        <span>{label}</span>
        <span style={{ color: NW.fg1, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <NWBar value={value} tone={tone} />
    </div>
  );
}

function KvRow({ k, v }: { k: string; v: string }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
      <span style={{ color: NW.fg2, letterSpacing: '0.14em' }}>{k}</span>
      <span style={{ color: NW.fg0 }}>{v}</span>
    </div>
  );
}

// ── S8 footer ─────────────────────────────────────────────────────────────
function S8Footer({ commander, roe }: { commander: string; roe: Roe }): React.JSX.Element {
  return (
    <div
      style={{
        height: 36,
        background: NW.bg1,
        borderTop: `1px solid ${NW.line}`,
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontFamily: NW.mono,
        fontSize: 10,
        color: NW.fg2,
        letterSpacing: '0.14em',
      }}
    >
      <span style={{ color: NW.fg1 }}>{commander}</span>
      <span style={{ color: NW.fgDim }}>║</span>
      <span>
        ROE · <span style={{ color: NW.cyan }}>{roe.toUpperCase()}</span>
      </span>
      <span style={{ flex: 1 }} />
      <NWChip small primary title="Issue a battalion-wide order (stub)">
        ISSUE BN ORDER
      </NWChip>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────
function pickCommanderCallsign(
  friendlies: readonly SnapshotUnit[],
  ops: ReadonlyMap<string, ReturnType<typeof getContent>['operators'] extends ReadonlyMap<string, infer V> ? V : never>,
): string {
  const alive = friendlies.find((u) => u.actionKind !== 'dead' && u.operatorId);
  if (!alive || !alive.operatorId) return 'ACTUAL';
  const op = ops.get(alive.operatorId);
  return op?.callsign ?? 'ACTUAL';
}

function formatTick(tick: number): string {
  // 30Hz sim → seconds; render as MM:SS for the timestamp slot.
  const seconds = Math.floor(tick / 30);
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function useObjectives(
  snapshot: SimSnapshot | null,
  contractId: string | null,
): readonly HudObjective[] {
  return useMemo<readonly HudObjective[]>(() => {
    if (snapshot?.objectives && snapshot.objectives.length > 0) {
      return snapshot.objectives.map((o) => ({
        kind: o.kind,
        description: o.description,
        status: o.status,
      }));
    }
    if (!contractId) return [];
    const bundle = getContent();
    const contract = bundle.contracts.get(contractId);
    if (!contract) return [];
    return contract.objectives.map((o) => ({
      kind: o.kind,
      description: o.description,
      status: 'active' as const,
    }));
  }, [snapshot, contractId]);
}

// SnapshotUnit is referenced at runtime via the helpers above;
// re-export just for type-safety in case a parent screen wants it.
export type { WorldSnapshot };
