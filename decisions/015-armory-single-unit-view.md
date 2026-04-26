# ADR 015 — Armory presentation for single-unit view (MechLab paperdoll)

**Status:** superseded by ADR 016 (2026-04-25), pre-implementation
**Date:** 2026-04-23
**Task:** armory screen redesign — user flagged that ADR 002's MWO-tier promise is still surfaced as dropdown selects

> **Supersession note (2026-04-25):** A formal NEON WIRE design
> handoff arrived 2026-04-25, contradicting this ADR's assumed
> column layout, view toggles, and inspector pattern. The 7-zone
> paperdoll, crit-slot capacity model, and "no presets / no
> weapon attachments" decisions in this ADR are **retained** and
> carried forward into ADR 016. Everything else here (column
> percentages, hardpoint kind list, drag-modifier semantics) is
> overridden by ADR 016. No code shipped against this ADR.

## Context

ADR 002 committed to MWO-tier loadout depth (hardpoints, crit slots,
per-location armor) behind a BT-level default surface. The data model
shipped that depth: `SlotFootprint`, `HardpointNeed`, `SlotHardpointKind`,
a per-zone hardpoint map, and error codes like `hardpoint_missing` /
`hardpoint_exhausted` all exist on the schema today. The tooltip strings
in `armory.tsx` explicitly reference "MechLab-style gear footprint."

What never shipped is the surface. The current armory is 60+
`<select>` elements crammed into roughly 1/3 of the screen — a
placeholder built during the data-model sprint that was never replaced.
A player cannot see at a glance which zones are full, which hardpoints
are unused, or whether a piece of gear will fit before trying to equip
it. Every interaction is dropdown → dropdown → "why won't this equip"
error toast.

The user's direct call: **"We had a whole CoA dedicated to establishing
MWO like inventory. We're still doing drop down menus. Literally. Why."**

Current schema state (`src/schema/common.ts`) defines 11 body zones with
mismatched crit counts: head 6, torso_front 10, torso_back 10, left_arm 8,
right_arm 8, left_hand 2, right_hand 2, waist 6, left_leg 6, right_leg 6,
back_mount 8. This does not match MWO canon, does not read clearly on a
paperdoll silhouette, and does not give the backpack the volume it
deserves.

References pulled this session: `SS for design/Mechlab1.jpeg` and
`SS for design/mechlab 2.jpeg` — analyzed by two Haiku subagents at
length, then composed into a single spec by an Opus subagent on
preserved context.

## Decision

Replace the dropdown armory with a **single-unit MechLab paperdoll** as
the default (and, for now, only) surface. BT-level aggregates live in
the stats column alongside, not as a separate mode.

### Zone model — 7 zones, MWO-canonical crit counts

| Zone         | Crit slots | Grid shape |
|--------------|-----------:|-----------:|
| head         |          6 |        3×2 |
| torso        |         12 |        4×3 |
| l_arm        |         12 |        2×6 |
| r_arm        |         12 |        2×6 |
| l_leg        |          6 |        3×2 |
| r_leg        |          6 |        3×2 |
| back_mount   |         24 |        6×4 |
| **Total**    |     **78** |            |

Hands are absorbed into arms. Waist is absorbed into torso. L_torso and
R_torso collapse into a single `back_mount` (24 slots) — the backpack
is where volume and weight actually live, and that should read on the
silhouette as a big dedicated grid, not two symmetric strips. MWO
canonical values are the default everywhere else; `back_mount` is the
single authorized addition.

### Layout — three columns + header + status bar

| Region         | Height / Width |
|----------------|----------------|
| Header         | 6% height      |
| Filters (left) | 12% width      |
| Paperdoll      | 52% width      |
| Warehouse+stats (right) | 36% width |
| Status bar     | 6% height      |

- **Paperdoll column** renders the 7-zone silhouette with per-zone grids
  drawn in their canonical shape. Each cell is either empty or shows the
  2-letter hardpoint-kind chip of the occupying item.
- **FRONT / BACK toggle** sits above the paperdoll. Front view shows
  head / torso / arms / legs. Back view shows `back_mount` as the
  dominant 6×4 grid, plus ghost chips for any back-facing arm / leg
  sub-slots. Ghost chips are clickable — they route focus back to the
  front view with the source zone highlighted.
- **Filters column** is hardpoint-kind filter chips + search.
- **Warehouse column** (top ~60%) is the owned-item list, filtered and
  draggable into zones.
- **Stats column** (bottom ~40%) is the live readout: ENC / CRITS /
  ARMOR / FIREPOWER / OPTICS / AMMO / COMMS / MED, plus a **DERATED**
  sub-block (STAMINA PEN / MOVE SPEED / STEALTH) that shows the
  loadout's movement / noise penalties at a glance.

### Hardpoint kinds — 9 colors, 2-letter abbreviations

| Kind            | Abbrev | Color               |
|-----------------|:------:|---------------------|
| plate_mount     |   PL   | slate #4A7BA8       |
| grip            |   GR   | burnt orange #C97A3A |
| pouch_mount     |   PO   | olive tan #8F8348    |
| comms_mount     |   CM   | teal #2C9A8C         |
| optic_mount     |   OP   | pale cyan #7FC8D8    |
| holster_mount   |   HO   | muted crimson #A8504A |
| pack_anchor     |   PA   | gold ochre #B88A38   |
| large_mount     |   LG   | deep purple #6B4A82  |
| sleeve_mount    |   SL   | sage #7A9068         |

Abbreviations are the colorblind-safe fallback — any cell reads
correctly from shape + letters even without color. Palette is tuned
against an NSiR-industrial neutral background so all nine chips are
distinguishable when adjacent.

### Interaction model

- **Drag-drop** is primary. Dragging an item from the warehouse over a
  zone previews footprint in green (valid) or red-stripe (invalid) with
  a live reason tooltip reading the schema's error code
  (`hardpoint_missing`, `hardpoint_exhausted`, `slot_overflow`, etc.).
- **Shift** during drop = swap with the item currently under the cursor.
- **Alt** during drop = confirm-evict (displaces an item back to the
  warehouse even if it would otherwise block).
- **Right-click** an equipped item = quick-unequip to warehouse.
- Double-click a warehouse item = auto-fit to the first valid zone.

### Consumables — nested slots on equipables (XL-engine pattern)

Consumables occupy crit slots **inside** an equipped item, the same way
an MWO XL engine eats slots across multiple zones. Canonical hosts:
torso rig, waist belt (on torso), back_mount items, and leg pouches.
The equipable's crit footprint is what sits on the paperdoll; its
nested consumable slots are a sub-grid rendered when the item is
focused. This keeps the top-level paperdoll uncluttered.

### Armor — designated by equipped armor items

Per-zone armor values are **not** freely assignable. Each zone exposes
an armor value that is a pure readout of whichever armor item is
equipped covering that zone. Ditching the free-assignment slider
eliminates the whole "spend 1 ton of armor, where?" UI path and keeps
the paperdoll readable: zone color tint reflects armor coverage
automatically.

### Scope — owned-only, single unit, MVP-tight

- **Owned-only warehouse.** The armory shows items the player owns.
  Unowned / shop browsing is a separate screen (out of scope here).
- **Single unit view.** One operator at a time. No split-pane
  comparison.
- **No handedness.** L/R symmetry is visual only; the schema does not
  model dominant hand.
- **No quick-load presets.** Deferred — UX polish, not MVP.

## Consequences

**Positive:**
- ADR 002's "MWO depth underneath" promise finally reads on the surface.
  A player can see at a glance which hardpoints are free, which zones
  are full, and why a piece won't fit.
- Paperdoll + warehouse + stats on one screen is the MWO composition
  that already works; we are not inventing UX, we are adopting it.
- 7 zones / 78 crits reads cleaner than 11 zones with mismatched counts
  and gives `back_mount` the volume to represent pack load.
- Dropping free-assignable per-zone armor removes a whole class of
  "where do I spend my tonnage" tooltips.

**Negative:**
- Schema migration: 11 zones → 7. Content JSON for every existing
  item needs its zone references remapped. Fixtures and tests that
  assert zone geometry need a migration pass.
- `armory.tsx` is a full rewrite, not an incremental edit. The 845-line
  dropdown surface gets deleted.
- Per-zone grid rendering (3×2, 4×3, 2×6, 6×4) needs a layout primitive
  the project does not yet have. Reusable grid cell component + drag
  layer are new code.
- Front/back view doubles the paperdoll render path. Ghost-chip
  routing adds a focus-target handoff that the test harness has to
  cover.

**Cascades into:**
- `src/schema/common.ts` — body zones, `ZONE_SLOT_CAPACITY`,
  `DEFAULT_BODY_HARDPOINTS`.
- Content packs — every `item.zone` reference.
- `src/renderer/src/screens/armory.tsx` — full rewrite.
- Tooltip / error-code surface (already MWO-flavored) — can drop
  dropdown-specific copy.

**Deferred (explicit out of scope):**
- Quick-load presets ("save build / load build") — UX feature, not MVP.
- Multi-operator comparison — "it'll be cramped as is."
- Unowned item browse / purchase flow from the armory.
- Handedness (dominant hand, per-hand stats).
- Automatic back-view for items that would otherwise clip on the
  front silhouette (for now, back items show as back-view-only plus
  ghost chip on front).

## Migration plan

1. Schema: rewrite `BodyZone` enum to the 7-zone set, update
   `ZONE_SLOT_CAPACITY` to {6,12,12,12,6,6,24}, remap
   `DEFAULT_BODY_HARDPOINTS` onto the new zones.
2. Content migration script: map old zone → new zone for every item in
   content packs. Fail loudly on items that relied on a dropped zone
   so authors can reassign.
3. Test fixtures: regenerate any test that hardcoded old zone names.
4. Renderer: introduce `Paperdoll`, `ZoneGrid`, `HardpointChip`,
   `WarehouseList`, `StatsReadout`, `DeratedSubBlock` components in
   `src/renderer/src/armory/`. Rewrite `armory.tsx` as the composition
   shell (header, filters, paperdoll, warehouse+stats, status bar).
5. Drag layer: single drag-drop primitive with preview state, used by
   both warehouse→zone and zone→zone moves.
6. Remove dropdown armory and its associated select-based state.

## References

- ADR 002 — customization depth (this is the surface ADR 002 promised)
- ADR 011 — firefight tier gap closers (loadout depth as a competitive
  differentiator)
- `SS for design/Mechlab1.jpeg`, `SS for design/mechlab 2.jpeg` —
  composition references
- `src/schema/common.ts` — current body-zone schema
- `src/renderer/src/screens/armory.tsx` — placeholder surface being
  replaced
