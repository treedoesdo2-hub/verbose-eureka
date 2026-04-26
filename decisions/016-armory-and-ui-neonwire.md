# ADR 016 — Armory and UI presentation per NEON WIRE design handoff

**Status:** draft (in clarification)
**Date:** 2026-04-25
**Supersedes:** ADR 015 (armory single-unit view) — pre-implementation
**Task:** Claude Design delivered the PAYROLL / NEON WIRE handoff
on 2026-04-25, contradicting ADR 015's body-zone count, capacity
primitive, hardpoint conception, view toggles, and column layout.

## Context

ADR 015 was authored against a low-fidelity reverse-engineering of
MWO MechLab screenshots. On 2026-04-25 a proper UI handoff arrived:
9-screen system, NEON WIRE design language, PAYROLL branding, full
typographic and color spec, working primitives. The handoff is
authoritative; ADR 015 is stale on multiple structural axes.

This ADR captures the resolved questions in clarify-methodology order
(one decision at a time), and replaces ADR 015 as the standing record
for the armory presentation. As scope-relevant decisions land for
non-armory screens (S1, S2, S4–S9), they are recorded here too rather
than spawning per-screen ADRs — the design system is one cohesive
piece.

**Reference material:**
`SS for design/Claude Design Package/design_handoff_payroll_pmc_console/`
- `README.md` (visual spec, 9 screens, design tokens)
- `source/BRAND.md` (voice, tone, non-negotiables)
- `source/primitives.jsx` (NW component vocabulary)
- `source/s3-armory.jsx` (canonical armory source)
- `screenshots/03-armory.png` (rendered armory)

## Clarify log

Questions are answered one at a time. Each row is durable: the option
chosen, the reason given, and any conditions attached.

### Q0 — Currency sign

**Resolved:** `¥` (yen).

**Reason:** OG cyberpunk feel; less generic than `cr` (credits) or
`$` (dollars). Matches the README's existing placeholder copy
(`¥ 2,418,040`, `¥1.8M`, `¥42K munitions`).

**How to apply:** All currency renders as `¥` + comma-separated
integer. No decimal places on display unless context demands cents
(escrow / per-second burn). BRAND.md's `$ or cr` line is overridden
here.

---

### Q1 — Adoption scope

**Resolved:** Option B (phased, core loop first), with S2/S8 collapsed
and S9 deferred.

**Reason:** MVP is mapgen + unit AI nail-down. Design rewrites land
after MVP; full game-wide aesthetic is the target but the strategic
layer (S9) isn't an MVP feature. S2 and S8 are the same combat view
at different camera scope (squad-selected zoomed-in vs.
no-selection battalion-zoom) — one screen, two states.

**How to apply:**
- **In scope (NEON WIRE rewrite):** S1 Main Menu, S2 Combat
  (unified — squad-selected and battalion-zoom states on the same
  view), S3 Armory, S4 Contracts, S5 Briefing, S6 Debrief, S7 ORBAT.
- **S7 specifics:** mostly skinning over existing roster data plus
  a small schema lift — `Company` and `Battalion` grouping tiers
  above squad, branch taxonomy enum (INF / REC / CMD / MEC / ARM
  / ART / SPT / MED / ENG / SIG), authorized-vs-present strength
  per unit. Demo-scale rosters render as shallow battalions.
- **Deferred (post-MVP epic):** S9 Theater Map — implies new
  domain modeling (theater geography with named zones, faction
  influence percentages, supply corridor graph, concurrent ops,
  intel feed). Not MVP.
- **S1 ↔ S9 collapse:** S1's main-menu holo-map and S9's theater
  map are likely the same view at different zoom (city-scale vs
  theater-scale), parallel to the S2/S8 collapse. Build S1 in a
  way that won't fight an eventual S9 zoom-out.

### Q2 — Body zone count

**Resolved:** Two paperdolls, not one.

- **Armory (S3):** 7 zones — head, torso, l_arm, r_arm, l_leg,
  r_leg, back_mount. ADR 015's model holds.
- **Combat HUD (S2, on hover):** 14 zones from the design's
  `NWA_KIT` (head, neck, chest, abd, l/r shoulder, l/r arm, l/r
  hand, l/r leg, l/r foot) — used to visualize wounds and hit
  state when the player hovers an operator on the tactical map.

**Reason:** Anatomical specificity is right for wound visualization
(a 7.62 round hits abdomen vs. l-shoulder, not "torso"); tighter
zoning is right for gear management because crit slots — not
anatomy — gate loadout depth. The design's paperdoll is the medical
chart; ADR 015's paperdoll is the inventory grid.

**How to apply:**
- Don't unify the two paperdolls. Different schemas, different
  surfaces, different purposes.
- Combat HUD reuses the design's 14-polygon SVG geometry directly
  for wound rendering.
- Armory uses the 7-zone grid layout from ADR 015 (per-zone grid
  shapes 3×2 / 4×3 / 2×6 / 3×2 / 6×4 = 78 crit slots total).
- Wound state on the 14-zone surface maps onto the 7-zone armory
  via a zone-rollup table (e.g. `lsh + larm + lhand → l_arm`) when
  systems need to cross-reference.

---

### Q3 — Capacity primitive (KG vs crit slots)

**Resolved:** Crit slots per zone (armory); aggregate KG (combat
load).

**Reason:** Per-limb KG conflates "what fits where" with "what's
the operator carrying overall." Crit slots already separate those:
each zone has a fixed crit count (6/12/12/12/6/6/24 = 78), each
item has a crit footprint, and total weight aggregates as the
combat-load meter at the top of the armory.

**How to apply:**
- Per-zone capacity = crit count (ADR 015, unchanged).
- Top-bar combat-load meter sums weight across all equipped items,
  segmented ARMOR / WEAPON / ORDNC / MED·CMM (design pattern).
- Inspector copy reads `SLOTS · X / Y USED` (not `CAPACITY · KG`).
- Item weight remains a per-item attribute that feeds the
  aggregate but does not gate per-zone fit.

### Q4 — Weapon-internal attachment slots

**Resolved:** No. Deferred indefinitely.

**Reason:** Bloat for current scope. Optics / muzzle / grip / rail
attachments are gunsmithing depth that competes for design and
content-authoring time against MVP priorities (mapgen, AI). Weapons
remain atomic items with built-in stats.

**How to apply:**
- Weapon schema does not gain an `attachmentSlots` field.
- Stockpile categories from the design (OPTICS · MUZZLE ·
  GRIPS·RAILS) are **filter chips only** — they categorize items
  in the warehouse list. They do not imply weapon sub-slots.
- Treat OPTICS / MUZZLE / GRIPS·RAILS as item categories that
  body-slot like everything else (most likely never used in
  current content, but the schema accepts them).
- Revisit if and when weapon depth becomes a requested feature.

### Q5 — Role templates / presets — defer or ship?

**Resolved:** Defer (prior decision stands).

**Reason:** Re-confirms the prior session's call. Presets are a UX
layer that pays off at scale (many operators across many squads);
at MVP scale the player builds one loadout per operator and lives
with it. Persistence + save/load flow is not MVP-shaped work.

**How to apply:**
- Top-bar role chip strip (URBAN·AR / DMR·OW / BREACH / CQB·HVY
  / CSTM·03) — not implemented. Reclaim the top-bar real estate
  for richer combat-load + attribute display.
- Bottom-bar `SAVE TEMPL` and `COPY · SQUAD` chips — not
  implemented. Reclaim for tighter delta stats.
- Revisit when meta-progression depth requires bulk-loadout
  management.

---

### Q6 — Implementation timing

**Resolved:** Option C — design rewrites run concurrent with
mapgen + AI. No parking.

**Reason:** The work has to happen eventually; deferring doesn't
save effort, it just shifts it. No human or machine cost to
pursuing in parallel.

**How to apply:**
- Tasks #280, #281, #282, #283, #284 remain live.
- New tasks for S7 ORBAT, per-screen rewrites, S2/S8 unified
  combat get spawned and scheduled normally.
- No `blockedBy` chain on mapgen / AI completion. Concurrent
  epics, prioritized by context-availability rather than gating.

---

### Q7 — Combat HUD wound paperdoll: where does it live?

**Resolved by source spec** (`s2-combat.jsx:82-107`, `NWPaperdoll`
lines 202-240). Not a clarify question — the design specifies it.

**Spec:** Selected-operator card at bottom-left of S2 (400px wide,
hex-clipped TL-BR, cyan border — the one allowed glow on the
combat HUD). Composition: 14-zone paperdoll + callsign + identity
line + HP/STAM/SUPP/MORALE mini-bars + WEAP/SIDE/NAD/STANCE
quick-stats. Trigger: selection (not hover). Zones colored by HP
(cyan ≥80%, amber 40–79%, magenta <40%); selected zone gets
emphasis stroke and a side callout (`CHEST 85%`); damage markers
(filled circle + dashed ring, tone-colored) plot on zones where
recent hits landed.

**How to apply:**
- Ship the 14-zone paperdoll component in S2's selected-operator
  card per the source spec.
- Reuse the same SVG geometry between S2 (HP coloring) and the
  armory zone inspector (DR coloring).
- No floating hover variant — selection only.

---

### Q8 — Combat-load segmentation

**Resolved:** Single bar, no segmentation.

**Reason:** Per-category weight breakdown (ARMOR / WEAPON / ORDNC
/ MED·CMM) is information density we don't need. What the player
cares about is: am I overloaded, and is that costing me. A single
bar with penalty-threshold marks does that job.

**How to apply:**
- One combat-load bar showing `current KG / max KG` with %.
- Threshold marks where movement / stamina penalties kick in;
  bar segments past those thresholds tint amber / magenta to
  signal the penalty band.
- No `itemCategory` enum on the schema.
- No `utilityKind` discriminator on `utility.ts`.
- Top-bar layout reclaimed from the 4-segment meter design —
  use the freed space for the bar's threshold readouts and any
  derived penalties (STAM −X% / MOVE −Y%).

---

### Q9 — Top-bar attribute readout: what 5 stats, and how labeled?

**Resolved:** Option B — direct 1:1 map to our 5 schema stats with
3-letter abbreviations: `AIM / MOV / GRT / AWR / MED`. Values are
the operator's base `Operator.stats` ints (0-100).

**Reason:** Cheapest path, lines up with the existing schema with
no formula work. The 3-letter form trades the design's 2-letter
aesthetic for readability. Acknowledged placeholder — likely
refined later as the sim grows derived metrics worth surfacing.

**How to apply:**
- Show `AIM xx  MOV xx  GRT xx  AWR xx  MED xx` on the operator
  row in the armory top bar.
- Read directly from `Operator.stats` — no derivation pipeline.
- Penalty deltas (STAM / MOVE %) continue to show alongside as
  the loadout-affected readout.

---

### Q10 — Zone resistances: 4 metrics or 1?

**Resolved:** Option B — match the design's 4 metrics. FIRE and
EMP remain 0 in content until sim grows those damage types.

**Reason:** Maximalist schema scope when bounded — adding the
fields now means future fire / EMP damage types slot in without
schema migration; content authoring just stays at 0 for unused
metrics. Matches the design 1:1 on the inspector.

**How to apply:**
- Expand `ArmorPlacement` (`src/schema/armor.ts`) with three new
  optional fields: `penetrationResistance`, `fireResistance`,
  `empResistance`, all `z.number().min(0).max(100).default(0)`.
- Existing `damageReduction` field stays as-is and renders as
  `DMG RES`.
- Content migration: each armor item gains the three new values.
  Existing items default to 0; refit any that should carry
  meaningful PEN RES (most plate armor) per author judgment.
- Inspector renders four bars per zone, summed across equipped
  armor pieces in that zone.
- Sim today only consumes `damageReduction`. PEN RES feeds an
  eventual armor-penetration formula (future); FIRE / EMP feed
  eventual damage-type expansion (future). All three are inert
  in sim until those workstreams pick them up.

---

### Q11 — Per-zone damage log (repurposed: persistent injury record)

**Resolved:** Implement the inspector section, but tweak the
content from a hit-by-hit log to a **persistent injury / damage
state record**. Display surface stays per-zone; data is curated.

**Reason:** A raw hit log is noisy and not what the player needs
to remember. What matters is: this operator has a partly-healed
gunshot to the left arm; this vehicle has a derate from a
transmission hit at OP-YARD. Lasting consequences, attributed
to their mission of origin. The design's per-zone format is
right; the *what* it logs is too granular as drawn.

**How to apply:**
- New schema `MedicalCondition` (`src/schema/operator.ts` or new
  `medical.ts`): `{ zone, missionId, kind, description,
  ongoingPenalty? }`. `kind` is an enum starting with kinetic
  injury kinds (gunshot-healed, fragment-residual, fracture,
  etc.) — extensible.
- `Operator` schema gains `medicalConditions: MedicalCondition[]`.
- End-of-mission hook translates select sim events into persisted
  conditions — only consequential injuries (a survived wound that
  doesn't bleed out, a broken bone, etc.). Trivial / cosmetic
  hits don't make the cut. Rule lives in the mission-debrief
  pipeline, not the per-tick sim.
- Inspector section relabeled `MEDICAL HISTORY` (operator
  context). Each row: mission code · injury kind · current state
  (`HEALED` / `RESIDUAL` / `ONGOING`).
- Vehicles later: same data shape with
  `MechanicalCondition` (engine derate / comms damaged / armor
  degraded). Same inspector pattern reused. Out of scope until
  vehicles land in the schema.

---

### Q12 — S2/S8 unification: implementation mechanic

**Resolved:** S8 is the authoritative base for the combat view.
S2's UI elements (selected-operator card with paperdoll, squad
roster strip, orders panel) are **selection-additive overlays**
— they appear when a squad is selected and disappear when
deselected. Zoom already exists; no new zoom-state mechanic.

**Reason:** No need to invent a two-state branching system or
zoom-snap mechanic — the engine has zoom, and the design's two
"screens" are the same view with conditional chrome.

**How to apply:**
- Combat view defaults to S8's chrome: op cards (left), comms
  log + decision queue (right), banner / footer.
- On `selectedSquadId !== null`, mount the S2-specific elements
  on top: selected-operator card (bottom-left), squad roster
  strip (bottom-center), orders panel (bottom-right).
- On deselection, those overlays unmount; S8 chrome remains.
- Zoom is independent — player can zoom in or out at any
  selection state. The chrome is selection-driven, not
  zoom-driven.

---

### Q13 — BRAND.md voice rules: adopt wholesale or carve out?

**Resolved:** Option B — adopt BRAND.md for UI / chrome only;
narrative content (radio chatter, speech toasts, briefings,
comms callouts) is authored free.

**Reason:** Cold-corporate register fits the company's internal
tool but does not fit the operators *using* it. In-game radio
chatter and head-of-unit speech toasts will be authored to feel
like real people under stress — operators swear, joke, panic,
flatten. The console software remains in BRAND.md voice; the
people speaking *through* it do not.

**How to apply:**
- **In BRAND.md voice:** panel titles, status strings, button
  labels, error toasts, system bar, debrief headers, contract
  codes / category labels, outcome language (`MISSION COMPLETE`
  / `CONTRACT FORFEIT` / `ASSET COMPROMISED`), timestamps (24h),
  callsigns (in double quotes), vocabulary ("operators", not
  "mercs"; "elements" in briefing context).
- **Free-form authored:** radio chatter (live combat callouts),
  speech toasts over operator heads, briefing prose body copy,
  intel ticker entries (where they're flavor / world-building),
  any in-character voice line.
- The boundary is consoles vs. characters: anything the company's
  software *displays* uses BRAND.md; anything a person *says*
  doesn't have to.

---

### Q14 — Supplemental clarifications (bulk, 2026-04-25)

A second round of follow-ups was bulk-answered rather than walked
through speckit-style. Recorded here for traceability. Sub-points
amend the Decision section above where applicable.

**a. Medical conditions — UI only, no persistence** (revises Q11):
The `MedicalCondition` schema, `Operator.medicalConditions[]`,
end-of-mission translation hook, and ongoing-penalty model are
**all deferred**. The inspector still renders a "MEDICAL HISTORY"
section, but it's a UI stub — no live data behind it for MVP.
`kind` enum, when implemented, starts with `gunshot-healed` only.
Future work: tie into a healing / cybernetic-surgery company-
management feature.

**b. Combat-load thresholds — UI only, 20% increments**: The
single combat-load bar shows penalty-threshold marks at every
20% (20/40/60/80/100). No sim coupling — the bar visually
indicates the band, but no STAM / MOVE penalty is actually
applied to the operator until the mechanic is implemented.

**c. Single armor piece per zone** (revises Q10): An `Armor`
item can declare placements across multiple zones (current
schema unchanged), but **no two armor items occupy the same
zone simultaneously**. Inspector zone-resistance display reads
from the single armor piece covering that zone — no rollup
formula. The design's "5 items in chest" pattern is overridden;
non-armor items (pouches, mags, holstered sidearm) can still
share the zone via crit slots, but armor specifically is 1:1.

**d. Stockpile categories simplified to 3**: Weapon / Armor /
Utility. The design's 9 categories collapse onto our existing
schema buckets. Filter chips in the stockpile column read the
3 buckets, not the 9.

**e. FRONT/REAR only**: SIDE view dropped from infantry
paperdoll. SIDE may return for vehicles later when chassis
zones (left flank / right flank) become relevant — out of MVP
scope.

**f. No RTS-style order keybinds**: Q/W/E/R/T/Y/U/I from the
design's S2 orders panel (`MOVE / HOLD / ADVANCE / FALL BACK
/ SUPPRESS / FRAG / SMOKE / HEAL`) is rejected — this is an
autobattler, not an RTS. The orders panel itself is not
shipped. Decision queue (S8 right-side) may persist as a
strategic-layer affordance — kept open for now, stubbed
either way.

**g. Drone overwatch — chrome only**: The DRONE·01 OVERWATCH
panel ships visually but is non-mechanical. Altitude / fuel /
IR / playback values are placeholder. Drone as a real mechanic
is deferred.

**h. Comms log + decision queue — stubbed**: S8's right column
ships visually with placeholder transmissions and decision
cards. No real sim infra (transmissions schema, decision-cost
model, approve / deny / defer wiring). Stub now, build later.

**i. AAR regional map — faux ops-brief from squad snapshots**:
S6's debrief map shows the contract's local map zoomed out,
overlaid with **squad position snapshots** at start + every
quarter of sim runtime (T0, T0.25, T0.5, T0.75, T1.0). Reads
like a real military operations summary — friendly axes of
advance, contact zones, exfil. Mechanic needs design — open
follow-up question.

**j. Web fonts via CDN**: Google Fonts CDN is fine if no
commercial license issue. Bundling locally is fallback.

**k. Resolution scaling**: Open — needs recommendation.

**l. Animation discipline**: Open — needs elaboration.

## Decision

Adopt the **PAYROLL / NEON WIRE** design system across the core
loop. ADR 015 is superseded for the armory; non-armory screens
inherit the NEON WIRE design language as defined here and in the
handoff source.

### Adoption surface
- **In scope (NEON WIRE rewrite):** S1 Main Menu, S2 Combat (S8 as
  base, S2 as selection-additive overlays — one screen), S3
  Armory, S4 Contracts, S5 Briefing, S6 Debrief, S7 ORBAT.
- **Deferred (post-MVP epic):** S9 Theater Map (implies new domain
  modeling: theater geography, faction influence, supply graph,
  concurrent ops, intel feed). S1's main-menu holo-map is built
  with foresight that an eventual S9 zoom-out reuses its
  geometry.
- **Concurrent with mapgen + AI work** — design rewrites are not
  gated on MVP completion. Tasks proceed by context-availability.

### Branding
- Working title **PAYROLL** ("A Private Military Sim", tagline
  *"You run the company. The company runs the war."*). Codebase
  / package name remains `merc-autobattler` to avoid build churn.
- Currency: **¥** (yen) with comma-separated integers; `$` / `cr`
  references in BRAND.md and README placeholder copy are
  overridden.
- Voice rules: BRAND.md applies to chrome (UI surfaces, panel
  titles, buttons, status, error toasts, debrief copy, contract
  codes / category labels, timestamps, callsigns). Narrative
  content — radio chatter, speech toasts, briefing prose, intel
  flavor — is authored free.

### Design system foundation
- Color tokens, type stack (Chakra Petch / IBM Plex Sans / IBM
  Plex Mono), hex-clip polygons (`HEX_CLIP_TL_BR` /
  `HEX_CLIP_TR_BL`), and primitives (`NWFrame`, `NWSystemBar`,
  `NWPanel`, `NWChip`, `NWCTA`, `NWStat`, `NWBar`, `NWHexIcon`,
  `NWDiamond`) are ported per `source/primitives.jsx`.
- Background grid + radial vignette under every screen.
- Mono fonts always use `font-variant-numeric: tabular-nums`.
- Iconography is monochrome line-SVG only; no emoji; semantic
  glyph vocabulary limited to `◆ ◢ ▸ ● ▪▫ ━┅╳`.

### Armory (S3) — the substantive ADR 015 supersession
- **Two paperdolls, two surfaces:**
  - **Armory paperdoll (S3):** ADR 015's 7-zone model retained —
    head, torso, l_arm, r_arm, l_leg, r_leg, back_mount. Per-zone
    grid shapes 3×2 / 4×3 / 2×6 / 3×2 / 6×4 = 78 crit slots
    total. Items have crit footprints; per-zone capacity is crit
    count, not KG. **FRONT / REAR views only** — SIDE view
    deferred (Q14e).
  - **Combat HUD paperdoll (S2):** the design's 14-zone
    `NWA_KIT` (head, neck, chest, abd, l/r shoulder, l/r arm,
    l/r hand, l/r leg, l/r foot) — used for HP / wound state
    on the selected-operator card. SVG geometry shared between
    surfaces; semantics differ (DR display vs HP color).
- **Layout:** STOCKPILE 320px | PAPERDOLL 1fr | INSPECTOR 360px,
  with 88px top bar (operator card + single-bar combat-load
  meter + AIM/MOV/GRT/AWR/MED readout + STAM/MOVE penalty
  deltas) and 70px bottom bar (delta stats + CONFIRM LOADOUT).
  Top-bar role-template strip and bottom-bar SAVE TEMPL /
  COPY · SQUAD chips dropped (Q5).
- **Combat-load meter:** single bar `current KG / max KG · %`
  with **20% increment threshold marks** (Q14b) — UI-only
  visual; no sim coupling until penalty mechanic ships.
- **No weapon-internal attachment slots** (Q4). OPTICS / MUZZLE
  / GRIPS·RAILS in the design's stockpile collapse into the
  3-category model (Q14d).
- **Stockpile categories: Weapon / Armor / Utility** (Q14d).
  Maps 1:1 to existing schema buckets (`weapon.ts`, `armor.ts`,
  `utility.ts`); the design's 9-category list is overridden.
- **No presets / templates / save / load / copy-to-squad** (Q5).
- **One armor item per zone** (Q14c). An `Armor` item can
  declare placements across multiple zones (e.g. plate carrier
  covers chest + abdomen), but no two armor items can occupy
  the same zone. Non-armor items (pouches / mags / holstered
  sidearm) can still share the zone via crit slots.
- **Inspector** shows: (1) the single armor piece covering the
  selected zone (or empty), (2) any non-armor items in that
  zone's crit grid, (3) zone resistance values read directly
  from that armor piece (no rollup formula — Q14c), and
  (4) the **MEDICAL HISTORY section as a UI stub** (Q14a) —
  no persistence, no live data, just the visual section.

### Schema additions
- **`ArmorPlacement` (`src/schema/armor.ts`):** add
  `penetrationResistance`, `fireResistance`, `empResistance` —
  all `z.number().min(0).max(100).default(0)`. Existing
  `damageReduction` continues to render as `DMG RES`.
- **Armor placement validation:** at equip time, reject
  placements that would overlap an already-equipped armor
  item's zones (Q14c). One armor item per zone.
- **S7 grouping schema:** `Company` and `Battalion` tiers above
  squad; `branch` enum on units (`INF / REC / CMD / MEC / ARM
  / ART / SPT / MED / ENG / SIG`); authorized vs present
  strength fields. Demo-scale rosters render as shallow
  battalions.

**Deferred from this ADR's schema additions** (see DEFERRED.md):
- `MedicalCondition` schema, `Operator.medicalConditions[]`,
  end-of-mission injury translation hook, ongoing-penalty
  model (Q14a).
- Combat-load → STAM / MOVE sim coupling (Q14b).

### Combat view (S2/S8 unified)
- S8's chrome is the base render: op cards (left), comms log +
  decision queue (right) — **comms log and decision queue
  ship as visual stubs only** (Q14h), no sim infra. Banner /
  footer per design.
- On `selectedSquadId !== null`, mount S2 overlays on top:
  selected-operator card with 14-zone paperdoll (bottom-left),
  squad roster strip (bottom-center).
- **Orders panel dropped** — no Q/W/E/R/T/Y/U/I keybinds, no
  RTS-style commands (Q14f). This is an autobattler.
- **Drone overwatch panel ships as chrome only** (Q14g) — no
  drone mechanic, no real altitude / fuel / IR / playback
  values.
- Zoom remains independent — chrome is selection-driven, not
  zoom-driven.

## Consequences

**Positive:**
- ADR 002's "MWO depth underneath" promise reads on the surface
  for the first time — paperdoll, crit slots, multi-item zones,
  delta previews, all present.
- One coherent design language across the screens the player
  actually opens every session.
- Schema additions (zone resistances, medical conditions, S7
  grouping tier) buy real depth without new domain modeling.
- The S8-base + S2-overlay model collapses two screens into one
  state-driven view, cutting half the would-be screen count.

**Negative:**
- Foundation work (NEON WIRE primitives, web-font loading, hex-clip
  polygon utilities) is sunk before any screen pays it back.
- Schema migrations: armor content gains 3 new fields per
  placement; operators gain `medicalConditions[]`. Existing test
  fixtures and content packs need a migration pass.
- S7 introduces a grouping tier that doesn't yet exist; demo
  roster code that assumes "operator → squad → world" gains a
  middle layer.
- Per-screen rewrites are 6 screens of UI work, not 1 — paced
  alongside mapgen + AI rather than blocking on either.

**Cascades into:**
- `src/schema/armor.ts` — three new fields.
- `src/schema/operator.ts` — `medicalConditions[]` array.
- `src/schema/medical.ts` (new) — `MedicalCondition` shape.
- `src/schema/squad.ts` and adjacent — company / battalion tier
  + branch enum.
- `src/renderer/src/` — full restructuring under a NEON WIRE
  primitives layer; per-screen rewrites for S1 / S2 / S3 / S4 /
  S5 / S6 / S7.
- `electron/main.ts` (or equivalent) — window title rebrand,
  font asset loading.
- ADR 015 — superseded.

## Migration plan

**Phase 0 — foundation (concurrent with mapgen/AI):**
1. Port NEON WIRE tokens + primitives + system bar (#283).
2. Wire web-font loading (Chakra Petch / IBM Plex Sans / IBM
   Plex Mono).
3. Rebrand window / logos / titles to PAYROLL (#284).

**Phase 1 — schema groundwork:**
4. Expand `ArmorPlacement` with `penetrationResistance`,
   `fireResistance`, `empResistance`.
5. Add armor placement-overlap validation (one armor item per
   zone, Q14c).
6. Author `Company` + `Battalion` schema, branch enum,
   authorized-vs-present strength.
7. Content migration pass — every armor item gains the three
   resistance fields (default 0).

**Phase 2 — armory rewrite (S3):**
8. Land #281 (ammo as inventory item) into the new schema.
9. Rewrite `armory.tsx` per the layout above. Delete the
   dropdown surface.
10. MEDICAL HISTORY section ships as UI stub only (Q14a) —
    no persistence work yet.

**Phase 3 — core loop screens, in approximate priority:**
11. S2/S8 unified combat view (S8 base + S2 selection overlays);
    drone panel and comms log / decision queue ship as visual
    stubs (Q14g, Q14h).
12. S1 Main Menu (HQ dashboard, leaving headroom for S9 zoom-out).
13. S4 Contracts.
14. S5 Briefing.
15. S6 Debrief — including the AAR squad-snapshot mechanic
    (Q14i, design open).
16. S7 ORBAT.

**Deferred** (see `decisions/DEFERRED.md` for the full register):
- S9 Theater Map (epic).
- Weapon-internal attachment slots.
- Loadout presets / save / load / copy-to-squad.
- `MedicalCondition` schema + persistence + end-of-mission
  translation + ongoing-penalty model.
- Combat-load → STAM / MOVE sim coupling.
- Drone overwatch as a real mechanic.
- Comms transmissions schema + sim infra.
- Decision queue real wiring.
- SIDE paperdoll view.
- RTS-style order keybinds and orders panel.
- Vehicle `MechanicalCondition` (out of scope until vehicles).
- Per-zone resistance rollup formula (moot under Q14c).
