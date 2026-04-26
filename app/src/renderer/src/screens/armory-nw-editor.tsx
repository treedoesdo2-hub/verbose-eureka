// NEON WIRE armory editor — implementation of ADR 016 §S3.
// Source: SS for design/.../source/s3-armory.jsx + clarify-Q14 deferrals.
//
// Layout:
//   ┌────────────────── top bar (88px) ──────────────────┐
//   │ operator card · combat-load meter · stats+deltas   │
//   ├─ stockpile (320) ─┬─ paperdoll (1fr) ─┬─ inspector ┤
//   │                   │                   │            │
//   ├──────────────── bottom bar (70px) ─────────────────┤
//   └─ delta stats · RESET · COPY · SAVE · CONFIRM ──────┘
//
// Per Q14e: paperdoll has FRONT and REAR toggles only — no SIDE view.
// Per Q14a: medical history is UI-only stub; ArmorPlacement
// resistance fields exist in schema but FIRE/EMP stay inert in sim.

import { type BodyZone, ZONE_CAPACITY_KG } from '@schema/common';
import type { Operator } from '@schema/operator';
import type { SquadMember } from '@schema/squad';
import type { LoadoutItem } from '@sim/loadout';
import {
  deriveCombatProfile,
  INFANTRY_WEIGHT_KG_BUDGET,
  validateLoadout,
} from '@sim/loadout';
import { computeFit, defaultBodyProfile, type FitError } from '@sim/loadoutFit';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { contentLookup, getContent } from '../content';
import {
  HEX_CLIP_TL_BR,
  NW,
  NWBar,
  NWChip,
  NWPanel,
  type NWAccent,
} from '../neonwire';
import type { ContentBundle } from '../loader';
import { useSquads } from '../stores/squads';

type StockpileCat = 'weapon' | 'armor' | 'utility' | 'ammo';

// Paperdoll zones drawn on the silhouette. ADR 016 §S3 originally
// listed 7, but #280.21 wires drag-drop through `canPlaceItem` which
// gates primary/sidearm weapons on `right_hand` / `left_hand`. Without
// hand zones on the paperdoll, primaries fail validity on every drop
// AND render nowhere on the silhouette. Adding hands to the paperdoll
// reconciles both bugs (batch-1 drag-equip + batch-2 weapon render).
// The torso slot toggles between torso_front (FRONT view) and
// torso_back (REAR view).
type PaperdollFace = 'front' | 'rear';
type PaperdollZone =
  | 'head'
  | 'torso'
  | 'left_arm'
  | 'right_arm'
  | 'left_hand'
  | 'right_hand'
  | 'waist'
  | 'left_leg'
  | 'right_leg';

function torsoZoneFor(face: PaperdollFace): BodyZone {
  return face === 'front' ? 'torso_front' : 'torso_back';
}

function bodyZoneFor(z: PaperdollZone, face: PaperdollFace): BodyZone {
  if (z === 'torso') return torsoZoneFor(face);
  return z;
}

// ── NWLoadoutEditor (top-level) ──────────────────────────────────────────

export function NWLoadoutEditor({
  squadId,
  member,
}: {
  squadId: string;
  member: SquadMember;
}): React.JSX.Element {
  const setMemberLoadout = useSquads((s) => s.setMemberLoadout);
  const bundle = getContent();
  const lookup = contentLookup();
  const op = bundle.operators.get(member.operatorId);

  const validation = validateLoadout(member.loadout, lookup);
  const profile = deriveCombatProfile(member.loadout, lookup);
  const fit = computeFit(member.loadout, defaultBodyProfile(), lookup);

  const [stockpileCat, setStockpileCat] = useState<StockpileCat>('weapon');
  const [stockpileSearch, setStockpileSearch] = useState('');
  const [face, setFace] = useState<PaperdollFace>('front');
  const [selectedZone, setSelectedZone] = useState<PaperdollZone>('torso');
  const [hoverItemKey, setHoverItemKey] = useState<string | null>(null);
  // Drag state: which stockpile item is being dragged + which zone is
  // currently the drop target. The validity flag drives the per-zone
  // green/red preview + the reason tooltip.
  const [dragItem, setDragItem] = useState<{ type: StockpileCat; id: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    zone: PaperdollZone;
    valid: boolean;
    reason: string;
  } | null>(null);

  function updateItems(next: LoadoutItem[]): void {
    setMemberLoadout(squadId, member.operatorId, { items: next });
  }

  function removeItem(index: number): void {
    const next = [...member.loadout.items];
    next.splice(index, 1);
    updateItems(next);
  }

  function resetLoadout(): void {
    updateItems([]);
  }

  function equipAt(
    type: StockpileCat,
    id: string,
    zone: PaperdollZone,
    opts: { swap?: boolean; evict?: boolean } = {},
  ): void {
    const targetZone = bodyZoneFor(zone, face);
    const validity = canPlaceItem(bundle, member.loadout, type, id, targetZone, lookup);
    if (!validity.valid && !opts.swap && !opts.evict) return;
    let next = [...member.loadout.items];
    if (opts.swap || opts.evict) {
      // Strip only the items the new one would actually conflict with.
      // The previous logic stripped EVERY item at targetZone, which
      // wiped pouches / ammo / kit anchored on the same zone whenever
      // someone shift-swapped a plate. Conflict rules mirror
      // canPlaceItem: weapons conflict with weapons in the same slot,
      // armor conflicts with any armor covering the target zone (via
      // placements), and ammo / utility never force eviction.
      next = next.filter((it) => !conflictsWith(it, type, targetZone, lookup));
    }
    next.push({ type, id, zone: targetZone });
    updateItems(next);
  }

  // ADR 016 §Q11. Total rounds carried by caliber, surfaced in the
  // top-bar chips below.
  const carriedAmmoByCaliber = new Map<string, number>();
  for (const it of member.loadout.items) {
    if (it.type !== 'ammo') continue;
    const a = lookup.ammo?.(it.id);
    if (!a) continue;
    carriedAmmoByCaliber.set(
      a.caliber,
      (carriedAmmoByCaliber.get(a.caliber) ?? 0) + a.roundsPerMag,
    );
  }

  return (
    <div
      className="armory-editor nw-armory"
      style={{
        background: NW.bg0,
        color: NW.fg0,
        fontFamily: NW.body,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        position: 'relative',
      }}
    >
      <NWArmoryTopBar
        operator={op}
        member={member}
        totalKg={profile.totalWeightKg}
        budgetKg={INFANTRY_WEIGHT_KG_BUDGET}
        mobilityPenalty={profile.mobilityPenalty}
        carriedAmmoByCaliber={carriedAmmoByCaliber}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr 360px',
          gap: 12,
          padding: 12,
          flex: 1,
          minHeight: 0,
        }}
      >
        <NWStockpile
          bundle={bundle}
          loadout={member.loadout}
          activeCat={stockpileCat}
          onCatChange={setStockpileCat}
          search={stockpileSearch}
          onSearchChange={setStockpileSearch}
          onEquip={(type, id) => {
            // Double-click on a stockpile row → auto-fit to first valid
            // zone (#280.25). defaultEquipZone biases toward the
            // currently selected paperdoll zone where it's viable;
            // otherwise it falls back to the canonical placement (e.g.
            // first armor placement, sidearm → waist, ammo → torso).
            const targetZone = defaultEquipZone(type, selectedZone, face, bundle, id);
            updateItems([...member.loadout.items, { type, id, zone: targetZone }]);
          }}
          onHoverItem={setHoverItemKey}
          hoverItemKey={hoverItemKey}
          onDragStart={(type, id) => setDragItem({ type, id })}
          onDragEnd={() => {
            setDragItem(null);
            setDropTarget(null);
          }}
        />

        <NWPaperdollEditor
          face={face}
          onFaceChange={setFace}
          selectedZone={selectedZone}
          onSelectZone={setSelectedZone}
          loadout={member.loadout}
          lookup={lookup}
          hoverItemKey={hoverItemKey}
          bundle={bundle}
          fit={fit}
          dragItem={dragItem}
          dropTarget={dropTarget}
          onDragOverZone={(zone, modifiers) => {
            if (!dragItem) return;
            const bz = bodyZoneFor(zone, face);
            const v = canPlaceItem(bundle, member.loadout, dragItem.type, dragItem.id, bz, lookup);
            // Shift = swap (treat occupied-zone failures as valid drop).
            const valid =
              v.valid ||
              (modifiers.shift && v.reason.includes('already')) ||
              modifiers.alt;
            setDropTarget({ zone, valid, reason: v.reason });
          }}
          onDragLeaveZone={() => setDropTarget(null)}
          onDropZone={(zone, modifiers) => {
            if (!dragItem) return;
            equipAt(dragItem.type, dragItem.id, zone, {
              swap: modifiers.shift,
              evict: modifiers.alt,
            });
            setDragItem(null);
            setDropTarget(null);
          }}
        />

        <NWZoneInspector
          zone={selectedZone}
          face={face}
          loadout={member.loadout}
          lookup={lookup}
          fit={fit}
          onRemove={removeItem}
        />
      </div>

      <NWArmoryBottomBar
        valid={validation.valid && fit.valid}
        validationErrors={validation.errors}
        fitErrors={fit.errors}
        profile={profile}
        onReset={resetLoadout}
      />
    </div>
  );
}

// ── Top bar ──────────────────────────────────────────────────────────────

function NWArmoryTopBar({
  operator,
  member,
  totalKg,
  budgetKg,
  mobilityPenalty,
  carriedAmmoByCaliber,
}: {
  operator: Operator | undefined;
  member: SquadMember;
  totalKg: number;
  budgetKg: number;
  mobilityPenalty: number;
  carriedAmmoByCaliber: Map<string, number>;
}): React.JSX.Element {
  const callsign = operator?.callsign ?? member.operatorId;
  const name = operator?.name ?? '';
  const tier = operator?.tier ?? 'green';
  const stats = operator?.stats ?? { aim: 50, move: 50, grit: 50, awareness: 50, medical: 30 };
  const pct = Math.min(1, totalKg / budgetKg);
  // STAM penalty is the user-facing aggregate of overload — we tie it to
  // the same mobility curve as MOVE for the MVP, then split when the
  // stamina simulation lands. Q14b is deferred.
  const stamPenalty = mobilityPenalty;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '360px 1fr 340px',
        height: 88,
        borderBottom: `1px solid ${NW.line}`,
        background: NW.bg1,
        position: 'relative',
        zIndex: 1,
        flexShrink: 0,
      }}
    >
      {/* Operator card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 20px',
          borderRight: `1px solid ${NW.line}`,
        }}
      >
        <div style={{ width: 54, height: 58, position: 'relative' }}>
          <svg viewBox="0 0 54 58" aria-hidden>
            <title>operator portrait frame</title>
            <path
              d="M 27 2 L 50 14 L 50 42 L 27 56 L 4 42 L 4 14 Z"
              fill={NW.cyanSoft}
              stroke={NW.cyan}
              strokeWidth="1.2"
            />
            <circle cx="27" cy="22" r="6" fill={NW.cyan} />
            <path d="M 12 46 Q 27 34 42 46" fill={NW.cyan} />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: NW.mono,
              fontSize: 9,
              color: NW.cyan,
              letterSpacing: '0.2em',
            }}
          >
            ◆ OPERATOR · {tier.toUpperCase()}
          </div>
          <div
            style={{
              fontFamily: NW.display,
              fontSize: 22,
              color: NW.fg0,
              fontWeight: 700,
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={`"${callsign}" ${name}`}
          >
            "{callsign}"
          </div>
          <div
            style={{
              fontFamily: NW.mono,
              fontSize: 10,
              color: NW.fg2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name} · {member.operatorId}
          </div>
        </div>
      </div>

      {/* Combat-load + stats */}
      <div style={{ padding: '12px 28px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: NW.mono,
            fontSize: 9,
            letterSpacing: '0.18em',
            color: NW.fg2,
          }}
        >
          <span>◆ COMBAT LOAD</span>
          <span>
            <span
              style={{
                fontFamily: NW.display,
                fontSize: 16,
                color: pct > 1 ? NW.magenta : NW.cyan,
                fontWeight: 700,
              }}
            >
              {totalKg.toFixed(1)}
            </span>
            <span style={{ color: NW.fg2 }}>
              {' '}
              / {budgetKg.toFixed(1)} KG · {Math.round(pct * 100)}%
            </span>
          </span>
        </div>
        {/* Q14b: single bar with 20% threshold marks. */}
        <CombatLoadBar pct={pct} />
        <div
          style={{
            display: 'flex',
            gap: 14,
            fontFamily: NW.mono,
            fontSize: 10,
            color: NW.fg2,
            letterSpacing: '0.1em',
            marginTop: 4,
          }}
        >
          <StatChip label="AIM" value={stats.aim} />
          <StatChip label="MOV" value={stats.move} />
          <StatChip label="GRT" value={stats.grit} />
          <StatChip label="AWR" value={stats.awareness} />
          <StatChip label="MED" value={stats.medical} />
          <span style={{ flex: 1 }} />
          <span
            style={{ color: stamPenalty > 0 ? NW.magenta : NW.fg2 }}
            title="Stamina drain penalty from carried weight"
          >
            STAM {stamPenalty > 0 ? '−' : '±'}
            {stamPenalty}%
          </span>
          <span
            style={{ color: mobilityPenalty > 0 ? NW.magenta : NW.fg2 }}
            title="Movement speed penalty from carried weight"
          >
            MOVE {mobilityPenalty > 0 ? '−' : '±'}
            {mobilityPenalty}%
          </span>
        </div>
      </div>

      {/* Right side: ammo readout */}
      <div style={{ borderLeft: `1px solid ${NW.line}`, padding: 14 }}>
        <div
          style={{
            fontFamily: NW.mono,
            fontSize: 9,
            color: NW.cyan,
            letterSpacing: '0.18em',
            marginBottom: 6,
          }}
        >
          ◆ AMMO
        </div>
        {carriedAmmoByCaliber.size === 0 ? (
          <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>
            no rounds carried
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[...carriedAmmoByCaliber.entries()].map(([cal, n]) => (
              <div
                key={cal}
                style={{
                  padding: '4px 9px',
                  clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)',
                  background: NW.cyanSoft,
                  boxShadow: `inset 0 0 0 1px ${NW.cyan}`,
                  fontFamily: NW.mono,
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  color: NW.cyan,
                }}
              >
                {cal} · {n}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <span title={`${label} skill`} style={{ color: NW.fg2 }}>
      {label}{' '}
      <span style={{ color: NW.fg0, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </span>
  );
}

function CombatLoadBar({ pct }: { pct: number }): React.JSX.Element {
  // Threshold marks at 20/40/60/80 — matches the four-segment penalty
  // model in Q14b ("increment in percents of 20").
  const clamped = Math.max(0, Math.min(1.2, pct));
  const fillColor =
    pct > 1 ? NW.magenta : pct > 0.8 ? NW.amber : NW.cyan;
  return (
    <div
      style={{
        position: 'relative',
        height: 10,
        background: NW.bg2,
        boxShadow: `inset 0 0 0 1px ${NW.line2}`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: `${Math.min(100, clamped * 100)}%`,
          background: fillColor,
          opacity: 0.85,
          boxShadow: `0 0 6px ${fillColor}80`,
        }}
      />
      {[0.2, 0.4, 0.6, 0.8].map((m) => (
        <div
          key={m}
          aria-hidden
          style={{
            position: 'absolute',
            top: -2,
            bottom: -2,
            left: `${m * 100}%`,
            width: 1,
            background: NW.line2,
          }}
        />
      ))}
    </div>
  );
}

// ── Stockpile ────────────────────────────────────────────────────────────

type StockpileItem = {
  key: string;
  type: StockpileCat;
  id: string;
  name: string;
  weightKg: number;
  meta: string;
  equipped: boolean;
};

function NWStockpile({
  bundle,
  loadout,
  activeCat,
  onCatChange,
  search,
  onSearchChange,
  onEquip,
  onHoverItem,
  hoverItemKey,
  onDragStart,
  onDragEnd,
}: {
  bundle: ContentBundle;
  loadout: { items: readonly LoadoutItem[] };
  activeCat: StockpileCat;
  onCatChange: (c: StockpileCat) => void;
  search: string;
  onSearchChange: (s: string) => void;
  onEquip: (type: StockpileCat, id: string) => void;
  onHoverItem: (k: string | null) => void;
  hoverItemKey: string | null;
  onDragStart: (type: StockpileCat, id: string) => void;
  onDragEnd: () => void;
}): React.JSX.Element {
  const items = useMemo(
    () => buildStockpile(bundle, loadout, activeCat, search),
    [bundle, loadout, activeCat, search],
  );

  return (
    <NWPanel
      title="STOCKPILE"
      padding={0}
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
    >
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: 10,
          borderBottom: `1px solid ${NW.line}`,
        }}
      >
        {(['weapon', 'armor', 'utility', 'ammo'] as StockpileCat[]).map((c) => (
          <NWChip
            key={c}
            small
            primary={activeCat === c}
            onClick={() => onCatChange(c)}
          >
            {c.toUpperCase()}
          </NWChip>
        ))}
      </div>
      <div
        style={{
          padding: 10,
          borderBottom: `1px solid ${NW.line}`,
        }}
      >
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
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="search…"
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
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {items.length === 0 ? (
          <div
            style={{
              padding: 20,
              fontFamily: NW.mono,
              fontSize: 10,
              color: NW.fg2,
              textAlign: 'center',
            }}
          >
            no items
          </div>
        ) : (
          items.map((it) => (
            <StockpileRow
              key={it.key}
              item={it}
              hovered={hoverItemKey === it.key}
              onHover={(h) => onHoverItem(h ? it.key : null)}
              onEquip={() => onEquip(it.type, it.id)}
              onDragStart={() => onDragStart(it.type, it.id)}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </NWPanel>
  );
}

function StockpileRow({
  item,
  hovered,
  onHover,
  onEquip,
  onDragStart,
  onDragEnd,
}: {
  item: StockpileItem;
  hovered: boolean;
  onHover: (h: boolean) => void;
  onEquip: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}): React.JSX.Element {
  const c = item.equipped ? NW.cyan : hovered ? NW.amber : NW.fg0;
  const bg = item.equipped ? NW.cyanSoft : hovered ? 'rgba(255,160,32,0.05)' : 'transparent';
  return (
    <button
      type="button"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onDoubleClick={onEquip}
      onClick={onEquip}
      draggable
      onDragStart={(ev) => {
        // Native HTML5 drag — the dataTransfer payload is mostly cosmetic
        // (we steer the equip via React state in the parent), but a
        // payload is required for Firefox to fire dragstart at all.
        ev.dataTransfer.effectAllowed = 'copyMove';
        ev.dataTransfer.setData('text/plain', `${item.type}:${item.id}`);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        padding: '9px 14px',
        borderBottom: `1px solid ${NW.line}`,
        background: bg,
        borderLeft: `2px solid ${item.equipped ? NW.cyan : 'transparent'}`,
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        border: 'none',
        borderTop: 'none',
        borderRight: 'none',
      }}
      title="Drag to a paperdoll zone, or click / double-click to auto-equip"
    >
      <div>
        <div
          style={{
            fontFamily: NW.display,
            fontSize: 13,
            fontWeight: 700,
            color: c,
            letterSpacing: '0.04em',
          }}
        >
          {item.name}
          {item.equipped ? (
            <span
              style={{
                fontFamily: NW.mono,
                color: NW.cyan,
                fontSize: 9,
                marginLeft: 6,
              }}
            >
              ◆ EQUIP
            </span>
          ) : null}
        </div>
        <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>{item.meta}</div>
      </div>
      <div
        style={{
          textAlign: 'right',
          fontFamily: NW.mono,
          fontSize: 10,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div style={{ color: NW.fg1 }}>{item.weightKg.toFixed(1)} KG</div>
      </div>
    </button>
  );
}

function buildStockpile(
  bundle: ContentBundle,
  loadout: { items: readonly LoadoutItem[] },
  cat: StockpileCat,
  search: string,
): StockpileItem[] {
  const equipped = new Set<string>();
  for (const it of loadout.items) {
    if (it.type === cat) equipped.add(it.id);
  }
  const q = search.trim().toLowerCase();
  const out: StockpileItem[] = [];

  if (cat === 'weapon') {
    for (const w of bundle.weapons.values()) {
      out.push({
        key: `weapon:${w.id}`,
        type: 'weapon',
        id: w.id,
        name: w.name,
        weightKg: w.weightKg,
        meta: `${w.caliber ?? `${w.ballistics.caliberMm}mm`} · ${w.hardpoint.toUpperCase()}`,
        equipped: equipped.has(w.id),
      });
    }
  } else if (cat === 'armor') {
    for (const a of bundle.armor.values()) {
      const totalKg = a.placements.reduce((s, p) => s + p.weightKg, 0);
      out.push({
        key: `armor:${a.id}`,
        type: 'armor',
        id: a.id,
        name: a.name,
        weightKg: totalKg,
        meta: `${a.class.toUpperCase()} · ${a.placements.length} ZONES`,
        equipped: equipped.has(a.id),
      });
    }
  } else if (cat === 'utility') {
    for (const u of bundle.utility.values()) {
      out.push({
        key: `utility:${u.id}`,
        type: 'utility',
        id: u.id,
        name: u.name,
        weightKg: u.weightKg,
        meta: `${u.kind.toUpperCase()}${u.consumableCategory ? ` · ${u.consumableCategory}` : ''}`,
        equipped: equipped.has(u.id),
      });
    }
  } else {
    for (const a of bundle.ammo.values()) {
      out.push({
        key: `ammo:${a.id}`,
        type: 'ammo',
        id: a.id,
        name: a.name,
        weightKg: a.weightKg,
        meta: `${a.caliber} · ${a.roundsPerMag}RD`,
        equipped: equipped.has(a.id),
      });
    }
  }

  return q ? out.filter((it) => it.name.toLowerCase().includes(q) || it.meta.toLowerCase().includes(q)) : out;
}

// Drag-drop validity check (#280.21). Reports whether a stockpile item
// can be placed on a paperdoll zone given the current loadout, with a
// short reason string for the hover tooltip on failure. The Shift
// modifier (swap) intentionally bypasses zone-occupied gating;
// see equipAt() — we only fail "valid" here when the item is genuinely
// not placeable at all (e.g. weapon hardpoint mismatch, armor zone
// not in placements list).
function canPlaceItem(
  bundle: ContentBundle,
  loadout: { items: readonly LoadoutItem[] },
  type: StockpileCat,
  id: string,
  zone: BodyZone,
  lookup: ReturnType<typeof contentLookup>,
): { valid: boolean; reason: string } {
  if (type === 'weapon') {
    const w = bundle.weapons.get(id);
    if (!w) return { valid: false, reason: 'unknown weapon' };
    if (w.hardpoint === 'sidearm' && zone !== 'waist') {
      return { valid: false, reason: 'sidearm fits the waist holster only' };
    }
    if (w.hardpoint === 'primary' && zone !== 'right_hand' && zone !== 'left_hand') {
      return { valid: false, reason: 'primary fits a hand slot' };
    }
  } else if (type === 'armor') {
    const a = bundle.armor.get(id);
    if (!a) return { valid: false, reason: 'unknown armor' };
    const placement = a.placements.find((p) => p.zone === zone);
    if (!placement) {
      return { valid: false, reason: `${a.name} doesn't cover this zone` };
    }
    // Per #285.04: at most one armor piece per zone.
    const already = loadout.items.some((it) => {
      if (it.type !== 'armor') return false;
      const other = lookup.armor(it.id);
      return other?.placements.some((p) => p.zone === zone) ?? false;
    });
    if (already) return { valid: false, reason: 'zone already armored — Shift to swap' };
  }
  // Ammo + utility have no per-zone gating; any zone is fine.
  return { valid: true, reason: '' };
}

// Whether an existing loadout item conflicts with a new one being
// shift-swapped onto `targetZone`. Conflict means "same slot can't
// hold both" — kept narrow so the swap evicts only what canPlaceItem
// would otherwise reject. Ammo / utility never force eviction; they
// can stack at the same zone.
function conflictsWith(
  it: LoadoutItem,
  newType: StockpileCat,
  targetZone: BodyZone,
  lookup: ReturnType<typeof contentLookup>,
): boolean {
  if (newType === 'weapon') {
    return it.type === 'weapon' && it.zone === targetZone;
  }
  if (newType === 'armor') {
    if (it.type !== 'armor') return false;
    const armor = lookup.armor(it.id);
    return armor?.placements.some((p) => p.zone === targetZone) ?? false;
  }
  return false;
}

function defaultEquipZone(
  type: StockpileCat,
  selected: PaperdollZone,
  face: PaperdollFace,
  bundle: ContentBundle,
  id: string,
): BodyZone {
  if (type === 'weapon') {
    const w = bundle.weapons.get(id);
    if (w?.hardpoint === 'sidearm') return 'waist';
    return 'right_hand';
  }
  if (type === 'armor') {
    // Armor pieces declare their own placements; the loadout uses the
    // first placement zone as the canonical anchor.
    const a = bundle.armor.get(id);
    if (a && a.placements.length > 0) return a.placements[0].zone;
    return bodyZoneFor(selected, face);
  }
  if (type === 'ammo') {
    return 'torso_front';
  }
  return bodyZoneFor(selected, face);
}

// ── Paperdoll ────────────────────────────────────────────────────────────

type ZoneTone = 'full' | 'partial' | 'empty';

function NWPaperdollEditor({
  face,
  onFaceChange,
  selectedZone,
  onSelectZone,
  loadout,
  lookup,
  hoverItemKey,
  bundle,
  fit,
  dragItem,
  dropTarget,
  onDragOverZone,
  onDragLeaveZone,
  onDropZone,
}: {
  face: PaperdollFace;
  onFaceChange: (f: PaperdollFace) => void;
  selectedZone: PaperdollZone;
  onSelectZone: (z: PaperdollZone) => void;
  loadout: { items: readonly LoadoutItem[] };
  lookup: ReturnType<typeof contentLookup>;
  hoverItemKey: string | null;
  bundle: ContentBundle;
  fit: ReturnType<typeof computeFit>;
  dragItem: { type: StockpileCat; id: string } | null;
  dropTarget: { zone: PaperdollZone; valid: boolean; reason: string } | null;
  onDragOverZone: (zone: PaperdollZone, modifiers: { shift: boolean; alt: boolean }) => void;
  onDragLeaveZone: () => void;
  onDropZone: (zone: PaperdollZone, modifiers: { shift: boolean; alt: boolean }) => void;
}): React.JSX.Element {
  const profile = useMemo(() => deriveCombatProfile(loadout, lookup), [loadout, lookup]);

  function zoneTone(zone: PaperdollZone): ZoneTone {
    const bz = bodyZoneFor(zone, face);
    const dr = profile.zoneDr[bz] ?? 0;
    if (dr >= 50) return 'full';
    if (dr > 0) return 'partial';
    return 'empty';
  }

  return (
    <NWPanel
      title="KIT · HIT ZONES"
      padding={0}
      style={{ position: 'relative', overflow: 'hidden', minHeight: 0 }}
      right={
        <>
          <NWChip small primary={face === 'front'} onClick={() => onFaceChange('front')}>
            FRONT
          </NWChip>
          <NWChip small primary={face === 'rear'} onClick={() => onFaceChange('rear')}>
            REAR
          </NWChip>
        </>
      }
    >
      <svg
        viewBox="-40 -20 220 255"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <title>operator paperdoll</title>
        <defs>
          <pattern id="nwa-grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path
              d="M 8 0 H 0 V 8"
              stroke={NW.line}
              strokeWidth="0.2"
              fill="none"
              opacity="0.7"
            />
          </pattern>
        </defs>
        <rect x="-40" y="-20" width="220" height="255" fill="url(#nwa-grid)" />

        {/* schematic chart underlay — center axis + horizon */}
        <line
          x1="70"
          y1="-10"
          x2="70"
          y2="220"
          stroke={NW.cyan}
          strokeWidth="0.3"
          strokeDasharray="2 3"
          opacity="0.35"
        />
        <line
          x1="-30"
          y1="100"
          x2="170"
          y2="100"
          stroke={NW.cyan}
          strokeWidth="0.3"
          strokeDasharray="2 3"
          opacity="0.2"
        />

        {PAPERDOLL_ZONES.map((z) => {
          const bz = bodyZoneFor(z.id, face);
          const isDropTarget = dropTarget?.zone === z.id && dragItem !== null;
          const slotsUsed = fit.perZone[bz]?.slotsUsed ?? 0;
          const slotsCap = fit.perZone[bz]?.slotsCap ?? 0;
          return (
            <NWHitZone
              key={z.id}
              zone={z}
              tone={zoneTone(z.id)}
              selected={selectedZone === z.id}
              onClick={() => onSelectZone(z.id)}
              zoneDr={profile.zoneDr[bz] ?? 0}
              zoneKg={zoneKgFor(loadout, lookup, bz)}
              slotsUsed={slotsUsed}
              slotsCap={slotsCap}
              dropState={
                isDropTarget ? (dropTarget?.valid ? 'valid' : 'invalid') : 'none'
              }
              dragActive={dragItem !== null}
              onDragOver={(modifiers) => onDragOverZone(z.id, modifiers)}
              onDragLeave={onDragLeaveZone}
              onDrop={(modifiers) => onDropZone(z.id, modifiers)}
            />
          );
        })}

        {dropTarget && !dropTarget.valid && (
          <DropTooltip target={dropTarget} />
        )}

        {/* anatomical level ticks — "medical chart" feel */}
        {(
          [
            ['HEAD', 22],
            ['CHEST', 75],
            ['ABD', 110],
            ['HIP', 128],
            ['KNEE', 160],
            ['FOOT', 192],
          ] as [string, number][]
        ).map(([lbl, y]) => (
          <g key={lbl}>
            <line x1="-28" y1={y} x2="-20" y2={y} stroke={NW.fg2} strokeWidth="0.3" />
            <text
              x="-32"
              y={y + 2}
              fill={NW.fg2}
              fontSize="4.2"
              fontFamily={NW.mono}
              letterSpacing="0.8"
              textAnchor="end"
            >
              {lbl}
            </text>
          </g>
        ))}
      </svg>

      {hoverItemKey ? <HoverPreviewCard itemKey={hoverItemKey} bundle={bundle} /> : null}

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          left: 20,
          bottom: 16,
          display: 'flex',
          gap: 18,
          fontFamily: NW.mono,
          fontSize: 10,
          color: NW.fg2,
          letterSpacing: '0.12em',
        }}
      >
        <span>
          <span style={{ color: NW.cyan }}>■</span> FULL
        </span>
        <span>
          <span style={{ color: NW.cyan, opacity: 0.5 }}>■</span> PARTIAL
        </span>
        <span>
          <span style={{ color: NW.line2 }}>■</span> EMPTY
        </span>
        <span>
          <span style={{ color: NW.amber }}>◆</span> HOVER
        </span>
      </div>
    </NWPanel>
  );
}

function zoneKgFor(
  loadout: { items: readonly LoadoutItem[] },
  lookup: ReturnType<typeof contentLookup>,
  zone: BodyZone,
): number {
  let kg = 0;
  for (const it of loadout.items) {
    if (it.zone !== zone) continue;
    if (it.type === 'weapon') kg += lookup.weapon(it.id)?.weightKg ?? 0;
    else if (it.type === 'armor') {
      const a = lookup.armor(it.id);
      const p = a?.placements.find((pp) => pp.zone === zone);
      kg += p?.weightKg ?? 0;
    } else if (it.type === 'utility') kg += lookup.utility(it.id)?.weightKg ?? 0;
    else if (it.type === 'ammo') kg += lookup.ammo?.(it.id)?.weightKg ?? 0;
  }
  return kg;
}

// 9-zone paperdoll geometry. Torso toggles between torso_front and
// torso_back via the FRONT/REAR chip. Hand zones sit just below the
// arms — that's where the primary / sidearm slots anchor.
const PAPERDOLL_ZONES: {
  id: PaperdollZone;
  d: string;
  labelPos: [number, number];
  label: string;
}[] = [
  { id: 'head', d: 'M 70 10 a 16 18 0 1 0 0.1 0 Z', labelPos: [70, 22], label: 'HEAD' },
  { id: 'torso', d: 'M 46 54 L 94 54 L 96 96 L 90 124 L 50 124 L 44 96 Z', labelPos: [70, 90], label: 'TORSO' },
  { id: 'left_arm', d: 'M 30 56 L 46 54 L 48 116 L 30 118 Z', labelPos: [38, 88], label: 'L·ARM' },
  { id: 'right_arm', d: 'M 94 54 L 110 56 L 110 118 L 92 116 Z', labelPos: [102, 88], label: 'R·ARM' },
  { id: 'left_hand', d: 'M 26 118 L 48 116 L 46 134 L 24 134 Z', labelPos: [36, 128], label: 'L·HAND' },
  { id: 'right_hand', d: 'M 92 116 L 114 118 L 116 134 L 94 134 Z', labelPos: [104, 128], label: 'R·HAND' },
  { id: 'waist', d: 'M 50 124 L 90 124 L 88 138 L 52 138 Z', labelPos: [70, 132], label: 'WAIST' },
  { id: 'left_leg', d: 'M 50 138 L 68 138 L 66 200 L 48 200 Z', labelPos: [58, 168], label: 'L·LEG' },
  { id: 'right_leg', d: 'M 72 138 L 90 138 L 92 200 L 74 200 Z', labelPos: [82, 168], label: 'R·LEG' },
];

// Crit-slot grid sizes per zone (#280.10). Mirrors the design package
// table — head 3×2, torso 4×3, arms 2×6, waist 3×2, legs 6×4-ish (we
// use 3×4 to fit the silhouette area).
const CRIT_SLOT_GRID: Record<PaperdollZone, { cols: number; rows: number }> = {
  head: { cols: 3, rows: 2 },
  torso: { cols: 4, rows: 3 },
  left_arm: { cols: 2, rows: 6 },
  right_arm: { cols: 2, rows: 6 },
  left_hand: { cols: 2, rows: 1 },
  right_hand: { cols: 2, rows: 1 },
  waist: { cols: 3, rows: 2 },
  left_leg: { cols: 3, rows: 4 },
  right_leg: { cols: 3, rows: 4 },
};

function NWHitZone({
  zone,
  tone,
  selected,
  onClick,
  zoneDr,
  zoneKg,
  slotsUsed,
  slotsCap,
  dropState,
  dragActive,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  zone: (typeof PAPERDOLL_ZONES)[number];
  tone: ZoneTone;
  selected: boolean;
  onClick: () => void;
  zoneDr: number;
  zoneKg: number;
  slotsUsed: number;
  slotsCap: number;
  dropState: 'valid' | 'invalid' | 'none';
  dragActive: boolean;
  onDragOver: (modifiers: { shift: boolean; alt: boolean }) => void;
  onDragLeave: () => void;
  onDrop: (modifiers: { shift: boolean; alt: boolean }) => void;
}): React.JSX.Element {
  const baseFill =
    tone === 'full'
      ? 'rgba(24,224,255,0.22)'
      : tone === 'partial'
        ? 'rgba(24,224,255,0.09)'
        : 'rgba(24,224,255,0.02)';
  const fill =
    dropState === 'valid'
      ? 'rgba(51,255,160,0.22)'
      : dropState === 'invalid'
        ? 'rgba(255,45,154,0.22)'
        : baseFill;
  const baseStroke = selected
    ? NW.amber
    : tone === 'empty'
      ? NW.line2
      : tone === 'partial'
        ? `${NW.cyan}aa`
        : NW.cyan;
  const stroke =
    dropState === 'valid' ? NW.green : dropState === 'invalid' ? NW.magenta : baseStroke;
  const sw = selected || dropState !== 'none' ? 1.4 : tone === 'empty' ? 0.5 : 0.8;
  const dash = dropState === 'invalid' ? '1 1' : tone === 'empty' && dropState === 'none' ? '2 2' : '';
  const labelColor = tone === 'empty' ? NW.fg2 : selected ? NW.amber : NW.cyan;
  const [tx, ty] = zone.labelPos;
  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG <g> can't be a <button>; role/tabIndex/onKeyDown give keyboard parity.
    <g
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onClick();
        }
      }}
      onDragOver={(ev) => {
        // preventDefault enables drop; we also surface the shift/alt
        // modifier state every frame so the parent can re-evaluate
        // validity.
        ev.preventDefault();
        ev.dataTransfer.dropEffect = ev.shiftKey ? 'move' : 'copy';
        onDragOver({ shift: ev.shiftKey, alt: ev.altKey });
      }}
      onDragLeave={onDragLeave}
      onDrop={(ev) => {
        ev.preventDefault();
        onDrop({ shift: ev.shiftKey, alt: ev.altKey });
      }}
      style={{ cursor: dragActive ? 'copy' : 'pointer' }}
    >
      <path
        d={zone.d}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray={dash}
      />
      <CritSlotOverlay zone={zone} slotsUsed={slotsUsed} slotsCap={slotsCap} />
      <text
        x={tx}
        y={ty}
        fill={labelColor}
        fontSize="3.4"
        fontFamily={NW.mono}
        textAnchor="middle"
        letterSpacing="0.5"
        fontWeight="700"
      >
        {zone.label}
      </text>
      {tone !== 'empty' ? (
        <text
          x={tx}
          y={ty + 5}
          fill={NW.fg2}
          fontSize="2.8"
          fontFamily={NW.mono}
          textAnchor="middle"
          letterSpacing="0.4"
        >
          {zoneKg.toFixed(1)}KG · DR{Math.round(zoneDr)}
        </text>
      ) : null}
      {selected ? (
        <path
          d={zone.d}
          fill="none"
          stroke={NW.amber}
          strokeWidth="0.4"
          strokeDasharray="1 1"
          opacity="0.8"
        />
      ) : null}
    </g>
  );
}

// Per-zone crit-slot grid (#280.10). Renders a small grid of dots
// inside the zone polygon's bounding box — filled dots equal slotsUsed,
// outlined dots equal slotsCap - slotsUsed. Pointer-events disabled so
// the parent group still receives clicks + drops.
function CritSlotOverlay({
  zone,
  slotsUsed,
  slotsCap,
}: {
  zone: (typeof PAPERDOLL_ZONES)[number];
  slotsUsed: number;
  slotsCap: number;
}): React.JSX.Element | null {
  if (slotsCap <= 0) return null;
  const { cols, rows } = CRIT_SLOT_GRID[zone.id];
  // Place the grid centered on the zone's label position with a small
  // y-bias upward so it doesn't overlap the KG / DR readout.
  const [cx, cy] = zone.labelPos;
  const cellW = 1.6;
  const cellH = 1.6;
  const gx = cx - (cols * cellW) / 2 + cellW / 2;
  const gy = cy - 18;
  const total = cols * rows;
  // Cap the visual dot count to the schema capacity (slotsCap may be
  // smaller than the grid we draw; we fade trailing cells when so).
  const filledCount = Math.min(slotsUsed, slotsCap, total);
  return (
    <g pointerEvents="none">
      {Array.from({ length: total }).map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const beyondCap = i >= slotsCap;
        const filled = i < filledCount;
        const slotKey = `${col}-${row}`;
        const x = gx + col * cellW;
        const y = gy + row * cellH;
        return (
          <circle
            key={slotKey}
            cx={x}
            cy={y}
            r={0.45}
            fill={filled ? NW.cyan : 'none'}
            stroke={beyondCap ? NW.fgDim : filled ? NW.cyan : NW.line2}
            strokeWidth={0.2}
            opacity={beyondCap ? 0.3 : 1}
          />
        );
      })}
    </g>
  );
}

// Drop-validity tooltip (#280.21). Sits above the paperdoll panel so
// users see *why* a zone isn't accepting the dragged item.
function DropTooltip({
  target,
}: {
  target: { zone: PaperdollZone; valid: boolean; reason: string };
}): React.JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(20,30,60,0.95)',
        boxShadow: `inset 0 0 0 1px ${NW.magenta}`,
        padding: '6px 12px',
        fontFamily: NW.mono,
        fontSize: 10,
        color: NW.magenta,
        letterSpacing: '0.14em',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      ◆ {target.reason || 'invalid drop'}
    </div>
  );
}

function HoverPreviewCard({
  itemKey,
  bundle,
}: {
  itemKey: string;
  bundle: ContentBundle;
}): React.JSX.Element | null {
  const [type, id] = itemKey.split(':', 2) as [StockpileCat, string];
  let title = '';
  let rows: [string, string, NWAccent | 'fg' | 'fg2' | 'magenta'][] = [];

  if (type === 'weapon') {
    const w = bundle.weapons.get(id);
    if (!w) return null;
    title = w.name;
    rows = [
      ['WEIGHT', `${w.weightKg.toFixed(1)} KG`, 'fg'],
      ['CALIBER', `${w.caliber ?? `${w.ballistics.caliberMm}mm`}`, 'fg'],
      ['RPM', `${w.rpm}`, 'fg'],
      ['MAG', `${w.magazineSize}`, 'fg'],
      ['RANGE', `${w.rangeMeters}M`, 'fg'],
      ['ACCURACY', `${w.baseAccuracy}`, 'fg'],
    ];
  } else if (type === 'armor') {
    const a = bundle.armor.get(id);
    if (!a) return null;
    const totalKg = a.placements.reduce((s, p) => s + p.weightKg, 0);
    const avgDr = a.placements.reduce((s, p) => s + p.damageReduction, 0) / a.placements.length;
    title = a.name;
    rows = [
      ['WEIGHT', `${totalKg.toFixed(1)} KG`, 'magenta'],
      ['CLASS', a.class.toUpperCase(), 'fg'],
      ['ZONES', `${a.placements.length}`, 'fg'],
      ['AVG DR', `${avgDr.toFixed(0)}`, 'green' as NWAccent],
    ];
  } else if (type === 'utility') {
    const u = bundle.utility.get(id);
    if (!u) return null;
    title = u.name;
    rows = [
      ['WEIGHT', `${u.weightKg.toFixed(1)} KG`, 'fg'],
      ['KIND', u.kind.toUpperCase(), 'fg'],
      ['USES', `${u.uses}`, 'fg'],
    ];
  } else {
    const a = bundle.ammo.get(id);
    if (!a) return null;
    title = a.name;
    rows = [
      ['WEIGHT', `${a.weightKg.toFixed(1)} KG`, 'fg'],
      ['CALIBER', a.caliber, 'fg'],
      ['ROUNDS', `${a.roundsPerMag}`, 'fg'],
    ];
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: 20,
        top: 60,
        width: 230,
        clipPath: HEX_CLIP_TL_BR,
        WebkitClipPath: HEX_CLIP_TL_BR,
        background: 'rgba(6,9,20,0.96)',
        boxShadow: `inset 0 0 0 1px ${NW.amber}, 0 0 10px rgba(255,160,32,0.35)`,
        padding: 12,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: NW.mono,
          fontSize: 9,
          color: NW.amber,
          letterSpacing: '0.18em',
          marginBottom: 4,
        }}
      >
        ◆ PREVIEW · {type.toUpperCase()}
      </div>
      <div
        style={{
          fontFamily: NW.display,
          fontSize: 14,
          color: NW.fg0,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </div>
      <div style={{ height: 1, background: NW.line, margin: '6px 0' }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '3px 8px',
          fontFamily: NW.mono,
          fontSize: 10.5,
        }}
      >
        {rows.map(([l, v, c]) => {
          const color =
            c === 'fg'
              ? NW.fg0
              : c === 'fg2'
                ? NW.fg2
                : c === 'magenta'
                  ? NW.magenta
                  : c === 'green'
                    ? NW.green
                    : NW.fg0;
          return (
            <span key={l} style={{ display: 'contents' }}>
              <span style={{ color: NW.fg2 }}>{l}</span>
              <span style={{ color, fontWeight: 700 }}>{v}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Inspector ────────────────────────────────────────────────────────────

function NWZoneInspector({
  zone,
  face,
  loadout,
  lookup,
  fit,
  onRemove,
}: {
  zone: PaperdollZone;
  face: PaperdollFace;
  loadout: { items: readonly LoadoutItem[] };
  lookup: ReturnType<typeof contentLookup>;
  fit: ReturnType<typeof computeFit>;
  onRemove: (idx: number) => void;
}): React.JSX.Element {
  const bz = bodyZoneFor(zone, face);
  const itemsHere = loadout.items
    .map((it, i) => ({ it, i }))
    .filter((x) => x.it.zone === bz);

  const armorPlacement = (() => {
    for (const it of loadout.items) {
      if (it.type !== 'armor') continue;
      const a = lookup.armor(it.id);
      const p = a?.placements.find((pp) => pp.zone === bz);
      if (p) return { armor: a, placement: p };
    }
    return null;
  })();

  const cap = ZONE_CAPACITY_KG[bz];
  const used = itemsHere.reduce((acc, { it }) => {
    if (it.type === 'weapon') return acc + (lookup.weapon(it.id)?.weightKg ?? 0);
    if (it.type === 'armor') {
      const a = lookup.armor(it.id);
      const p = a?.placements.find((pp) => pp.zone === bz);
      return acc + (p?.weightKg ?? 0);
    }
    if (it.type === 'utility') return acc + (lookup.utility(it.id)?.weightKg ?? 0);
    if (it.type === 'ammo') return acc + (lookup.ammo?.(it.id)?.weightKg ?? 0);
    return acc;
  }, 0);

  const slotsUsed = fit.perZone[bz]?.slotsUsed ?? 0;
  const slotsCap = fit.perZone[bz]?.slotsCap ?? 0;

  return (
    <NWPanel
      title={`INSPECTOR · ${prettyZone(zone, face)}`}
      accent="amber"
      padding={0}
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
    >
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${NW.line}` }}>
        <div
          style={{
            fontFamily: NW.display,
            fontSize: 20,
            color: NW.fg0,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          {prettyZone(zone, face)}
        </div>
        <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>
          {used.toFixed(1)} / {cap.toFixed(1)} KG · {slotsUsed} / {slotsCap} SLOTS
        </div>
      </div>
      <div style={{ padding: 14, overflow: 'auto', flex: 1, minHeight: 0 }}>
        <div
          style={{
            fontFamily: NW.mono,
            fontSize: 9,
            color: NW.cyan,
            letterSpacing: '0.18em',
            marginBottom: 8,
          }}
        >
          ◆ EQUIPPED
        </div>
        {itemsHere.length === 0 ? (
          <div
            style={{
              padding: '8px 0',
              textAlign: 'center',
              fontFamily: NW.mono,
              fontSize: 10,
              color: NW.fg2,
              letterSpacing: '0.14em',
              boxShadow: `inset 0 0 0 1px ${NW.line2}`,
            }}
          >
            + DRAG HERE · ZONE EMPTY
          </div>
        ) : (
          itemsHere.map(({ it, i }) => (
            <EquippedRow
              key={`${it.type}:${it.id}:${i}`}
              type={it.type}
              id={it.id}
              zone={bz}
              lookup={lookup}
              onRemove={() => onRemove(i)}
            />
          ))
        )}
        <div style={{ height: 14 }} />
        <div
          style={{
            fontFamily: NW.mono,
            fontSize: 9,
            color: NW.cyan,
            letterSpacing: '0.18em',
            marginBottom: 10,
          }}
        >
          ◆ ZONE STATS
        </div>
        <ResistanceGrid placement={armorPlacement?.placement} />
        <div style={{ height: 14 }} />
        <div
          style={{
            fontFamily: NW.mono,
            fontSize: 9,
            color: NW.cyan,
            letterSpacing: '0.18em',
            marginBottom: 8,
          }}
        >
          ◆ MEDICAL HISTORY
        </div>
        <div
          style={{
            padding: 10,
            fontFamily: NW.mono,
            fontSize: 10,
            color: NW.fg2,
            boxShadow: `inset 0 0 0 1px ${NW.line2}`,
          }}
        >
          no recorded gunshot wounds in this zone
          <div style={{ marginTop: 4, color: NW.fgDim, fontSize: 9, letterSpacing: '0.14em' }}>
            ◇ persistent injury tracking deferred — see DEFERRED.md
          </div>
        </div>
      </div>
    </NWPanel>
  );
}

function prettyZone(z: PaperdollZone, face: PaperdollFace): string {
  if (z === 'torso') return face === 'front' ? 'TORSO · FRONT' : 'TORSO · REAR';
  if (z === 'left_arm') return 'LEFT ARM';
  if (z === 'right_arm') return 'RIGHT ARM';
  if (z === 'left_hand') return 'LEFT HAND';
  if (z === 'right_hand') return 'RIGHT HAND';
  if (z === 'left_leg') return 'LEFT LEG';
  if (z === 'right_leg') return 'RIGHT LEG';
  if (z === 'waist') return 'WAIST';
  return 'HEAD';
}

function EquippedRow({
  type,
  id,
  zone,
  lookup,
  onRemove,
}: {
  type: LoadoutItem['type'];
  id: string;
  zone: BodyZone;
  lookup: ReturnType<typeof contentLookup>;
  onRemove: () => void;
}): React.JSX.Element {
  let name = id;
  let meta = '';
  let kg = 0;
  let drLine = '';
  if (type === 'weapon') {
    const w = lookup.weapon(id);
    if (w) {
      name = w.name;
      meta = `${w.caliber ?? `${w.ballistics.caliberMm}mm`} · ${w.hardpoint.toUpperCase()}`;
      kg = w.weightKg;
    }
  } else if (type === 'armor') {
    const a = lookup.armor(id);
    if (a) {
      const p = a.placements.find((pp) => pp.zone === zone);
      name = a.name;
      meta = `${a.class.toUpperCase()} · ${p?.plate.toUpperCase() ?? '—'}`;
      kg = p?.weightKg ?? 0;
      if (p) drLine = `DR+${p.damageReduction}`;
    }
  } else if (type === 'utility') {
    const u = lookup.utility(id);
    if (u) {
      name = u.name;
      meta = u.kind.toUpperCase();
      kg = u.weightKg;
    }
  } else if (type === 'ammo') {
    const a = lookup.ammo?.(id);
    if (a) {
      name = a.name;
      meta = `${a.caliber} · ${a.roundsPerMag}RD`;
      kg = a.weightKg;
    }
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: rendered inside an inventory list; the parent container is the list, this row is content with a right-click affordance only.
    <div
      role="listitem"
      onContextMenu={(ev) => {
        // Right-click quick-unequip (#280.24): suppress the OS menu and
        // remove the item back to the warehouse in one click.
        ev.preventDefault();
        onRemove();
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
        background: NW.bg2,
        boxShadow: `inset 0 0 0 1px ${NW.line2}`,
        marginBottom: 4,
      }}
      title="Right-click to quick-unequip"
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
          {name}
        </div>
        <div style={{ fontFamily: NW.mono, fontSize: 10, color: NW.fg2 }}>{meta}</div>
      </div>
      <div
        style={{
          textAlign: 'right',
          fontFamily: NW.mono,
          fontSize: 10,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div style={{ color: NW.fg1 }}>{kg.toFixed(1)} KG</div>
        {drLine ? <div style={{ color: NW.amber }}>{drLine}</div> : null}
      </div>
      <button
        type="button"
        onClick={onRemove}
        title="Click to unequip (right-click does the same on the row)"
        style={{
          background: 'transparent',
          border: `1px solid ${NW.line2}`,
          color: NW.fg2,
          fontFamily: NW.mono,
          fontSize: 11,
          padding: '2px 8px',
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  );
}

function ResistanceGrid({
  placement,
}: {
  placement?: { damageReduction: number; penetrationResistance: number; fireResistance: number; empResistance: number };
}): React.JSX.Element {
  const rows: [string, number, NWAccent, string][] = placement
    ? [
        ['DMG RES', placement.damageReduction, 'cyan', `+${placement.damageReduction}`],
        ['PEN RES', placement.penetrationResistance, 'cyan', `+${placement.penetrationResistance}`],
        ['FIRE', placement.fireResistance, 'amber', `+${placement.fireResistance}`],
        ['EMP', placement.empResistance, 'cyan', `+${placement.empResistance}`],
      ]
    : [
        ['DMG RES', 0, 'cyan', '—'],
        ['PEN RES', 0, 'cyan', '—'],
        ['FIRE', 0, 'amber', '—'],
        ['EMP', 0, 'cyan', '—'],
      ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
      {rows.map(([l, n, tone, label]) => (
        <div key={l}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: NW.mono,
              fontSize: 10,
              color: NW.fg2,
            }}
          >
            <span>{l}</span>
            <span style={{ color: tone === 'amber' ? NW.amber : NW.cyan, fontWeight: 700 }}>
              {label}
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            <NWBar tone={tone} value={n / 100} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Bottom bar ───────────────────────────────────────────────────────────

function NWArmoryBottomBar({
  valid,
  validationErrors,
  fitErrors,
  profile,
  onReset,
}: {
  valid: boolean;
  validationErrors: string[];
  fitErrors: FitError[];
  profile: ReturnType<typeof deriveCombatProfile>;
  onReset: () => void;
}): React.JSX.Element {
  const errLabels = useMemo(() => {
    const out = [...validationErrors];
    for (const e of fitErrors) out.push(formatFitError(e));
    return out;
  }, [validationErrors, fitErrors]);

  return (
    <div
      style={{
        borderTop: `1px solid ${NW.line}`,
        background: NW.bg1,
        padding: '0 20px',
        flexShrink: 0,
      }}
    >
      {!valid ? (
        <div
          style={{
            padding: '6px 0',
            fontFamily: NW.mono,
            fontSize: 10,
            color: NW.magenta,
            letterSpacing: '0.1em',
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            borderBottom: `1px solid ${NW.line}`,
          }}
        >
          <span>⚠ {errLabels.length} ISSUE{errLabels.length === 1 ? '' : 'S'}:</span>
          {errLabels.slice(0, 3).map((e) => (
            <span key={e} style={{ color: NW.fg2 }}>
              {e}
            </span>
          ))}
          {errLabels.length > 3 ? (
            <span style={{ color: NW.fgDim }}>+{errLabels.length - 3} more</span>
          ) : null}
        </div>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          height: 64,
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 22, overflow: 'auto' }}>
          <DerivedStat
            label="MOVE"
            value={`${(5.4 * (1 - profile.mobilityPenalty / 100)).toFixed(1)} M/S`}
            delta={profile.mobilityPenalty > 0 ? `−${profile.mobilityPenalty}%` : '±0'}
            negative={profile.mobilityPenalty > 0}
          />
          <DerivedStat
            label="LOAD"
            value={`${profile.totalWeightKg.toFixed(1)} KG`}
            delta={`/ ${INFANTRY_WEIGHT_KG_BUDGET} KG`}
            negative={profile.totalWeightKg > INFANTRY_WEIGHT_KG_BUDGET}
          />
          <DerivedStat
            label="PRIMARY"
            value={profile.primaryWeapon?.name ?? '—'}
            delta={profile.primaryWeapon ? `${profile.primaryWeapon.rangeMeters}m` : ''}
          />
          <DerivedStat
            label="SIDE"
            value={profile.sidearm?.name ?? '—'}
            delta={profile.sidearm ? `${profile.sidearm.rangeMeters}m` : ''}
          />
          <DerivedStat
            label="DR · TORSO"
            value={`${profile.zoneDr.torso_front}/${profile.zoneDr.torso_back}`}
            delta="F/B"
          />
          <DerivedStat
            label="MED"
            value={profile.hasMedkit ? 'YES' : 'NO'}
            delta={profile.hasMedkit ? 'kitted' : '—'}
            positive={profile.hasMedkit}
          />
          <DerivedStat
            label="UTIL"
            value={`${profile.utilityIds.length}`}
            delta="items"
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <NWChip small onClick={onReset} title="Strip the loadout back to empty">
            RESET
          </NWChip>
          <NWChip small title="Copy this loadout to the rest of the squad — coming soon">
            COPY · SQUAD
          </NWChip>
          <NWChip small title="Save this loadout as a reusable template — coming soon">
            SAVE TEMPL
          </NWChip>
          <NWChip
            primary={valid}
            danger={!valid}
            title={valid ? 'Loadout is fit-clean' : 'Resolve errors above'}
          >
            ✓ CONFIRM LOADOUT
          </NWChip>
        </div>
      </div>
    </div>
  );
}

function DerivedStat({
  label,
  value,
  delta,
  negative,
  positive,
  style,
}: {
  label: string;
  value: string;
  delta: string;
  negative?: boolean;
  positive?: boolean;
  style?: CSSProperties;
}): React.JSX.Element {
  return (
    <div style={style}>
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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontFamily: NW.display,
            fontSize: 14,
            color: NW.fg0,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            maxWidth: 130,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value}
        </span>
        <span
          style={{
            fontFamily: NW.mono,
            fontSize: 10,
            color: negative ? NW.magenta : positive ? NW.green : NW.fg2,
          }}
        >
          {delta}
        </span>
      </div>
    </div>
  );
}

// ── shared error formatter (kept inline so this file stands alone) ───────

function formatFitError(e: FitError): string {
  switch (e.kind) {
    case 'zone_slot_overflow':
      return `${e.zone} slot ${e.used}/${e.cap}`;
    case 'zone_kg_overflow':
      return `${e.zone} kg ${e.used.toFixed(1)}/${e.cap}`;
    case 'global_kg_overflow':
      return `total kg ${e.used.toFixed(1)}/${e.cap}`;
    case 'hardpoint_missing':
      return `${e.zone} lacks ${e.hardpoint}`;
    case 'hardpoint_exhausted':
      return `${e.zone} ${e.hardpoint} ${e.used}/${e.avail}`;
    case 'consumable_no_host':
      return `${e.itemId}: no ${e.category} host`;
    case 'internal_slot_overflow':
      return `${e.hostItemId} ${e.category} overflow`;
    case 'armor_zone_occupied':
      return `${e.zone} taken by ${e.occupyingItemId}`;
    case 'ammo_missing':
      return `${e.weaponId} needs ${e.caliber}`;
  }
}

