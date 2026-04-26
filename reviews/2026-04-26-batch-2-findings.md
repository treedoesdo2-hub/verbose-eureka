# Builder self-review — Batch 2 — 2026-04-26

Ten Opus subagents reviewed the older work that predates batch-1's
seven-commit window — mapgen/sim core, NEON WIRE foundation, brand,
ammo/armor, armory paperdoll core, ORBAT schema, S1 main menu, S4
contract board, S6 debrief base, and S5 briefing scaffolding.

**Scope reviewed (by task ID, not commit):**

| Agent | Tasks                          | Area                                                    |
|-------|--------------------------------|---------------------------------------------------------|
| 1     | #275                           | Buildings as structures (3 increments)                  |
| 2     | #276, #279                     | Pathfinding A* + movement modes                         |
| 3     | #277, #278                     | Biome variation (rural / arid) + map render             |
| 4     | #283                           | NEON WIRE foundation — frame, grid, vignette, primitives|
| 5     | #284                           | PAYROLL: callsigns + result vocabulary                  |
| 6     | #281, #285                     | Ammo / mags / reload + armor weight + combat profile    |
| 7     | #280                           | Armory paperdoll core (precedes NW editor polish)       |
| 8     | #287                           | ORBAT APP-6-ish symbology + filter UX                   |
| 9     | #289                           | S1 Main Menu NavStack + CompanyCard + drone track       |
| 10    | #290, #292                     | S4 contract board + S6 debrief base                     |

**Trigger:** Continuing the post-Yard-Assault audit. Batch-1 caught the
crash; batch-2 is sweeping the foundation work that everything else
sits on, so any rot here cascades into every later screen.

---

## Lead findings (likely blockers / load-bearing bugs)

1. **`sim/pathfinding.ts` A* allocates ~144 MB per call on 4096² maps.**
   `Float32Array` + `Int32Array` + `Uint8Array` are all sized to the full
   map area on every invocation. This is the real reason 4096-tile
   contracts misbehave — it's not just slow, it's GC-thrashing. Either
   pool the buffers or hierarchically chunk the search. Pairs with the
   `executeMovement` finding below: even when A* succeeds, the `mode`
   parameter is hardcoded `'foot'` so mech units get the wrong cost grid
   anyway.

2. **`screens/armory-nw-editor.tsx` paperdoll is missing hand zones.**
   Same family as batch-1's drag-drop hand bug, but worse: equipped
   weapons are also invisible on the silhouette because `PAPERDOLL_ZONES`
   has no `right_hand` / `left_hand` entries. Weapons are slotted in
   state but never drawn on the paperdoll, so users can't tell what's
   equipped without opening the equipped-rows list. Core feature of
   #280 silently broken in two places (drag + render).

3. **`shared/snapshot.ts` drops `unit-reload-failed` at the
   serialization boundary.** Sim emits the event but the snapshot
   schema's discriminated union doesn't include it, so it gets stripped
   on transfer to the renderer. Reload-fail telemetry never reaches the
   AAR or the comms log. Pairs with the determinism hash finding:
   determinism input also doesn't include ammo/mag state, so two replays
   with different reload outcomes hash equal.

4. **NEON WIRE foundation never actually applied.** `NWFrame` is exported
   but no screen imports it. The grid background and edge vignette only
   exist inside `NWFrame`, so no screen renders them. The "NEON WIRE
   look" users see is hand-rolled per screen — meaning #283's whole
   point (a shared chrome) didn't ship. Adopting `NWFrame` retroactively
   would also fix the grid-and-vignette regression noted in batch-1's
   combat-view findings.

---

## Findings by severity

### Crash-class / blockers

- **`sim/pathfinding.ts:185-192` — A* full-map array allocation.** See
  lead finding #1. ~144 MB × every path request × every tick = OOM
  pressure that scales with map size. Suspected real cause of the
  4096² unplayability.

- **`sim/buildings/climb.ts` (or equivalent) — concurrent-climb teleport
  stack.** Two units triggering `enterStructure` on the same tick can
  push onto the climb stack in an order that mutates the other unit's
  `position` field. State corrupts to non-physical positions; downstream
  `hasLineOfWalk` queries return garbage. Increment-3 of #275.

### Real bugs (broken features / silent corruption)

- **`screens/armory-nw-editor.tsx PAPERDOLL_ZONES` — no hand zones.**
  See lead finding #2. Equipped primaries / sidearms render nowhere on
  the silhouette.

- **`screens/armory-nw-editor.tsx CONFIRM LOADOUT` is a no-op.** The
  button renders and is clickable but its handler doesn't persist or
  navigate. Users assume it commits; nothing happens.

- **Hover preview is not a delta.** Hovering an item in the inventory
  shows that item's stats, not `(equipped + hovered) − equipped`. The
  comparator is the entire point of the hover affordance per #280; it
  doesn't compute.

- **`shared/snapshot.ts` discriminated event union — missing
  `unit-reload-failed`.** See lead finding #3.

- **Determinism hash input excludes ammo/mag state.** Two sim runs that
  diverge only on reload outcomes hash equal, defeating replay
  verification. Add `ammoLoaded`, `magsRemaining`, `chamber` to the
  hash payload.

- **`stores/loadouts.ts deriveCombatProfile` ignores ammo weight.** Total
  carry mass omits the kg-per-mag × loaded-mags contribution. Combat
  load thresholds (the 20%-increment penalties from the recent ADR)
  fire incorrectly — operators feel "lighter" than they are.

- **`sim/tick.ts:118, 151 executeMovement` hardcodes `'foot'` mode.**
  `mode` parameter exists on the movement contract but never reaches
  the movement-cost grid. Mech / vehicle units pathfind on foot rules.
  Same finding as in batch-1's nit list; elevating to "real bug" because
  agent-2 traced the dataflow and confirmed it's never threaded.

- **`sim/los.ts hasLineOfWalk` ignores edges.** Walk LOS treats only
  vertex blockage, not edge blockage; thin walls between adjacent tiles
  are invisible to the function. Affects climb-onto-edge, fence
  traversal, urban interior LOS.

- **`mapgen/biomes/rural.ts` march-road can miss the map edge.** Road
  generator picks two points but doesn't guarantee either lands on the
  border, so contracts can spawn with a road that dead-ends inside the
  AO with no insertion vector.

- **`mapgen/biomes/arid.ts` — has roads but no hedge generator.** Spec
  called for hedges/scrub for cover variation; arid currently flat
  except for a road. Cover density off-spec.

- **`screens/debrief.tsx:252-270` — phase-label regex emits
  `T0.55` / `T0.105`.** `'0.' + (i * 25)` then `.replace(/0$/, '5')`
  produces malformed labels at i=2 (`T0.55` from `T0.50`) and i=4
  (`T0.105` from `T1.00`). The whole approach is wrong; just format
  minutes/seconds directly.

- **`screens/contract-board.tsx:326-389 ContractMap` is hardcoded SVG.**
  INFIL/OBJ/EXFIL schematic never reads from the real mapgen pipeline,
  so contracts that *have* a procedural preview don't show one. Same
  thumbnail every contract.

- **`screens/debrief.tsx` — Decisions Log section missing entirely.**
  Spec #292 included a per-decision strip (engagement choice / abort /
  withdraw / objective swap). Not implemented; section absent from the
  AAR.

- **`hud/NWBar.tsx` — NaN render on zero `max`.** `value / max` returns
  NaN when `max === 0`; the bar's width style becomes `NaN%` and the
  element collapses but the surrounding flex still allocates space.
  Hits empty squads and pre-loadout briefings.

### UI / regressions / brand drift

- **NEON WIRE playground route is unreachable.** `pages/_nw_playground`
  (or wherever it lives) has no entry from the menu and no dev-mode
  toggle; only reachable by typing the URL. Per #283 this should at
  least be linked from a dev menu.

- **`NWFrame` never adopted by any screen.** See lead finding #4. Grid
  + vignette + edge tick marks all live inside `NWFrame`; nothing else
  imports it.

- **`screens/deploy.tsx` slot strip uses bare callsigns** — no rank
  prefix, no squad tag. Brand vocabulary from #284 (PAYROLL) calls for
  `SGT VULTURE / 2-1` style; deploy renders just `VULTURE`.

- **Event feed uses bare callsigns** — same drift, in the combat
  comms feed.

- **`WIN` / `LOSS` strings used instead of BRAND.md vocabulary.** Spec
  is `MISSION COMPLETE` / `MISSION FAILED` (and the loss-condition
  variants). Currently terse and off-brand.

- **`screens/orbat.tsx` plaque uses stylized icons, not APP-6
  symbology.** #287 called for actual NATO joint-symbol frames; current
  art is a flavor pass. Either commit to APP-6 (frames + modifiers) or
  rename the spec — the stylized version mis-sets reader expectations.

- **ORBAT readiness / deployment filter chips absent.** Branch chips
  exist; readiness state and deployment status do not. Spec listed all
  three.

- **`screens/main-menu.tsx:236-240 NavStack` ships 3 items, spec called
  for 7.** PAYROLL / ARMORY / BOARD render; CONFIG, ROSTER, ORBAT,
  STOCKPILE missing.

- **`screens/main-menu.tsx CompanyCard` ignores the companies store.**
  Hardcoded to "A CO" rather than reading active company id from
  `useCompaniesStore`.

- **Main menu drone-track decoration has no pulse animation.** Spec
  #289 called for a slow drone-pass marker; static placeholder shipped.

- **Currency mismatch: code uses `¥`, BRAND.md uses `cr` / `Cr`.**
  Drifted across debrief, briefing, payroll surfaces. Pick one; BRAND.md
  is the source of truth, so most surfaces need the swap.

### Perf / churn

- **`stores/buildings.ts setHiddenBuildings` re-bakes the full visibility
  layer.** Toggling a single building re-walks every structure on the
  map; expensive on the dense urban biome. Memoise the unchanged set.

- **`mapgen/render/biome.ts` per-pixel `fillRect` for ground texture.**
  4096² × per-pixel fill is the budget killer on procedural thumbnails.
  Use an `ImageData` buffer + single `putImageData`, or pre-bake a
  tileable noise patch.

### Dead code / nits

- **Increment-3 of #275 has a dead `|| true` short-circuit** in the
  climb-feasibility check. Either it's leftover debug or the gate logic
  was abandoned mid-implementation.

- **#434 SVG vocabulary not extracted to a sprite sheet** — every
  consumer inlines path data. Per the brand foundation work this was
  meant to land as a shared symbol set.

---

## Confirmed clean

- **Buildings increment-1 + increment-2** (geometry + collision shape
  bake). No issues found by agent-1 in those steps; the climb-stack bug
  is increment-3 only.

- **Rural biome road generator's *seeding*.** Deterministic, reproducible,
  hashes correctly. The miss-the-edge bug is in endpoint selection, not
  in seeding.

- **Armor zone mapping (#285).** `bodyZoneFor` correctly maps the seven
  paperdoll zones; the gap is on the *hand* side (covered above), not
  on body armor.

---

## Suggested fix order

1. **A* allocation + `executeMovement` mode threading** — the real
   4096-tile blocker, and a one-line dataflow fix sitting on top of it.
2. **Paperdoll hand zones (render + drag)** — promote batch-1's drag
   bug + this batch's render bug into one fix; both are the same root
   cause (no hand zone in `PAPERDOLL_ZONES`).
3. **`unit-reload-failed` snapshot + determinism hash inputs** — silent
   data loss on the replay/AAR side.
4. **Concurrent-climb teleport stack** — corruption-class, low rate but
   reproducible.
5. **`NWFrame` adoption pass** — converts a foundation-task miss into
   shipping chrome across every screen at once.
6. **CONFIRM LOADOUT handler + hover-delta preview** — armory's two
   most-visible no-ops.
7. **Phase-label regex, ContractMap real preview, Decisions Log
   section** — debrief / contract-board content correctness.
8. Brand drift sweep (callsigns, currency, WIN/LOSS, NavStack 3→7,
   CompanyCard) — one PR, mostly mechanical.
9. Perf items + dead-code nits — polish pass.

Combined with batch-1, the PM now has a full inventory across all
recent work. Triage and assignment authoring next, per protocol.
