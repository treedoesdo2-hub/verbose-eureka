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

  // Every briefing mount (or contract switch) rolls a fresh playthrough
  // seed. The preview thumbnail and the actual Deploy launch share this
  // seed so what the player sees is what they get — otherwise the map
  // rolled at briefing-preview time and the map rolled at sim-start time
  // were decoupled and could differ.
  const previewSeed = useMemo(() => Date.now() & 0xffff, [contract?.id]);
  const preview = useMapPreview(contract?.id ?? null, previewSeed);

  const initialSlotCount = contract
    ? Math.min(4, contract.modifiers.extractionSeats ?? 4, contract.maxOperators ?? 4)
    : 4;
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: Math.max(1, initialSlotCount) }, () => makeSlot()),
  );

  function assign(slotKey: number, squadId: string): void {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.key === slotKey) return { ...s, id: squadId };
        if (s.id === squadId) return { ...s, id: EMPTY_SLOT };
        return s;
      }),
    );
  }

  function addSlot(): void {
    setSlots((prev) => [...prev, makeSlot()]);
  }

  function removeSlot(slotKey: number): void {
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
    // Use the previewSeed so the launched match plays the map the player
    // just inspected in the preview. startSim's seed is both the sim RNG
    // seed AND the map-gen runSeed via mapGenRequestFromContract.
    const seed = previewSeed;
    // P1.9 — hand the already-generated map over to the worker so it
    // doesn't re-run runPipeline and diverge. Fallback to legacy path for
    // authored-map contracts (biomeHint === null) where preview is null.
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
      <div className="screen">
        <button type="button" className="btn btn-small" onClick={() => go('board')}>
          ← board
        </button>
        <p>No contract selected.</p>
      </div>
    );
  }

  const underCap = opCount < contract.minOperators;
  const overCap = effectiveMax !== Number.POSITIVE_INFINITY && opCount > effectiveMax;

  return (
    <div className="screen deployment-order">
      <div className="screen-header">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => go('board')}
          title="Back to board (Esc)"
        >
          ← board
        </button>
        <h2>Deployment Order · {contract.name}</h2>
      </div>

      <section className="order-doc">
        <header className="order-doc-header">
          <span className="order-doc-seal mono">OP-{contract.id.toUpperCase()}</span>
          <span className="order-doc-title">Commander's Deployment Order</span>
        </header>

        <dl className="order-fields">
          <dt>contract</dt>
          <dd>{contract.name}</dd>
          <dt>briefing</dt>
          <dd className="briefing-narrative">
            {interpolateBriefing(contract.briefing, preview?.landmark ?? null)}
          </dd>
          <dt>map</dt>
          <dd className="mono">
            {contract.modifiers.biomeHint !== null
              ? `procedural · ${contract.modifiers.biomeHint} · ${contract.modifiers.sizeHint}`
              : (bundle.maps.get(contract.mapId)?.name ?? contract.mapId)}
          </dd>
          {contract.modifiers.biomeHint !== null ? (
            <>
              <dt>preview</dt>
              <dd>
                <MapThumbnailCanvas
                  pixels={preview?.pixels ?? null}
                  sourceSize={256}
                  displaySize={384}
                />
              </dd>
            </>
          ) : null}
          {preview?.landmark ? (
            <>
              <dt>landmark</dt>
              <dd className="mono accent">
                <span className="landmark-chip">
                  {preview.landmark.name}
                  <span className="dim"> · {preview.landmark.kind.replace(/_/g, ' ')}</span>
                </span>
              </dd>
            </>
          ) : null}
          <dt>team size</dt>
          <dd className="mono">
            {contract.minOperators}–{contract.maxOperators ?? '∞'} operators
            {extractionCap !== null ? ` · ${extractionCap} extraction seats` : ''}
          </dd>
          <dt>recommended</dt>
          <dd className="mono dim">
            {contract.recommendedOperators.veteran} veteran ·{' '}
            {contract.recommendedOperators.regular} regular · {contract.recommendedOperators.green}{' '}
            green
          </dd>
          <dt>difficulty</dt>
          <dd className="mono">
            {'●'.repeat(contract.difficultyRating)}
            {'○'.repeat(5 - contract.difficultyRating)}
          </dd>
          <dt>objectives</dt>
          <dd>
            <ol className="order-objectives">
              {contract.objectives.map((o) => (
                <li key={o.description}>
                  <span className="mono dim">{o.kind}</span> {o.description}
                </li>
              ))}
            </ol>
          </dd>
          {contract.modifiers.requiredRoleTags.length > 0 ? (
            <>
              <dt>required roles</dt>
              <dd className="mono">{contract.modifiers.requiredRoleTags.join(', ')}</dd>
            </>
          ) : null}
        </dl>
      </section>

      {economics ? (
        <section className="economic-readout">
          <h3>Economic tradeoff</h3>
          <div className="econ-grid">
            <div className="econ-col">
              <h4>Payout</h4>
              <dl className="econ-dl">
                <dt>cash on success</dt>
                <dd className="mono accent">{economics.payout.cashFull.toLocaleString()} cr</dd>
                {economics.payout.secondaryBonusCash > 0 ? (
                  <>
                    <dt>secondary bonus</dt>
                    <dd className="mono">
                      +{economics.payout.secondaryBonusCash.toLocaleString()} cr
                    </dd>
                  </>
                ) : null}
                {economics.payout.cashFloor > 0 ? (
                  <>
                    <dt>partial failure</dt>
                    <dd className="mono dim">
                      {economics.payout.cashFloor.toLocaleString()} cr (good faith)
                    </dd>
                  </>
                ) : null}
                {economics.payout.salvagePriorityPicks > 0 ? (
                  <>
                    <dt>salvage picks</dt>
                    <dd className="mono">{economics.payout.salvagePriorityPicks}</dd>
                  </>
                ) : null}
                {economics.payout.reputationDelta !== 0 ? (
                  <>
                    <dt>reputation</dt>
                    <dd className="mono">
                      {economics.payout.reputationDelta > 0 ? '+' : ''}
                      {economics.payout.reputationDelta}
                    </dd>
                  </>
                ) : null}
              </dl>
            </div>
            <div className="econ-col">
              <h4>Deploy cost</h4>
              <dl className="econ-dl">
                <dt>fixed</dt>
                <dd className="mono">{economics.deployCost.fixed.toLocaleString()} cr</dd>
                <dt>wages</dt>
                <dd className="mono">
                  {economics.deployCost.perOperatorWages.toLocaleString()} cr
                </dd>
                <dt>premiums</dt>
                <dd className="mono">
                  {economics.deployCost.perOperatorPremiums.toLocaleString()} cr
                </dd>
                <dt>total</dt>
                <dd className="mono danger">{economics.deployCost.total.toLocaleString()} cr</dd>
              </dl>
            </div>
            <div className="econ-col">
              <h4>Net</h4>
              <dl className="econ-dl">
                <dt>if primary success</dt>
                <dd className={`mono ${economics.netIfPrimarySuccess < 0 ? 'danger' : 'ok'}`}>
                  {economics.netIfPrimarySuccess >= 0 ? '+' : ''}
                  {economics.netIfPrimarySuccess.toLocaleString()} cr
                </dd>
                <dt>if primary fails</dt>
                <dd className={`mono ${economics.netIfPrimaryFailGoodFaith < 0 ? 'danger' : 'ok'}`}>
                  {economics.netIfPrimaryFailGoodFaith >= 0 ? '+' : ''}
                  {economics.netIfPrimaryFailGoodFaith.toLocaleString()} cr
                </dd>
              </dl>
            </div>
          </div>
        </section>
      ) : null}

      <section className="order-elements">
        <h3>Element assignment</h3>
        {squads.length === 0 ? (
          <div className="briefing-no-squads">
            <p>No squads exist yet. Head to the Armory to form a squad before deploying.</p>
            <button type="button" className="btn" onClick={() => go('armory')}>
              → Armory
            </button>
          </div>
        ) : (
          <>
            <table className="order-slot-table">
              <tbody>
                {slots.map((slot, idx) => {
                  const sq = slot.id ? squadMap.get(slot.id) : null;
                  return (
                    <tr key={slot.key}>
                      <th scope="row">
                        <span className="mono dim">{String(idx + 1).padStart(2, '0')}</span>
                        <span className="order-slot-role">Element</span>
                      </th>
                      <td>
                        <select
                          className="order-slot-select"
                          value={slot.id}
                          onChange={(e) => assign(slot.key, e.target.value)}
                        >
                          <option value={EMPTY_SLOT}>— no element assigned —</option>
                          {squads.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.members.length} op
                              {s.members.length === 1 ? '' : 's'})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="mono dim order-slot-roster">
                        {sq
                          ? sq.members.length === 0
                            ? '— empty —'
                            : sq.members
                                .map(
                                  (m) =>
                                    `"${bundle.operators.get(m.operatorId)?.callsign ?? m.operatorId}"`,
                                )
                                .join(' · ')
                          : ''}
                      </td>
                      <td>
                        {slots.length > 1 ? (
                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={() => removeSlot(slot.key)}
                            title="Remove slot"
                          >
                            −
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              type="button"
              className="btn btn-small"
              onClick={addSlot}
              disabled={!canAddSlot}
              title={canAddSlot ? 'Add an element slot' : `Already at max (${effectiveMax} seats)`}
            >
              + Add element slot
            </button>
          </>
        )}
      </section>

      <section className="order-footer">
        <div className="order-totals">
          <span className="mono dim">total strength</span>{' '}
          <span className="mono accent">{opCount}</span>{' '}
          <span className="mono dim">
            op{opCount === 1 ? '' : 's'} across {assignedSquads.length} element
            {assignedSquads.length === 1 ? '' : 's'}
          </span>{' '}
          {underCap ? (
            <span className="danger">need {contract.minOperators - opCount} more</span>
          ) : overCap ? (
            <span className="danger">over cap by {opCount - effectiveMax}</span>
          ) : !roleTagsSatisfied ? (
            <span className="danger">
              required role missing: {contract.modifiers.requiredRoleTags.join(', ')}
            </span>
          ) : (
            <span className="ok">ready</span>
          )}
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={() => go('armory')}
            title="Edit Armory (A)"
          >
            Edit Armory <span className="hotkey-hint mono">A</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canLaunch}
            onClick={launch}
            title={canLaunch ? 'Deploy (D)' : 'Deployment requires the correct team size + roles'}
          >
            Deploy <span className="hotkey-hint mono">D</span>
          </button>
        </div>
      </section>
    </div>
  );
}

type MapPreview = {
  readonly landmark: HeroLandmark | null;
  readonly pixels: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  // P1.8 — the full MapGenResult and its originating request are cached
  // alongside the preview so Deploy can send the exact same map buffer
  // to the worker instead of re-running runPipeline. Kept with the
  // preview so the cache lifetime matches the UI lifetime (single
  // contract-board → briefing → deploy traversal).
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
    // Run the pipeline at the *full* contract size so the thumbnail is
    // a faithful downsample of the actual map the scenario will load —
    // not a small map at the same seed, which the pipeline's RNG-per-
    // tile loops would make visually unrelated.
    const req = mapGenRequestFromContract(contract, 1.5, 1, runSeed);
    const result = runPipelineWithRetry(req);
    // P7.4 — render at 256 source resolution; display scales to 384 in
    // MapThumbnailCanvas. Larger source → more legible landmarks.
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

// Extract the worker-transferable subset from a briefing-side MapGenResult.
// Clones typed-array views so the worker owns the payload after postMessage
// without disturbing the renderer cache.
function buildPrebuiltMap(
  preview: MapPreview,
): MapGenResultTransfer {
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
      team0: { ...r.deployZones.team0, x: r.deployZones.team0.x, y: r.deployZones.team0.y, w: r.deployZones.team0.w, h: r.deployZones.team0.h },
      team1: { ...r.deployZones.team1, x: r.deployZones.team1.x, y: r.deployZones.team1.y, w: r.deployZones.team1.w, h: r.deployZones.team1.h },
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
  sourceSize = 96,
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
      className="map-thumbnail"
      width={sourceSize}
      height={sourceSize}
      // P7.4 — display at 384×384 (was 192×192). Landmark visibility
      // was the driver per @desktop's audit: Firefight uses ~190×190
      // at 1920×1080 (≈10% of screen height); we scale 2× for legibility.
      style={{ imageRendering: 'pixelated', width: displaySize, height: displaySize }}
    />
  );
}
