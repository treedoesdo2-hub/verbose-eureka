// S5 Briefing — NEON WIRE pre-mission planning (#291 / ADR 016).
//
// Three-column layout:
//
//   ┌────────────┬───────────────────────────────┬────────────┐
//   │            │                               │            │
//   │ HEADER     │  MAP / LANDMARK PREVIEW       │ SQUAD      │
//   │ OBJECTIVES │                               │ ASSIGN     │
//   │ COMMS      ├───────────────────────────────┤            │
//   │            │  PHASE TIMELINE               │ ECONOMICS  │
//   │            │                               │ DEPLOY     │
//   └────────────┴───────────────────────────────┴────────────┘
//
// Replaces the legacy form-style "Deployment Order" surface but keeps
// all the underlying behaviour: map preview generation via runPipeline-
// WithRetry, deploy-cost / payout rollup, slot-based squad assignment,
// hotkeys (Esc → board, A → armory, D → deploy), and the prebuiltMap
// pipeline that hands the preview's MapGenResult straight to the worker
// so the player runs the map they were just shown.

import type { Operator } from '@schema/operator';
import type { MapGenResultTransfer, ScenarioRequest, WireLoadout } from '@shared/messages';
import { computeNetEconomics } from '@sim/contract-economics';
import { interpolateBriefing, mapGenRequestFromContract } from '@sim/mapgen/contract-binder';
import type { HeroLandmark } from '@sim/mapgen/hero-landmark';
import { runPipelineWithRetry } from '@sim/mapgen/pipeline';
import type { MapGenResult } from '@sim/mapgen/types';
import { renderThumbnail } from '@sim/mapgen/thumbnail';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getContent } from '../content';
import { useHotkeys } from '../hooks/useHotkeys';
import {
  HEX_CLIP_TL_BR,
  NW,
  NWBar,
  NWChip,
  NWCTA,
  NWPanel,
  NWStatusDot,
  NWSystemBar,
  type NWAccent,
} from '../neonwire';
import { getSimBridge } from '../sim-bridge';
import { useAppState } from '../stores/app-state';
import { useSquads } from '../stores/squads';

const EMPTY_SLOT = '';

type Slot = { id: string; key: number };
let nextSlotKey = 1;
function makeSlot(): Slot {
  return { id: EMPTY_SLOT, key: nextSlotKey++ };
}

export function Briefing(): React.JSX.Element {
  const go = useAppState((s) => s.go);
  const contractId = useAppState((s) => s.selectedContractId);
  const setDeploySelection = useAppState((s) => s.setDeploySelection);
  const bundle = getContent();
  const contract = contractId ? bundle.contracts.get(contractId) : null;
  const squadMap = useSquads((s) => s.squads);
  const order = useSquads((s) => s.order);
  const squads = useMemo(
    () => order.map((id) => squadMap.get(id)).filter((x): x is NonNullable<typeof x> => !!x),
    [squadMap, order],
  );

  // Re-roll the preview seed every time the contract switches so the map
  // shown matches the map that will be sent to the worker on launch.
  const previewSeed = useMemo(() => Date.now() & 0xffff, []);
  const preview = useMapPreview(contract?.id ?? null, previewSeed);

  const initialSlotCount = contract
    ? Math.min(6, contract.modifiers.extractionSeats ?? 6, contract.maxOperators ?? 6)
    : 6;
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: Math.max(1, initialSlotCount) }, () => makeSlot()),
  );
  const [loadoutLocked, setLoadoutLocked] = useState(false);

  function assign(slotKey: number, squadId: string): void {
    if (loadoutLocked) return;
    setSlots((prev) =>
      prev.map((s) => {
        if (s.key === slotKey) return { ...s, id: squadId };
        if (s.id === squadId) return { ...s, id: EMPTY_SLOT };
        return s;
      }),
    );
  }

  function addSlot(): void {
    if (loadoutLocked) return;
    setSlots((prev) => [...prev, makeSlot()]);
  }

  function removeSlot(slotKey: number): void {
    if (loadoutLocked) return;
    setSlots((prev) => prev.filter((s) => s.key !== slotKey));
  }

  const assignedSquads = useMemo(
    () => slots.map((s) => squadMap.get(s.id)).filter((s): s is NonNullable<typeof s> => !!s),
    [slots, squadMap],
  );

  const deployedOperatorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const sq of assignedSquads) {
      for (const m of sq.members) ids.add(m.operatorId);
    }
    return ids;
  }, [assignedSquads]);

  const deployedOperators = useMemo<Operator[]>(() => {
    const ops: Operator[] = [];
    for (const id of deployedOperatorIds) {
      const op = bundle.operators.get(id);
      if (op) ops.push(op);
    }
    return ops;
  }, [deployedOperatorIds, bundle]);

  useEffect(() => {
    setDeploySelection([...deployedOperatorIds]);
  }, [deployedOperatorIds, setDeploySelection]);

  const economics = useMemo(
    () => (contract ? computeNetEconomics(contract, deployedOperators) : null),
    [contract, deployedOperators],
  );

  const opCount = deployedOperatorIds.size;
  const extractionCap = contract?.modifiers.extractionSeats ?? null;
  const effectiveMax = (() => {
    if (!contract) return 0;
    const caps: number[] = [];
    if (contract.maxOperators !== null) caps.push(contract.maxOperators);
    if (extractionCap !== null) caps.push(extractionCap);
    return caps.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...caps);
  })();
  const canAddSlot = contract ? slots.length < effectiveMax : false;
  const roleTagsSatisfied = (() => {
    if (!contract) return false;
    const req = contract.modifiers.requiredRoleTags;
    if (req.length === 0) return true;
    for (const tag of req) {
      const hit = deployedOperators.some((op) => op.defaultTemplateId.startsWith(`${tag}-`));
      if (!hit) return false;
    }
    return true;
  })();
  const canLaunch =
    !!contract && opCount >= contract.minOperators && opCount <= effectiveMax && roleTagsSatisfied;

  const launch = useCallback((): void => {
    if (!contract) return;
    const perOperatorLoadouts: ScenarioRequest['perOperatorLoadouts'] = {};
    const operatorSquadIds: Record<string, string> = {};
    const deployedIds: string[] = [];
    for (const sq of assignedSquads) {
      for (const m of sq.members) {
        deployedIds.push(m.operatorId);
        const wire: WireLoadout = {
          items: [...m.loadout.items],
          templateId: m.templateId,
        };
        perOperatorLoadouts[m.operatorId] = wire;
        operatorSquadIds[m.operatorId] = sq.id;
      }
    }

    const bridge = getSimBridge();
    // The previewSeed gates both the sim RNG and the mapgen runSeed
    // (via mapGenRequestFromContract) so the played map exactly matches
    // the previewed one. prebuiltMap fast-paths around the worker
    // re-running the pipeline.
    const seed = previewSeed;
    const prebuiltMap = preview ? buildPrebuiltMap(preview) : undefined;
    bridge.send({
      type: 'startSim',
      payload: {
        seed,
        contractId: contract.id,
        simSpeedMultiplier: 4,
        scenarioRequest: {
          seed,
          contractId: contract.id,
          mapId: contract.mapId,
          deployedOperatorIds: deployedIds,
          perOperatorLoadouts,
          operatorSquadIds,
          prebuiltMap,
        },
      },
    });
    go('deploy');
  }, [contract, assignedSquads, go, previewSeed, preview]);

  const hotkeys = useMemo(
    () => [
      { key: 'Escape', handler: () => go('board') },
      { key: 'a', handler: () => go('armory') },
      {
        key: 'd',
        handler: () => {
          if (canLaunch) launch();
        },
      },
    ],
    [canLaunch, go, launch],
  );
  useHotkeys(hotkeys);

  if (!contract) {
    return (
      <div
        style={{
          height: '100%',
          background: NW.bg0,
          color: NW.fg0,
          fontFamily: NW.body,
          padding: 32,
        }}
      >
        <NWChip onClick={() => go('board')}>← BOARD</NWChip>
        <p style={{ marginTop: 16, fontFamily: NW.mono, color: NW.fg2 }}>
          NO CONTRACT SELECTED.
        </p>
      </div>
    );
  }

  const underCap = opCount < contract.minOperators;
  const overCap = effectiveMax !== Number.POSITIVE_INFINITY && opCount > effectiveMax;
  const readiness: 'ready' | 'short' | 'over' | 'role' = underCap
    ? 'short'
    : overCap
      ? 'over'
      : !roleTagsSatisfied
        ? 'role'
        : 'ready';

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
      <NWSystemBar
        path={`BRIEFING · OP-${contract.id.toUpperCase()}`}
        right={<NWStatusDot tone={readiness === 'ready' ? 'green' : 'amber'} pulse={readiness === 'ready'} />}
        timestamp={`SEED ${previewSeed.toString(16).toUpperCase().padStart(4, '0')}`}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '400px 1fr 420px',
          gap: 12,
          padding: 12,
        }}
      >
        {/* Left rail */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <BriefHeader
            contract={contract}
            landmark={preview?.landmark ?? null}
            onBack={() => go('board')}
          />
          <BriefObjectives contract={contract} />
          <BriefComms />
        </div>

        {/* Center rail */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <BriefMap contract={contract} preview={preview} bundle={bundle} />
          <BriefTimeline contract={contract} />
        </div>

        {/* Right rail */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <BriefSquad
            slots={slots}
            squadMap={squadMap}
            squads={squads}
            assign={assign}
            removeSlot={removeSlot}
            addSlot={addSlot}
            canAddSlot={canAddSlot}
            bundle={bundle}
            deployedOperatorIds={deployedOperatorIds}
            locked={loadoutLocked}
            onArmory={() => go('armory')}
          />
          {economics ? <BriefEconomics economics={economics} /> : null}
          <BriefDeploy
            opCount={opCount}
            min={contract.minOperators}
            max={effectiveMax}
            readiness={readiness}
            requiredRoleTags={contract.modifiers.requiredRoleTags}
            canLaunch={canLaunch}
            launch={launch}
            locked={loadoutLocked}
            setLocked={setLoadoutLocked}
          />
        </div>
      </div>
    </div>
  );
}

// ── Left rail panels ──────────────────────────────────────────────────────
function BriefHeader({
  contract,
  landmark,
  onBack,
}: {
  contract: NonNullable<ReturnType<typeof getContent>['contracts'] extends ReadonlyMap<string, infer V> ? V : never>;
  landmark: HeroLandmark | null;
  onBack: () => void;
}): React.JSX.Element {
  return (
    <NWPanel
      title="BRIEFING · HEADER"
      right={
        <NWChip small onClick={onBack} kbd="Esc" title="Back to board">
          ← BOARD
        </NWChip>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <KvBlock k="OP CODE" v={`OP-${contract.id.toUpperCase()}`} mono />
        <KvBlock k="TARGET" v={contract.name} display />
        {landmark && (
          <KvBlock
            k="LANDMARK"
            v={`${landmark.name} · ${landmark.kind.replace(/_/g, ' ')}`}
            mono
            tone="amber"
          />
        )}
        <div>
          <Label>INTENT</Label>
          <div
            style={{
              fontFamily: NW.body,
              fontSize: 12,
              color: NW.fg1,
              lineHeight: 1.6,
              marginTop: 4,
            }}
          >
            {interpolateBriefing(contract.briefing, landmark)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <KvBlock
            k="DIFFICULTY"
            v={
              '●'.repeat(contract.difficultyRating) +
              '○'.repeat(5 - contract.difficultyRating)
            }
            mono
          />
          <KvBlock
            k="TEAM SIZE"
            v={`${contract.minOperators}–${contract.maxOperators ?? '∞'}`}
            mono
          />
        </div>
      </div>
    </NWPanel>
  );
}

function BriefObjectives({
  contract,
}: {
  contract: NonNullable<ReturnType<typeof getContent>['contracts'] extends ReadonlyMap<string, infer V> ? V : never>;
}): React.JSX.Element {
  return (
    <NWPanel title="OBJECTIVES" padding={0}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: NW.mono,
          fontSize: 11,
          color: NW.fg1,
        }}
      >
        <tbody>
          {contract.objectives.map((o, i) => (
            <tr
              key={`${o.kind}:${o.description}`}
              style={{
                borderBottom: i < contract.objectives.length - 1 ? `1px solid ${NW.line}` : 'none',
              }}
            >
              <td
                style={{
                  padding: '8px 12px',
                  width: 56,
                  color: NW.cyan,
                  letterSpacing: '0.16em',
                  verticalAlign: 'top',
                }}
              >
                {o.kind.toUpperCase()}
              </td>
              <td style={{ padding: '8px 12px 8px 0', verticalAlign: 'top' }}>
                {o.description}
              </td>
            </tr>
          ))}
          {contract.objectives.length === 0 && (
            <tr>
              <td style={{ padding: 12, color: NW.fg2, fontStyle: 'italic' }}>
                no objectives authored
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </NWPanel>
  );
}

function BriefComms(): React.JSX.Element {
  // Static channel chrome for MVP. The real comms tree (CMD / CAS /
  // INT / OPS) wires up when the message bus surfaces frequency data.
  const channels: { ch: string; label: string; tone: NWAccent; dot: 'live' | 'idle' }[] = [
    { ch: 'CMD-1', label: 'Battalion command', tone: 'cyan', dot: 'live' },
    { ch: 'CAS-2', label: 'Casualty / medevac', tone: 'magenta', dot: 'idle' },
    { ch: 'INT-3', label: 'Intel & overwatch', tone: 'amber', dot: 'idle' },
    { ch: 'OPS-4', label: 'Operations net', tone: 'green', dot: 'live' },
  ];
  return (
    <NWPanel title="COMMS · CHANNELS" padding={0}>
      <div style={{ padding: 8 }}>
        {channels.map((c, i) => (
          <div
            key={c.ch}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 4px',
              borderBottom: i < channels.length - 1 ? `1px solid ${NW.line}` : 'none',
            }}
          >
            <NWStatusDot tone={c.tone} pulse={c.dot === 'live'} size={6} />
            <span
              style={{
                fontFamily: NW.mono,
                fontSize: 10,
                color: NW.fg0,
                letterSpacing: '0.14em',
                width: 56,
              }}
            >
              {c.ch}
            </span>
            <span style={{ fontFamily: NW.body, fontSize: 11, color: NW.fg1 }}>{c.label}</span>
          </div>
        ))}
      </div>
    </NWPanel>
  );
}

// ── Center rail panels ────────────────────────────────────────────────────
function BriefMap({
  contract,
  preview,
  bundle,
}: {
  contract: NonNullable<ReturnType<typeof getContent>['contracts'] extends ReadonlyMap<string, infer V> ? V : never>;
  preview: MapPreview | null;
  bundle: ReturnType<typeof getContent>;
}): React.JSX.Element {
  const procedural = contract.modifiers.biomeHint !== null;
  const mapName = procedural
    ? `${contract.modifiers.biomeHint?.toUpperCase()} · ${contract.modifiers.sizeHint}`
    : (bundle.maps.get(contract.mapId)?.name ?? contract.mapId).toUpperCase();
  return (
    <NWPanel title={`MAP · ${mapName}`}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {procedural ? (
          <MapThumbnailCanvas
            pixels={preview?.pixels ?? null}
            sourceSize={preview?.width ?? 256}
            displaySize={384}
          />
        ) : (
          <div
            style={{
              fontFamily: NW.mono,
              fontSize: 11,
              color: NW.fg2,
              padding: 32,
              fontStyle: 'italic',
              border: `1px dashed ${NW.line}`,
              width: 384,
              textAlign: 'center',
            }}
          >
            authored map · preview unavailable
          </div>
        )}

        {/* INSERTION / ROUTE / LZ legend chips. */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            fontFamily: NW.mono,
            fontSize: 9,
            letterSpacing: '0.14em',
            color: NW.fg2,
          }}
        >
          <LegendChip color={NW.green} label="INSERT" />
          <LegendChip color={NW.cyan} label="ROUTE" />
          <LegendChip color={NW.amber} label="LZ" />
          <LegendChip color={NW.magenta} label="PATROL" />
        </div>
      </div>
    </NWPanel>
  );
}

function LegendChip({ color, label }: { color: string; label: string }): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span
        style={{
          width: 10,
          height: 10,
          background: color,
          boxShadow: `0 0 6px ${color}80`,
          clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
        }}
      />
      {label}
    </span>
  );
}

function BriefTimeline({
  contract,
}: {
  contract: NonNullable<ReturnType<typeof getContent>['contracts'] extends ReadonlyMap<string, infer V> ? V : never>;
}): React.JSX.Element {
  // Static phase timeline. Phase durations are illustrative until the
  // sim emits real phase markers (post-MVP).
  const phases = [
    { kind: 'INFIL', label: 'Insertion · approach', tone: 'green' as NWAccent, t: 'T-00:00 → T-04:00' },
    { kind: 'CONTACT', label: 'Engagement window', tone: 'magenta' as NWAccent, t: 'T-04:00 → T-12:00' },
    { kind: 'EXFIL', label: 'Withdrawal · LZ', tone: 'amber' as NWAccent, t: 'T-12:00 → end' },
  ];
  return (
    <NWPanel title="PHASE TIMELINE">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {phases.map((p, i) => (
          <div
            key={p.kind}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr auto',
              gap: 10,
              alignItems: 'center',
              padding: '6px 8px',
              background: NW.bg2,
              clipPath: HEX_CLIP_TL_BR,
              WebkitClipPath: HEX_CLIP_TL_BR,
              boxShadow: `inset 0 0 0 1px ${NW.line2}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <NWStatusDot tone={p.tone} pulse={i === 0} />
              <span
                style={{
                  fontFamily: NW.display,
                  fontSize: 13,
                  fontWeight: 700,
                  color:
                    p.tone === 'green'
                      ? NW.green
                      : p.tone === 'magenta'
                        ? NW.magenta
                        : NW.amber,
                  letterSpacing: '0.06em',
                }}
              >
                {p.kind}
              </span>
            </div>
            <span style={{ fontFamily: NW.body, fontSize: 11, color: NW.fg1 }}>{p.label}</span>
            <span
              style={{
                fontFamily: NW.mono,
                fontSize: 10,
                color: NW.fg2,
                letterSpacing: '0.1em',
              }}
            >
              {p.t}
            </span>
          </div>
        ))}
        <div
          style={{
            marginTop: 4,
            fontFamily: NW.mono,
            fontSize: 9,
            color: NW.fg2,
            letterSpacing: '0.16em',
          }}
        >
          ◆ DIFFICULTY · {'●'.repeat(contract.difficultyRating)}
          {'○'.repeat(5 - contract.difficultyRating)}
        </div>
      </div>
    </NWPanel>
  );
}

// ── Right rail panels ─────────────────────────────────────────────────────
function BriefSquad({
  slots,
  squadMap,
  squads,
  assign,
  removeSlot,
  addSlot,
  canAddSlot,
  bundle,
  deployedOperatorIds,
  locked,
  onArmory,
}: {
  slots: Slot[];
  squadMap: Map<string, ReturnType<typeof useSquads.getState>['squads'] extends Map<string, infer V> ? V : never>;
  squads: Array<ReturnType<typeof useSquads.getState>['squads'] extends Map<string, infer V> ? V : never>;
  assign: (slotKey: number, squadId: string) => void;
  removeSlot: (slotKey: number) => void;
  addSlot: () => void;
  canAddSlot: boolean;
  bundle: ReturnType<typeof getContent>;
  deployedOperatorIds: ReadonlySet<string>;
  locked: boolean;
  onArmory: () => void;
}): React.JSX.Element {
  return (
    <NWPanel
      title="SQUAD ASSIGN"
      right={
        <NWChip small onClick={onArmory} kbd="A" title="Edit loadouts in armory">
          ARMORY
        </NWChip>
      }
    >
      {squads.length === 0 ? (
        <div style={{ fontFamily: NW.mono, fontSize: 11, color: NW.fg2, lineHeight: 1.6 }}>
          NO SQUADS AUTHORED.
          <div style={{ marginTop: 8 }}>
            <NWChip small primary onClick={onArmory}>
              → AUTHOR IN ARMORY
            </NWChip>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {slots.map((slot, idx) => {
              const sq = slot.id ? squadMap.get(slot.id) : null;
              return (
                <div
                  key={slot.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr auto',
                    gap: 6,
                    alignItems: 'center',
                    padding: '4px 6px',
                    background: NW.bg2,
                    boxShadow: `inset 0 0 0 1px ${NW.line2}`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: NW.mono,
                      fontSize: 9,
                      color: NW.fg2,
                      letterSpacing: '0.1em',
                    }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <select
                    value={slot.id}
                    onChange={(e) => assign(slot.key, e.target.value)}
                    disabled={locked}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      background: NW.bg1,
                      color: NW.fg0,
                      border: `1px solid ${NW.line}`,
                      fontFamily: NW.mono,
                      fontSize: 10,
                      letterSpacing: '0.04em',
                    }}
                  >
                    <option value={EMPTY_SLOT}>— empty —</option>
                    {squads.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.members.length} op{s.members.length === 1 ? '' : 's'})
                      </option>
                    ))}
                  </select>
                  {slots.length > 1 && !locked ? (
                    <NWChip
                      small
                      onClick={() => removeSlot(slot.key)}
                      title="Remove element slot"
                    >
                      −
                    </NWChip>
                  ) : (
                    <span />
                  )}
                  {sq && sq.members.length > 0 && (
                    <div
                      style={{
                        gridColumn: '2 / 4',
                        fontFamily: NW.mono,
                        fontSize: 9,
                        color: NW.fg2,
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {sq.members
                        .map(
                          (m) =>
                            `"${bundle.operators.get(m.operatorId)?.callsign ?? m.operatorId}"`,
                        )
                        .join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            <NWChip
              small
              onClick={addSlot}
              title={canAddSlot ? 'Add element slot' : 'At seat capacity'}
            >
              + SLOT
            </NWChip>
            <span
              style={{
                fontFamily: NW.mono,
                fontSize: 9,
                color: NW.fg2,
                letterSpacing: '0.14em',
                alignSelf: 'center',
              }}
            >
              · {deployedOperatorIds.size} OPERATORS DEPLOYED
            </span>
          </div>
        </>
      )}
    </NWPanel>
  );
}

function BriefEconomics({
  economics,
}: {
  economics: NonNullable<ReturnType<typeof computeNetEconomics>>;
}): React.JSX.Element {
  return (
    <NWPanel title="ECONOMIC TRADEOFF" padding={0}>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <EconStat label="PAYOUT" value={`¥${economics.payout.cashFull.toLocaleString()}`} tone="cyan" />
          <EconStat
            label="DEPLOY COST"
            value={`¥${economics.deployCost.total.toLocaleString()}`}
            tone="magenta"
          />
          <EconStat
            label="NET · WIN"
            value={`${economics.netIfPrimarySuccess >= 0 ? '+' : ''}¥${economics.netIfPrimarySuccess.toLocaleString()}`}
            tone={economics.netIfPrimarySuccess >= 0 ? 'green' : 'magenta'}
          />
          <EconStat
            label="NET · FAIL"
            value={`${economics.netIfPrimaryFailGoodFaith >= 0 ? '+' : ''}¥${economics.netIfPrimaryFailGoodFaith.toLocaleString()}`}
            tone={economics.netIfPrimaryFailGoodFaith >= 0 ? 'green' : 'magenta'}
          />
        </div>
        {economics.payout.secondaryBonusCash > 0 && (
          <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.1em' }}>
            ◆ SECONDARY · +¥{economics.payout.secondaryBonusCash.toLocaleString()}
          </div>
        )}
        {economics.payout.reputationDelta !== 0 && (
          <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2, letterSpacing: '0.1em' }}>
            ◆ REP · {economics.payout.reputationDelta > 0 ? '+' : ''}
            {economics.payout.reputationDelta}
          </div>
        )}
      </div>
    </NWPanel>
  );
}

function EconStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: NWAccent;
}): React.JSX.Element {
  const c =
    tone === 'cyan'
      ? NW.cyan
      : tone === 'green'
        ? NW.green
        : tone === 'amber'
          ? NW.amber
          : NW.magenta;
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
          fontSize: 18,
          fontWeight: 700,
          color: c,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function BriefDeploy({
  opCount,
  min,
  max,
  readiness,
  requiredRoleTags,
  canLaunch,
  launch,
  locked,
  setLocked,
}: {
  opCount: number;
  min: number;
  max: number;
  readiness: 'ready' | 'short' | 'over' | 'role';
  requiredRoleTags: readonly string[];
  canLaunch: boolean;
  launch: () => void;
  locked: boolean;
  setLocked: (b: boolean) => void;
}): React.JSX.Element {
  const fill = max === Number.POSITIVE_INFINITY ? Math.min(1, opCount / Math.max(1, min)) : opCount / max;
  return (
    <NWPanel title="DEPLOY · CONTROL" padding={0} accent={readiness === 'ready' ? 'cyan' : 'amber'}>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <Label>STRENGTH</Label>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              marginTop: 2,
              fontFamily: NW.display,
              fontSize: 24,
              fontWeight: 700,
              color: NW.fg0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {opCount}
            <span style={{ fontSize: 12, color: NW.fg2 }}>
              / {max === Number.POSITIVE_INFINITY ? '∞' : max} (min {min})
            </span>
          </div>
          <div style={{ marginTop: 6 }}>
            <NWBar
              value={Math.min(1, fill)}
              tone={readiness === 'ready' ? 'cyan' : readiness === 'role' ? 'amber' : 'magenta'}
            />
          </div>
        </div>

        <div
          style={{
            fontFamily: NW.mono,
            fontSize: 10,
            color:
              readiness === 'ready'
                ? NW.green
                : readiness === 'short' || readiness === 'over'
                  ? NW.magenta
                  : NW.amber,
            letterSpacing: '0.16em',
          }}
        >
          {readiness === 'ready' && '◆ READY · LAUNCH AUTHORIZED'}
          {readiness === 'short' && `◆ SHORT · need ${min - opCount} more`}
          {readiness === 'over' && `◆ OVER · cap by ${opCount - max}`}
          {readiness === 'role' &&
            `◆ MISSING ROLE · ${requiredRoleTags.join(', ')}`}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <NWChip small active={locked} onClick={() => setLocked(!locked)} title="Lock loadout edits">
            {locked ? 'LOCKED' : 'LOCK LOADOUT'}
          </NWChip>
          <span style={{ flex: 1 }} />
          <NWChip small danger onClick={() => window.history.back()} title="Abort briefing">
            ABORT
          </NWChip>
        </div>

        <NWCTA
          primary
          onClick={() => {
            if (canLaunch) launch();
          }}
          title={canLaunch ? 'Deploy (D)' : 'Deployment requires correct strength + roles'}
          right={
            <span
              style={{
                fontFamily: NW.mono,
                fontSize: 9,
                color: NW.fg2,
                border: `1px solid ${NW.line2}`,
                padding: '0 6px',
                letterSpacing: '0.16em',
              }}
            >
              D
            </span>
          }
          style={{ opacity: canLaunch ? 1 : 0.5, pointerEvents: canLaunch ? 'auto' : 'none' }}
        >
          ▶ DEPLOY
        </NWCTA>
      </div>
    </NWPanel>
  );
}

// ── shared bits ───────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        fontFamily: NW.mono,
        fontSize: 9,
        letterSpacing: '0.18em',
        color: NW.fg2,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

function KvBlock({
  k,
  v,
  mono,
  display,
  tone,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
  display?: boolean;
  tone?: NWAccent;
}): React.JSX.Element {
  const c =
    tone === 'amber'
      ? NW.amber
      : tone === 'cyan'
        ? NW.cyan
        : tone === 'green'
          ? NW.green
          : tone === 'magenta'
            ? NW.magenta
            : NW.fg0;
  return (
    <div>
      <Label>{k}</Label>
      <div
        style={{
          fontFamily: display ? NW.display : mono ? NW.mono : NW.body,
          fontSize: display ? 18 : mono ? 12 : 12,
          color: c,
          letterSpacing: display ? '0.04em' : mono ? '0.08em' : 'normal',
          marginTop: 2,
          fontWeight: display ? 700 : 400,
        }}
      >
        {v}
      </div>
    </div>
  );
}

// ── map preview (unchanged from legacy briefing) ──────────────────────────
type MapPreview = {
  readonly landmark: HeroLandmark | null;
  readonly pixels: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly result: MapGenResult;
  readonly request: {
    readonly seed: string;
    readonly biome: string;
    readonly size: number;
    readonly tileSizeMeters: number;
    readonly generationVersion: number;
  };
};

function useMapPreview(contractId: string | null, runSeed: number): MapPreview | null {
  const [preview, setPreview] = useState<MapPreview | null>(null);
  const bundle = getContent();
  useEffect(() => {
    if (!contractId) {
      setPreview(null);
      return;
    }
    const contract = bundle.contracts.get(contractId);
    if (!contract || contract.modifiers.biomeHint === null) {
      setPreview(null);
      return;
    }
    const req = mapGenRequestFromContract(contract, 1.5, 1, runSeed);
    const result = runPipelineWithRetry(req);
    const thumb = renderThumbnail(result, 256, { tier: 'briefing' });
    setPreview({
      landmark: result.heroLandmark,
      pixels: thumb.pixels,
      width: thumb.width,
      height: thumb.height,
      result,
      request: {
        seed: req.seed,
        biome: req.biome,
        size: req.size,
        tileSizeMeters: req.tileSizeMeters,
        generationVersion: req.generationVersion,
      },
    });
  }, [contractId, bundle, runSeed]);
  return preview;
}

function buildPrebuiltMap(preview: MapPreview): MapGenResultTransfer {
  const r = preview.result;
  return {
    seed: preview.request.seed,
    biome: preview.request.biome,
    size: preview.request.size,
    tileSizeMeters: preview.request.tileSizeMeters,
    generationVersion: preview.request.generationVersion,
    width: r.width,
    height: r.height,
    base: new Uint8Array(r.base),
    point: new Uint8Array(r.point),
    edgeN: new Uint8Array(r.edgeN),
    edgeW: new Uint8Array(r.edgeW),
    edgeOverrideN: new Uint8Array(r.edgeOverrideN),
    edgeOverrideW: new Uint8Array(r.edgeOverrideW),
    buildingId: new Uint16Array(r.buildingId),
    walkability: new Uint16Array(r.walkability),
    coverProfile: new Uint8Array(r.coverProfile),
    elevationStep: new Uint8Array(r.elevationStep),
    structureHeight: new Uint8Array(r.structureHeight),
    hpN: new Uint16Array(r.hpN),
    hpW: new Uint16Array(r.hpW),
    hpPoint: new Uint16Array(r.hpPoint),
    buildings: r.buildings.map((b) => ({
      id: b.id,
      family: b.family,
      floors: b.floors,
      footprintTiles: b.footprintTiles.map((t) => ({ x: t.x, y: t.y })),
      wallHpInitial: b.wallHpInitial,
    })),
    shadingBake: new Uint8ClampedArray(r.shadingBake),
    contours: new Uint8Array(r.contours),
    deployZones: {
      team0: { ...r.deployZones.team0 },
      team1: { ...r.deployZones.team1 },
    },
    unitSlots: {
      team0: r.unitSlots.team0.map((s) => ({ x: s.x, y: s.y, facing: s.facing })),
      team1: r.unitSlots.team1.map((s) => ({ x: s.x, y: s.y, facing: s.facing })),
    },
    objectiveAnchors: r.objectiveAnchors.map((a) => ({
      kindHint: a.kindHint,
      rect: { ...a.rect },
      qualityScore: a.qualityScore,
    })),
  };
}

function MapThumbnailCanvas({
  pixels,
  sourceSize = 256,
  displaySize = 384,
}: {
  pixels: Uint8ClampedArray | null;
  sourceSize?: number;
  displaySize?: number;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!pixels) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.createImageData(sourceSize, sourceSize);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
  }, [pixels, sourceSize]);

  return (
    <canvas
      ref={canvasRef}
      width={sourceSize}
      height={sourceSize}
      style={{
        imageRendering: 'pixelated',
        width: displaySize,
        height: displaySize,
        border: `1px solid ${NW.line2}`,
        background: NW.bg0,
      }}
    />
  );
}
