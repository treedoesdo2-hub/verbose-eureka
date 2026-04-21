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
