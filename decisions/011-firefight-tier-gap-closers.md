# ADR 011 — Firefight-tier gap closers: procedural maps, objectives, economic deployment, MechLab-style loadouts

**Status:** Accepted
**Date:** 2026-04-21

## Context

Four shortfalls block the game from its declared Clutch-Legend / Firefight-tier ambition (`refs/firefight.md`, project memory). None of them stand alone — they compound, which is why they live in a single ADR.

1. **Maps are hand-authored toy-sized.** Current combat maps are small, static, and drawn by hand in content files. Firefight's DNA is *varied spatial reading*: every engagement is a new room / street / compound that the player has to parse. That requires a **procedural generator** producing maps at **Firefight scale** (significantly larger than current), with a coherent spatial grammar — buildings, interiors, approach routes, cover arcs — not random noise.

2. **Matches have no objective beyond elimination.** Right now, once every enemy is down, the sim ends. Worse — when shooting stops but someone's still alive, AI *stands there*: no goal to drive them to move, extract, hold, or push. This is a symptom of missing contract-level objectives. Real Firefight-style play has explicit mission goals (seize building X, hold for N minutes, extract the VIP, destroy the target) that give both sides something to do besides trade shots.

3. **Deployment sizing is a lie.** `Contract.minOperators` / `maxOperators` exist in the schema but the code path is hardwired to a 4-unit squad. This contradicts the long-term vision: **contracts should present a payout and a goal; the player chooses how many operators to commit based on the economic tradeoff of payout vs. deploy cost vs. risk**. Slot counts as an arbitrary cap are the wrong primitive. The BattleTech / mil-sim DNA is "you have a roster; pick whom to send; the answer isn't always 'the full roster'." Arbitrary caps kill that decision.

4. **The loadout editor ships Templates on top of a broken inventory.** The zone editor is a per-zone dropdown list with a weight-only constraint. Weight alone is the wrong constraint surface — it hides the spatial packing problem that `spec/06` declared is the *point* of infantry loadouts ("Loadout validity is a packing problem against real physical constraints"). Building the Templates tab (#72) before fixing the underlying editor was a misorder — templates are meaningful *as a shortcut over the real editor*, not as a bypass that hides how weak the real editor is. The reference is MWO's MechLab: visible slots, typed hardpoints, drag-drop spatial placement, live stats panel — and we need the infantry analogue of that.

## Decision

Close these four gaps, in order (each unblocks the next evaluation).

---

### Pillar A — Procedural map generator (Firefight-sized)

**Target scale.** Firefight engagements feel like "a small neighborhood" or "a compound with its approaches." For reference math, Firefight's maps run roughly 250×250 meters for suburban engagements, sometimes more. We will target **at least 4× current area** as floor, **~16× as ceiling** (current: 64×64 tiles ≈ 64×64 m at 1 m/tile; target: 128×128 floor, up to 256×256 for larger objectives).

**Generation grammar.** Not perlin-noise wilderness — a *grammar* of tile-scale rooms and blocks assembled into a coherent layout:

1. **Seed & biome.** `MapRequest { seed, biome, sizeBucket, tags }` — biome picks the block vocabulary (urban / industrial / rural / interior), tags bias (e.g., `cqb`, `open`, `vertical`).
2. **Region skeleton.** Split the map into regions (roads, lots, compounds, fields) via a BSP-style cut or a simple road grid.
3. **Block fill.** Each region gets filled with one of N pre-authored "blocks" appropriate to the biome (a warehouse, a row of houses, an alley, a parking lot). Blocks are hand-authored but composable.
4. **Connectivity pass.** Carve doors, windows, fence gaps so the map is traversable between regions without being a maze.
5. **Cover pass.** Scatter low cover (crates, cars, rubble) in open regions so neither approach nor defense is uncovered.
6. **Spawn + objective placement.** Place team spawn regions and objective markers on opposite sides / at appropriate LOS distances.

**Authored, not neural.** Pre-authored block vocabulary + rules. No ML, no "generator engine." Deterministic given seed.

**Test surface.** Snapshot hashes on map for a given seed. Statistical tests: coverage density within expected band, connectivity invariant (all spawns reach all objectives), no sealed rooms.

**Not in scope for this ADR.** Vertical multi-level layouts (parked). Destructible terrain (parked). Weather/lighting (parked).

---

### Pillar B — Objectives (AI goal-directed, match end-conditions)

**Contract-level objectives drive match end-conditions.** A contract declares 1–N objectives with priority (primary / secondary / optional). Match ends when (any primary objective failed) OR (all primary objectives complete) OR (team elimination of whoever can still contest) — no longer only elimination.

**Objective kinds (MVP set):**
- `destroy(targetId)` — a specific map entity must be destroyed.
- `extract(unitIdOrGroup, extractZone)` — a unit / VIP must reach an extract zone alive.
- `hold(zone, durationTicks)` — a zone must be held continuously for N ticks, no enemies inside.
- `capture(zone)` — a zone must be entered and held for a short (≤ 10s) time, then sticks as "captured."
- `eliminate(tagOrFilter)` — kill all enemies matching a filter (the current implicit objective, now explicit).

**AI consumption.** Objectives feed AI goals directly — each unit has an `assignedObjective` field that overrides generic waypoint-following when set. `destroy` → move to target + engage; `hold` → move to zone + suppress approaches; `extract` → convoy the VIP; `capture` → push into zone. When all primary objectives are satisfied or no enemies remain, *non-primary* units fall back to extract or cohere around the completed objective — no more standing in place.

**UI surface.** Briefing screen surfaces objectives explicitly (already half-done via `contract.objectives`, but currently cosmetic). Combat HUD shows the current objective list with live status. Debrief enumerates outcome per objective, which feeds payout (primary complete → full payout; secondary → bonus; primary failed → reduced/no payout).

---

### Pillar C — Contracts drive deployment sizing (economic, not slot-cap)

**Remove hardwired 4.** All code paths that assume a fixed team size are bugs to fix.

**Contract schema change:**
- `minOperators`: 0 or ≥1 (hard floor — below this, the objective is literally infeasible, e.g., "needs at least one medic").
- `maxOperators`: `null` (uncapped) or ≥`minOperators` (rare — only exists when lore / extraction vehicle / infiltration flavor genuinely limits group size).
- New field: `recommendedOperators: number` (for UI display only — "recommended for N operators at Green tier").
- New field: `deployCostPerOperator: number` (fuel, insurance, consumables — the opposing weight to payout).

**Player's economic decision surface.** Briefing shows:
- Payout (flat, plus bonus objectives)
- Deploy cost = `deployCostPerOperator × deployedCount`
- **Net expected payout** = Payout − Deploy cost
- Risk estimator (opposition vs. your force, derived from stats+loadout+objective)

Player commits the force size *they* judge appropriate. The decision — "send 3 veterans or 6 greenhorns? or 2 veterans because fuel is thin?" — becomes first-class.

**Squad assignment stays form-filling (ADR 009 / briefing redesign).** The deployment order now has **variable-count slots** — "assign up to the recommended count, or go lean, or go heavy if the contract allows."

---

### Pillar D — Infantry loadout editor as MechLab-style spatial packing

**Replace dropdowns + weight bar with visible slots + drag-drop.**

**Data model additions:**
- Each body zone declares a **slot capacity** (discrete integer, not just kg). E.g., head = 3 slots, torso_front = 6 slots, torso_back = 6 slots, waist = 4 slots, leg = 3 slots each, arm = 2 slots each, hand = 2 slots each, back_mount = 4 slots, internal = 6 slots.
- Each zone declares its **hardpoint types** — what *kinds* of gear it accepts. Head accepts {helmet, optics, comms}; torso_front accepts {plate, rig, pouch}; waist accepts {holster, IFAK, pouch}; hand accepts {grip}; etc.
- Each gear item declares: **slot footprint** (integer slots consumed), **hardpoint type** (what kind it is), **weight kg** (kept for encumbrance).

**UI (the MechLab lesson applied to a body paradigm):**
- **Body schematic.** Left panel: the unit as a body diagram with every zone visible simultaneously (like MWO's expanded MechLab with all 8 locations at once). Not a small preview; this is the primary surface.
- **Slot columns.** Each zone shows its slot capacity as a column of N discrete boxes. Empty boxes are clickable targets. Occupied boxes show the item name / icon and span multiple rows if the item's footprint > 1.
- **Inventory panel.** Right panel: a filterable list of items available in the stockpile. Clicking an item highlights every zone that could accept it (matching hardpoint type + enough free slots) — this is the "green / red" signal MWO does through color.
- **Drag-drop** from inventory to a specific zone's free slots; drag back to remove. Keyboard-accessible equivalent (select item, select zone).
- **Stats panel.** Always visible: total kg / budget, mobility penalty, per-zone DR, carried weapons, meds on hand — updates live as you place items.
- **Templates tab (#72) becomes a power-tool surface.** "Apply template" is still a one-click ops over the real editor — but the real editor is what you open when you actually care.

**Validation consequences.**
- Two simultaneous constraints (kg budget AND slot capacity per zone) — both must be satisfied.
- Hardpoint type enforces "an armor plate doesn't go in a helmet slot" at the editor level, not just as a silent no-op.
- `deriveCombatProfile` gets per-zone slot-utilization in addition to kg.

**What we're NOT doing:**
- Not adding every MechLab concept: no Omnipods (our zones don't swap). No engine-component slot cost (no engine on infantry).
- Not a full 3D paper-doll render. 2D schematic with labeled zones is enough — ADR 009 forbids diegetic chrome.

---

## Order of operations

Work the pillars in this order — each one gives the next a real target to evaluate against:

1. **Pillar C first** (deployment sizing). Smallest blast radius, unblocks the briefing UX. Contract schema + briefing slot count + debrief payout math.
2. **Pillar B next** (objectives). Gives the AI something to do and makes non-elimination endings possible. Requires adding objective runtime to sim state + AI consumption. Testable with hand-authored map.
3. **Pillar A** (procedural maps). Needs Pillar B already shipped so objective placement is meaningful. Hand-authored blocks first, generator frame around them.
4. **Pillar D** (loadout rebuild). Parallel-shippable to A — frontend-heavy with schema ripples. Intentionally last so Templates (#72) gets reworked against the real editor rather than written twice.

## Consequences

**Positive.**
- Matches become *missions* with shape, not shoot-until-empty.
- Deployment becomes a real economic decision — "we can take this, but should we?"
- Procedural maps deliver the replayability the game's pitch depends on.
- Loadout editor finally matches the spatial-packing promise in `spec/06` (the central-mechanic P1).

**Negative / cost.**
- Biggest single content investment so far (authored blocks, objective logic, MechLab UI).
- Existing hand-authored maps need to be either re-keyed as generator blocks or kept as a fallback.
- Loadout data model change cascades into content files (every weapon/armor/utility gets a slot footprint + hardpoint type).
- Contract authoring ergonomics shift — authors now set recommendedOperators and deployCostPerOperator, not just a min/max pair.

**Cascades into / overrides.**
- **Overrides** the hardwired-4 assumption across `scenario.ts`, briefing deploy, deploy screen, debrief payout.
- **Clarifies** ADR 007 (contract structure) — the "team composition" knob is now uncapped by default.
- **Reworks** `#72` Templates tab — the template card's "apply to…" still works, but templates themselves need a richer data model once gear gets slot footprints.
- **Extends** `spec/06` with explicit slot-capacity + hardpoint-type tables (amendment needed).
- **New refs document** — `refs/mwo-mechlab.md` capturing the UI lessons and what we deliberately *don't* copy.

## Related

- ADR 002 — progressive disclosure for customization depth (Default vs Advanced loadout modes; MechLab-style is the Advanced surface)
- ADR 007 — contract as multi-phase operation (payout mechanics)
- ADR 009 — UI philosophy (flat web-app aesthetic; drag-drop is fine, skeuomorphic paper-doll chrome is not)
- `spec/06-loadout-system.md` — the spec this pillar D finally implements
- `refs/firefight.md` — map scale + objective flavor reference
- `refs/never-second-in-rome.md` — UX density reference for the stats panel

---

## Addendum — Research grounding (2026-04-21)

Four parallel Opus agents inspected the actual reference games on disk. The original ADR was written off pitch-deck memory; this addendum is the corrections ground-truth forced.

### Pillar A — Firefight is not what I wrote

- **Location:** `C:\Users\User\Downloads\Firefight.v9.0.2\Firefight.v9.0.2\` (Sean O'Connor's Firefight, WW2 operational). Not Steam-installed.
- **Scale:** every map is `4096 × 4096` world cells (per the `-world.dat` header `0x1000 × 0x1000`). The "250 × 250 m suburban" claim in the original body was me looking at a contour PNG, not the playfield. At 1 cell ≈ 1 m these are 4 km × 4 km operational-scale maps.
- **Authoring:** 27 hand-drawn theaters, ~80 bespoke scenarios with hand-placed units (coordinates in `-scenarios.dat`). **Firefight is not procedural.** The DNA we're invoking for procgen is authored-volume; we're substituting procgen-over-authored-blocks because 27 hand-painted maps is out of budget.
- **Vocabulary target:** Firefight ships ~80 building props + ~20 object categories + 100+ tree assets. Block library floor **40**, target **60** across 3–4 biomes.
- **Engagement scale for us:** 128–256 tiles per side, not Firefight's 4096. Firefight's map is operational; our engagement is the *slice* Firefight renders at close zoom.
- **Add to schema:** `generationSeed: string` + `generationVersion: number` on GameMap so regenerated maps are replay-stable across generator changes.

### Pillar B — Objective taxonomy is incomplete; AI wiring is wrong

- **Battle Brothers** (installed at `C:\Program Files (x86)\Steam\steamapps\common\Battle Brothers\`, mod zips are unpacked Squirrel): contracts are state machines with named `m.States` (e.g. `"Running"`), not static objective lists. Useful pattern for multi-scene contracts.
- **Menace** (uninstalled but `C:\Users\User\AppData\LocalLow\Overhype Studios\Menace\Saves\latest.save` ASCII-readable): canonical mission verbs are `interdict / secure / defeat / hunt / seize / sabotage / collect / rescue / contain / clear / reclaim / contaminate / protect`. Objective zones are first-class renderable regions.
- **Missing objective kinds** from the original list (`destroy / extract / hold / capture / eliminate`):
  - `escort(who, zone)` — ally-powered, fails on ally death (vs `extract` which is self-powered)
  - `defend(entity, duration)` — moving/stationary target, not a zone
  - `interact(target, duration)` — Touch/Photograph/Plant/Collect family (JA3/Menace)
  - `survive(duration)` — stay alive, no spatial objective (ambush/retreat missions)
  - `preserve(entity)` — negative objective, fail-on-destruction, no duration
  - `destroy` should take a **filter**, not a concrete id (JA3 "destroy all bridges")
- **AI "stands there" fix** — the original ADR said `assignedObjective` on a Unit overrides waypoints. That doesn't fix the idle terminal in `bt.ts:248-254`, which fires when waypoints empty AND no threat. Correct design: an `ObjectiveDriver` layer runs *before* `decide()` and **regenerates waypoints dynamically** when the unit's queue is empty and the objective isn't complete. The BT stays reactive; the driver refills movement goals. Do not add new AiState values.

### Pillar C — Schema is too flat; the hardwired 4 is in exactly one place

- **BT is not on disk** (not installed, no save data). Web-grounded. `Clutch Legend Demo` is installed but it's an Electron wrapper — nothing to mine.
- **The hardwired 4 is a single UI lie** at `app/src/renderer/src/screens/briefing.tsx:9`: `const ELEMENT_ROLES = ['Primary', 'Secondary', 'Support', 'Reserve']`. The sim layer (`scenario.ts:79`) is already size-agnostic; `schema/contract.ts:32` already carries `minOperators/maxOperators`. Training-yard map has 6 player spawns. Fix is UI-only in one file.
- **Schema needs more shape:**
  - Replace `payout: number` with `ContractPayout { cash, salvagePriorityPicks, reputationDelta, secondaryBonusCash, goodFaithFraction }` — BT decomposes payout three ways and we shouldn't re-key every contract file twice.
  - `deployCost` isn't flat — split into `fixedPerContract` (insertion/extraction, biome-scaled) and a **per-operator cost that lives on the operator record** (`operator.dailyWage`, `operator.insurancePremium`). Veterans cost more than greenhorns — that's the JA3 economic loop.
  - `recommendedOperators: number` → tier-keyed band `{ green, regular, veteran }`. "Recommended 6 green or 3 veteran" is the real decision.
  - Add `difficultyRating: 1-5` (BT's skull rating) for the P(success) readback.
  - Add `modifiers: { extractionSeats, requiredRoleTags }` — stealth infil forces small teams; some contracts need a medic.
- **Migration:** Zod `.or()` union accepts old+new for one release, codemod `app/scripts/migrate-contracts-011c.ts` writes canonical new JSON back. Snapshot-test determinism pre/post.

### Pillar D — MWO back-brief is mostly right; Duckov is the better reference

- **No MechWarrior titles installed** — MWO, MW5 Mercenaries, MW5 Clans, YAML all absent. Relied on web.
- **Escape from Duckov IS installed** (`C:\Program Files (x86)\Steam\steamapps\common\Escape from Duckov\`) — Unity Mono, decompiled to `C:\Users\User\AppData\Local\Temp\duckov_decomp\`. This is the direct Tarkov-style indie analogue. Load-bearing findings:
  - `ItemStatsSystem.Slot` (`itemstats.cs:5222`) uses `requireTags: List<Tag>` + `excludeTags: List<Tag>` — **tag-based slot matching**, not a narrow hardpoint enum.
  - `Inventory` (`itemstats.cs:2220`) is a **flat `List<Item>` with `int capacity`** — Duckov skips the tetris grid. The "Tarkov feel" is UI affectation; we shouldn't copy the grid.
  - Containers-within-containers: a chest rig is itself an `Item` whose child `SlotCollection` has pouch-tagged slots. This matches spec/06's "physical chest rig" intent.
- **Corrections to the MWO back-brief:**
  1. **Hardpoint sizing is a 4th axis** in vanilla MWO (small/medium/large per type). YAML removes this. Our proposal matches YAML, not vanilla — call that out explicitly.
  2. Engine consumes CT + side-torso crit slots in bigger ratings. Not porting to infantry (no engine) but the "item spans multiple locations" concept must NOT leak into the infantry editor.
  3. Fixed components (cockpit, gyro, shoulder actuator) render as grayed-locked slots. Infantry analogue: hand grips are fixed-locked slots.
  4. Omnipods exist in MWO Clan mechs. Explicitly NOT porting.
- **The infantry port is tag-based**, not enum-based: current `HardpointType = enum [primary, sidearm, melee]` in `schema/common.ts:59` is too narrow. Replace with `SlotTag` union including `grip, plate_hard, plate_soft, helmet, optics, comms, rig, pouch, holster, ifak, sleeve_pad, large, pack_anchor, cyberware_limb`. Weapons/armor/utility get `tags: SlotTag[]` + `slotFootprint: number`. Add `ZONE_SLOT_CAPACITY` and `ZONE_ACCEPTED_TAGS` tables next to `ZONE_CAPACITY_KG` at `common.ts:42`.
- **Proposed slot + tag table:**

| Zone | kg (unchanged) | Slots | Accepted tags |
|---|---|---|---|
| head | 2 | 2 | helmet, optics, comms |
| torso_front | 8 | 6 | plate_hard, plate_soft, rig, pouch |
| torso_back | 8 | 4 | plate_hard, plate_soft, pack_anchor |
| left_arm / right_arm | 2 | 2 | sleeve_pad, cyberware_limb |
| left_hand / right_hand | 5 | 1 (fixed grip) | grip |
| waist | 4 | 4 | holster, pouch, ifak |
| left_leg / right_leg | 3 | 2 | holster, plate_soft, cyberware_limb |
| back_mount | 15 | 1 (fixed large) | large |

- **UI spec:** 3-column layout (schematic / inventory / stats). Click-an-item-then-click-a-zone as peer to drag-drop. ADR 009-compliant feedback is 1-px solid `var(--ok)` border + 8%-alpha tint, not MWO's soft glow.

### Four open decisions blocking implementation

Each pillar surfaced exactly one question where I need a call from you before I can build without guessing:

**A. Engagement-scale target in meters.** The ADR hedges 128–256. Firefight doesn't answer this (it's 4 km operational). Lock one number — 150, 200, or 250 m per side — and everything else (BSP cut sizes, block footprints, cover-density bands, spawn-distance tests) becomes a parameter on it.

**B. Objective runtime state: inside `SimState` or beside it.** Two viable shapes:
- *Inside* — `state.objectives: Map<ObjectiveId, ObjectiveRuntimeState>` mutated between perception and BT, affects determinism hash, sim is still meaningful standalone.
- *Beside* — separate `MatchState` wraps `SimState` + objectives, sim stays pure, cleaner layering, but headless playtesting loses an end condition.

**C. Where does `P(success)` come from?**
- (a) Authored `difficultyRating` vs committed force — cheap, opaque, BT-faithful.
- (b) **Monte Carlo over the deterministic sim** at briefing-commit — run N headless simulations, report win rate. Your sim is fast + deterministic so this is actually tractable; would be genuinely novel for an autobattler.
- (c) Closed-form estimator from stats+loadout+opposition — cheapest runtime, brittle to author.

**D. Rig/pouch model: tag-only or container-within-container.**
- (A) **Tag-only** — chest rig occupies 1 `rig` slot, pouches independently occupy `pouch` slots in the same zone. Cheap. But "wearing a rig" doesn't physically enable pouch slots; they exist unconditionally.
- (B) **Container** (Duckov truth) — the rig item owns a child inventory; pouches only exist *inside* a slotted-on rig. Matches spec/06 intent and the shipped indie-Tarkov-clone reference. Costs a recursive walk in validate + derive, adds a nav layer to UI.

Agent recommendation: (A) for MVP, (B) as a schema-compatible follow-up. But the call needs to be made once, before schema churn starts, or backfill happens twice.

