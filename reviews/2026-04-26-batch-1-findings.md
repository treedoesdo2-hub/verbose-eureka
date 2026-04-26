# Builder self-review — Batch 1 — 2026-04-26

Five Opus subagents reviewed the seven most recent commits on `main`.
SHAs below reflect post-rebase hashes (PM rewrote 117 commits to strip
fake `(#NNN)` refs before pushing).

**Scope reviewed:**

| Commit    | Subject                                                          |
|-----------|------------------------------------------------------------------|
| `2ce3afa` | S7 ORBAT: real Company/Battalion entities                        |
| `5f75ce6` | S2/S8 unified combat view rewrite                                |
| `29ef9d5` | S2/S8 combat: objective hex-rings + nameplates in PIXI           |
| `28d0d29` | S3 Armory polish: drag-drop, modifiers, crit slots, quick-unequip|
| `8437936` | S5 Briefing rewrite — NEON WIRE 3-column layout                  |
| `56f9a00` | S6 AAR: squad-position snapshots + scrubber + comms / commendations / intel |
| `e978441` | S2/S8 combat: ghost contacts, LOS edge vignette, 14-zone paperdoll|

**Trigger:** Steve reported the program crashed when running "Yard
Assault" and noted unspecified UI discrepancies.

---

## Crash root cause

**Yard Assault crash is in `app/src/renderer/src/screens/deploy.tsx`
lines 185–203.**

`friendlies` and `hostiles` are computed inline as
`snapshot?.units.filter(...)` so their array identity changes every
render. The auto-select effect declares
`[selectedUnitId, friendlies, unitsById]` as deps. Each render:

1. `friendlies` is a brand-new array → effect fires.
2. Effect calls `setSelectedUnitId(first.id)` whenever the selected
   unit is null OR currently dead.
3. The state change re-renders → new `friendlies` reference → effect
   re-fires.

Yard Assault hits this hard because casualties are common; whenever the
selected operator dies the early-return falls through, the effect picks
the next survivor, sets state, and the cycle restarts every tick. React
19's "max update depth exceeded" surfaces as a hard crash in production
builds. `unitsById` is also a fresh `useMemo` keyed on `[snapshot]`, so
each tick produces a new Map reference — even a stable selection fires
the effect every tick.

**Cheapest fix:** memoise `friendlies` and `hostiles` on `[snapshot]`,
and have the auto-select effect depend on `[selectedUnitId, firstAliveId]`
(a primitive signature) rather than the array reference.

---

## Findings by severity

### Crash-class (1 finding)

- **`deploy.tsx:185-203` infinite render loop on casualty events.**
  See above.

### Real bugs (data corruption / broken core flows)

- **`armory-nw-editor.tsx:837-839 / 59-62` — primary weapons can't be
  drag-equipped.** `canPlaceItem` requires `right_hand`/`left_hand`,
  but `bodyZoneFor()` only emits the seven paperdoll body zones
  (head/torso/left_arm/right_arm/waist/left_leg/right_leg). Every drag
  onto a visible arm zone fails validity, so primaries are click-only.
  Core feature of #280.21 silently broken for the most-equipped item
  class.

- **`armory-nw-editor.tsx:120-128` — Shift-swap evicts non-conflicting
  items in zone.** `equipAt` does `next.filter(it => it.zone !==
  targetZone)` on swap/evict. Shift-dropping a new chest plate while
  wearing one wipes any sidearm at the waist, ammo pouches, utility
  kits anchored at the same zone too.

- **`stores/squads.ts:34-55, 149-153` — persisted Squad migration gap.**
  The `mapStorage` reviver only re-hydrates the `Map` shape; it does
  NOT run `Squad.parse`. Persisted squads from before #533 come back
  literally missing `branch`, `soulsAuthorized`, `companyId`. ORBAT
  filter then drops them from `branchesPresent` (Set of `undefined`),
  and the drill-in's `squad.branch.toUpperCase()` would throw on a
  legacy squad. Needs a `version`/`migrate` config that runs
  `Squad.parse` on each entry.

- **`screens/deploy.tsx:S8Banner.onWithdraw` — `WITHDRAW` aborts the
  mission with no confirm.** One stray click during a heated tick
  dumps the user back to the menu without a debrief payout. Spec calls
  for confirm/abort flow.

- **`screens/briefing.tsx:982-988 / 79-100` — `LOCK LOADOUT` is
  misleading.** Toggle only short-circuits slot edits; the `ARMORY`
  chip remains clickable, so loadouts can still be mutated. Either
  rename the chip ("LOCK SLOTS") or also gate the `ARMORY` link.

- **`screens/briefing.tsx:990` — `ABORT` chip uses
  `window.history.back()`.** Electron renderer has no router back
  stack; this is a no-op or worse, navigates the host BrowserWindow
  webContents back to `about:blank`. Should call `go('board')`.

### UI / regressions / missing wiring

- **`combat-view.tsx` — Pixi children leaked.** The snapshot effect
  calls `unitsLayer.removeChildren()` etc. without `.destroy({ children:
  true })`. Over hundreds of ticks of selection-flicker (root-cause #1)
  this is heavy GC churn and contributes to the crash. Fix the
  underlying loop first; secondarily destroy on remove.

- **`hud/Minimap.tsx` is orphaned.** The deploy.tsx rewrite dropped
  the minimap entirely and didn't add PIXI click-to-select to
  compensate. There's no spatial selection affordance on a large map.

- **`deploy.tsx:S8Footer.ISSUE BN ORDER` chip has no `onClick`.** Looks
  like a real CTA, does nothing. Either disable visually or stub a
  warning.

- **`deploy.tsx` squad roster strip clip-path** — outer plaques get
  visually nibbled by the parent `HEX_CLIP_TL_BR`.

- **`deploy.tsx` z-stacking collision at <900px height** — op cards
  (left rail) and the bottom-center roster strip can overlap.

- **`armory-nw-editor.tsx:222` — Shift-swap detection is
  `reason.includes('already')`.** String-match coupling between UI copy
  and logic; localizing or rewording the reason silently breaks swap.
  Discriminated reason codes would fix this.

- **`armory-nw-editor.tsx:1262-1266 / 1104` — head zone crit-slot grid
  renders above the silhouette.** `gy = labelPos[1] - 18` puts head
  dots at y≈4, above the head ellipse. Other zones look correct.

- **`armory-nw-editor.tsx:1685` — EquippedRow tooltip lost the ✕
  button mention.** Discoverability regression vs. the previous
  "Right-click → quick unequip (planned); ✕ removes now" copy.

- **`stores/companies.ts:55-77` — only 3 companies seeded, spec called
  for 4+.** A CO / B CO / HQ CO. Adding a 4th company (e.g. C CO recon)
  also requires updating `defaultCompanyForBranch`.

- **`screens/briefing.tsx:73-74` — `initialSlotCount` capped at 6, but
  Yard Assault has 8 seats.** User must click `+ SLOT` twice to fill
  the testbed contract. Drop the `Math.min(6, ...)` floor.

- **`screens/briefing.tsx:70` — `previewSeed = Date.now() & 0xffff`.**
  Only 65k collision space. Two playthroughs in the same 65-second
  window can collide on the same map. Either widen the seed or take
  the high bits.

- **`screens/briefing.tsx:1099-1131` — `useMapPreview` runs the
  pipeline synchronously inside a `useEffect`.** No loading state, so
  the briefing freezes for seconds on procedural contracts. Add a
  skeleton + try/catch.

- **`screens/briefing.tsx` — PHASE TIMELINE / LegendChips / live-comms
  dots are decoration with no backing data.** Static `T-00:00 →
  T-04:00` copy on every contract; INSERT/ROUTE/LZ/PATROL chips don't
  correspond to any drawn overlay; CMD/OPS dots pulse "live" implying
  telemetry that doesn't exist.

- **`screens/debrief.tsx` — wiped squads draw at world origin.**
  `centerX=0, centerY=0` for `aliveCount === 0` pins the marker top-
  left of the map. `computeBounds` already skips them; the render
  loop should too.

- **`screens/debrief.tsx:351` — `fontSize = vbW / 50`.** Unclamped;
  blows up to 80+ on a 4096-meter procedural map. Cap at a sane
  ceiling.

- **`screens/debrief.tsx:466-469` — squad-color palette is 3 entries.**
  Repeats with 4+ squads on the same axis-of-advance overlay.

- **`screens/orbat.tsx` — filter-hides-selection auto-jumps the
  drill-in.** Toggling off the active squad's branch silently swaps
  the right-panel target. Could be jarring.

### Dead code / nits

- **`sim/match-stats.ts:138/156/176` — `hostileTotal` accumulated then
  `void`-discarded.** Either expose it on `AARSquadSnapshot.hostileCenter`
  (to mirror friendlies) or delete the variable + increment.

- **`stores/companies.ts` — the persisted store has no migration story
  but the seed never changes shape.** Latent risk if the schema ever
  evolves.

- **`armory-nw-editor.tsx` drag onto the head zone label may overshoot
  silhouette** — purely cosmetic.

- **`deploy.tsx` PIXI text scale-down trick is fine on Pixi 8.6.**
  Confirmed not a crash source (one of the agents tested this
  hypothesis).

- **`screens/briefing.tsx` launch payload is NOT regressed.**
  `buildPrebuiltMap` is byte-equivalent to the legacy version. Briefing
  is exonerated for the Yard Assault crash.

- **`sim/match-stats.ts:18, 124` — `MAX_SNAPSHOTS = 64` silent stop.**
  Sample stops at ~32 sim-minutes. Yard Assault shouldn't hit it; flag
  for endurance contracts.

---

## Confirmed clean

- **S6 AAR sim-side hook (commit `68a7e6f`).** All TypeError candidates
  in the sim worker / accumulator path were chased and confirmed sound.
  Worker calls match the schema; types align. `Unit.position`,
  `Unit.action.kind`, `Unit.alerted`, `cur.units` all exist with the
  expected shapes.

- **PIXI imports.** `Application, Container, Graphics, Text, TextStyle`
  are top-level exports in this Pixi version. Not the crash.

- **Briefing launch flow.** `perOperatorLoadouts`, `operatorSquadIds`,
  `prebuiltMap`, `seed`, `simSpeedMultiplier`, `mapId`,
  `deployedOperatorIds` all preserved. `buildPrebuiltMap` matches
  `MapGenResultTransfer` in full.

---

## Suggested fix order

1. **`deploy.tsx` render loop** — only blocker for actually playing
   the game.
2. **Squads persist migration** — silent data corruption for any user
   with pre-#533 state.
3. **Armory drag-drop hand-zone bug** — core feature of a shipped
   commit silently broken.
4. **Armory shift-swap aggressive evict** — second silent
   corruption-class bug.
5. Everything else can wait for a polish pass; PM should triage.

Five more parallel review batches are dispatching against the older
work (#275–#290 mapgen + sim + NEON WIRE foundation + S1/S3/S4/S6
screens). Findings will land alongside this file.
