# Deferral log

Central register of features and decisions explicitly deferred
across all ADRs. When a deferred topic comes up in conversation
or backlog grooming, **check here first** — the entry will tell
you which ADR locked the deferral, why, and what trigger should
make us reopen it.

Format per entry:
- **Source:** ADR + section / Q reference
- **Date deferred:** YYYY-MM-DD
- **Reason:** one-line rationale
- **Revisit when:** the trigger condition that should re-open it

When a deferral is implemented, dropped, or otherwise resolved,
move its entry to the **Resolved** section at the bottom with a
short note + date.

---

## Active deferrals

### S9 Theater Map (strategic layer)
- **Source:** ADR 016 § Q1
- **Date deferred:** 2026-04-25
- **Reason:** Implies new domain modeling (theater geography,
  faction influence, supply graph, concurrent ops, intel feed)
  that doesn't exist in the schema; not MVP.
- **Revisit when:** MVP (mapgen + AI nail-down) is shipped and
  the strategic-layer epic is the next focus. S1's holo-map
  was built with foresight that an eventual S9 reuses its
  geometry at theater scale.

### Weapon-internal attachment slots (optic / muzzle / grip / rail)
- **Source:** ADR 016 § Q4
- **Date deferred:** 2026-04-25
- **Reason:** Bloat for current scope; gunsmithing depth
  competes with mapgen + AI MVP priorities. Weapons remain
  atomic items.
- **Revisit when:** Weapon depth is a requested feature or
  active workstream.

### Loadout presets / templates / save / load / copy-to-squad
- **Source:** ADR 016 § Q5
- **Date deferred:** 2026-04-25
- **Reason:** UX layer that pays off at scale (many operators
  across many squads); MVP scale doesn't need it.
- **Revisit when:** Meta-progression depth requires bulk
  loadout management.

### `MedicalCondition` schema + `Operator.medicalConditions[]` persistence
- **Source:** ADR 016 § Q11 + Q14a
- **Date deferred:** 2026-04-25 (walked back from Q11's
  initial implementation plan)
- **Reason:** Operator state persistence is non-MVP. Inspector
  ships a UI stub for the MEDICAL HISTORY section without live
  data.
- **Revisit when:** Healing / cybernetic-surgery as a
  company-management feature is on the roadmap. Will tie back
  into S6 debrief end-of-mission translation hook at that
  point.

### End-of-mission injury translation hook
- **Source:** ADR 016 § Q14a
- **Date deferred:** 2026-04-25
- **Reason:** Depends on `MedicalCondition` persistence, which
  is itself deferred.
- **Revisit when:** `MedicalCondition` persistence is being
  implemented.

### Healing / cybernetic surgery (company-management feature)
- **Source:** ADR 016 § Q14a (mentioned)
- **Date deferred:** 2026-04-25
- **Reason:** Future depth feature; depends on medical
  condition persistence + a company-management screen surface
  to host the mechanic.
- **Revisit when:** Operator long-term-state features become
  the active workstream.

### Combat-load → STAM / MOVE sim coupling
- **Source:** ADR 016 § Q14b
- **Date deferred:** 2026-04-25
- **Reason:** Combat-load bar ships as UI-only visual with 20%
  threshold marks; no actual stamina or movement penalty is
  applied until the mechanic is built.
- **Revisit when:** Operator-encumbrance mechanics are on the
  active workstream.

### SIDE paperdoll view (chassis flank zones)
- **Source:** ADR 016 § Q14e
- **Date deferred:** 2026-04-25
- **Reason:** Infantry has no useful "side" zones beyond what
  FRONT and REAR cover. SIDE may return for vehicles with
  chassis flank armor.
- **Revisit when:** Vehicles enter the schema and chassis-zone
  armor matters.

### RTS-style order keybinds + orders panel (Q/W/E/R/T/Y/U/I)
- **Source:** ADR 016 § Q14f
- **Date deferred:** 2026-04-25 (effectively dropped — wrong
  genre)
- **Reason:** This is an autobattler. The design's S2 orders
  panel was an RTS-shaped affordance that doesn't fit our
  control model.
- **Revisit when:** Never, unless the genre fundamentally
  changes. Decision queue (S8 right-side) may persist as a
  strategic-layer affordance — see entry below.

### Drone overwatch as a real mechanic
- **Source:** ADR 016 § Q14g
- **Date deferred:** 2026-04-25
- **Reason:** S2's DRONE·01 OVERWATCH panel ships as chrome
  only — no real drone mechanic, altitude / fuel / IR /
  playback are placeholder values.
- **Revisit when:** Drone (or other recon asset) becomes a
  real gameplay system.

### Comms transmissions schema + sim infra
- **Source:** ADR 016 § Q14h
- **Date deferred:** 2026-04-25
- **Reason:** S8's comms log ships as visual stub — placeholder
  transmissions, no real schema, no live event source.
- **Revisit when:** Diegetic in-mission comms become real
  gameplay (e.g., ROE callouts, MEDEVAC requests).

### Decision queue real wiring
- **Source:** ADR 016 § Q14h
- **Date deferred:** 2026-04-25
- **Reason:** S8's decision queue ships as visual stub —
  approve / deny / defer chips don't actually do anything.
  Kept open as a possible strategic-layer affordance.
- **Revisit when:** Battalion-command decision flow becomes
  real (likely when S9 strategic layer lands).

### Vehicle `MechanicalCondition`
- **Source:** ADR 016 § Q11 (vehicles aside)
- **Date deferred:** 2026-04-25
- **Reason:** Same data shape as `MedicalCondition` for
  vehicle damage states (engine derate / comms damaged / armor
  degraded). Out of scope until vehicles land in the schema.
- **Revisit when:** Vehicle schema is being authored.

### Per-zone resistance rollup formula
- **Source:** ADR 016 § Q10 (now moot under Q14c)
- **Date deferred:** 2026-04-25
- **Reason:** With one armor item per zone (Q14c), there's
  nothing to roll up — zone resistance is just the equipped
  piece's values. The rollup formula question is moot.
- **Revisit when:** Multi-armor-piece-per-zone is reintroduced
  (unlikely without a layered-armor mechanic).

### AAR squad-snapshot mechanic spec
- **Source:** ADR 016 § Q14i
- **Date deferred:** 2026-04-25 (conceptually agreed; mechanic
  needs design)
- **Reason:** The S6 debrief map shows squad position
  snapshots at sim quarters (T0 / T0.25 / T0.5 / T0.75 / T1.0)
  to read like a military ops summary. The visual is agreed;
  the data-capture mechanic and overlay rendering need design.
- **Revisit when:** S6 Debrief implementation begins (#292).

### Armory paperdoll per-zone crit-slot grid overlay
- **Source:** ADR 016 §S3 / task #350
- **Date deferred:** 2026-04-25
- **Reason:** The NEON WIRE armory ships with numeric `slotsUsed
  / slotsCap` in the inspector and DR readouts on the silhouette;
  the per-zone 3×2 / 4×3 / 2×6 / 3×2 / 6×4 grid overlay (showing
  individual crit slots filled vs empty) is a polish enhancement
  that doesn't change validity surfacing.
- **Revisit when:** Players need finer-grained per-zone slot
  visibility, or MWO MechLab parity is requested.

### Armory drag-and-drop interactions
- **Source:** ADR 016 §S3 / tasks #361–#365
- **Date deferred:** 2026-04-25
- **Reason:** The NEON WIRE armory ships with click-to-equip
  (stockpile row) + click-to-remove (inspector ✕). Full
  drag-drop (with shift-swap, alt-confirm-evict, right-click
  quick-unequip, double-click auto-fit) is polish on top of a
  functional equip flow — not gating MVP playtests.
- **Revisit when:** Loadout editing becomes a friction point in
  playtests, or post-MVP UX polish pass.

### S5 briefing — NEON WIRE rebrand
- **Source:** ADR 016 §S5 / task #291
- **Date deferred:** 2026-04-25
- **Reason:** The existing `briefing.tsx` is a substantial
  surface (~637 lines) anchored on the live map-preview pipeline
  (`useMapPreview`, `runPipelineWithRetry`, thumbnail render).
  It works end-to-end. A full NEON WIRE rebrand requires
  refactoring the map-preview hook + slot logic into NEON-WIRE-
  styled containers without disturbing the deploy plumbing —
  bigger lift than the other screens. Tabled to keep momentum
  on the more-self-contained surfaces.
- **Revisit when:** The remaining NEON WIRE surfaces are landed
  and the visual delta on briefing becomes the loudest gap in
  the MVP loop.

### S2 / S8 combat view — full NEON WIRE rewrite
- **Source:** ADR 016 §S2/S8 / task #288 (35 sub-tasks)
- **Date deferred:** 2026-04-25
- **Reason:** Largest screen rewrite by far — full-bleed map
  layer + selected-operator card with 14-zone paperdoll +
  squad-roster strip + objective bar + drone overwatch chrome +
  comms log + decision queue stub + S8 banner with bn name and
  mini-stats + ROE/WITHDRAW chips + footer with ISSUE BN ORDER.
  Existing `deploy.tsx` (~206 lines) is functional and runs
  full playtests. NEON WIRE rewrite is a multi-thousand-line
  rebuild; not gating MVP playtest cadence.
- **Revisit when:** The visual delta during playtests becomes
  the loudest gap (likely after S5 lands so the menu→board→
  briefing→combat flow is the only non-NW surface).

---

## Resolved deferrals

(none yet)
