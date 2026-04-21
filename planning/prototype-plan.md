# Prototype Plan — 24hr MVP Build

The build schedule for the MVP vertical slice (spec/08), done in 24 hrs of continuous AI coding effort. Organized as 8 three-hour blocks, each with a concrete deliverable and a checkpoint gate. Checkpoints are go/no-go — if the gate doesn't pass, we cut scope before proceeding.

**Budget shape:** ~1–2M tokens of focused coding across ~24 hrs. Assumes AI velocity on typed TypeScript + React (not research-heavy; the specs answer most "how do I" questions). Human designer intervenes at checkpoints and when the AI hits an explicit decision-fork.

**Build order principle:** Sim before UI. Data model before rendering. Determinism before polish. Pillar P4 is the soul — it must run before anything else is worth shipping.

---

## Block 1 (hrs 0–3): Tech stack scaffold + data model

**Deliverables:**
- Electron + Vite + React + TypeScript project running (`electron-vite` starter)
- Worker thread wired up, round-trip message test passing
- Zustand store initialized (settings, roster, stockpile slices stubbed)
- Zod schemas for: Operator, Weapon, Armor, Utility, Contract, EnemyFaction
- JSON loader with schema validation at load time
- Biome configured, Vitest configured, one passing test for each store slice

**Checkpoint (hour 3):** `pnpm dev` launches Electron, React page renders inside, Vite HMR works on React edit, Worker ping-pong round-trips, JSON data files load and validate against schemas.

**Fails gate → investigate R12 (Electron packaging) or swap to pure web (drop Electron for MVP, keep it as post-MVP wrapping task).**

---

## Block 2 (hrs 3–6): Combat sim core + determinism

**Deliverables:**
- Seeded PRNG (xoshiro or equivalent), `Math.random` banned via lint rule
- Tick loop at fixed 30Hz in Worker, pure-function state evolution
- Unit entity: position, facing, blood volume, wound arrays (per-zone), loadout reference
- Tile grid world representation (1024×1024 stub with a couple of terrain types)
- Deterministic replay harness: record seed + inputs, re-run from seed, hash final state, diff
- CI test: run 1000-tick sim twice from same seed, assert identical hash

**Checkpoint (hour 6):** Sim runs 1000 ticks with ~16 stub units moving on tile grid, deterministic replay passes, tick loop is profilable and sits comfortably under budget at real-time.

**Fails gate → R6 (determinism) or R2 (perf) in play. Investigate before layering further systems.**

---

## Block 3 (hrs 6–9): LOS + vision + hit resolution

**Deliverables:**
- Tile-sampling raycast for LOS (per spec/07 §LOS algorithm)
- Three-tier vision per unit: ±20° focused cone, 80m peripheral bubble, alerted 360° override
- Graduated cover 5-point sample (0–80 scale)
- 4-stage hit resolution pipeline: hit/miss → zone → armor/pen → wound instance
- Per-zone armor lookup tied to body-zone packing from loadout
- Wound instance creation with bleed rate, type, treatment state
- Ballistic data plumbed (caliber/velocity/mass → penetration math)

**Checkpoint (hour 9):** Two stub units shoot at each other through partial cover; hits resolve to per-zone wounds; LOS blocks behind full-occlusion terrain; flanking unit spots a target with its back turned.

**Fails gate → sim-architecture bug (spec/07 wrong). Fix before layering AI.**

---

## Block 4 (hrs 9–12): Loadout system + stockpile + roster

**Deliverables:**
- Advanced-mode loadout data model (spec/06): body-zone packing for infantry, tonnage+crit checks
- Default-mode templates (UX wrapper over advanced)
- Stockpile: company-level gear inventory, equip/unequip operations pull/return
- Roster: ~10 pre-made operators in JSON, hire/fire/view flows over real data surface
- Loadout → armor-per-zone → sim integration (loadout changes are observable in combat)
- Unit test: equipping heavy armor increases pelvis-zone DR vs light armor, measurable in hit resolution

**Checkpoint (hour 12):** Two rosters with different loadouts (heavy vs light) produce measurably different wound outcomes in a scripted 1v1 sim test. Stockpile state persists across equip/unequip round trip.

**Fails gate → R3 (loadout-balance) or R7 (roster-production-shape) in play. The P1 pillar depends on this working.**

---

## Block 5 (hrs 12–15): AI (BT + utility) + recovery behaviors

**Deliverables:**
- Behavior Tree state machine (advance / hold / retreat / flank / recover)
- Utility scoring within BT states (target selection, cover choice, reposition trigger)
- Hand-authored waypoint routes for the one MVP map, per behavior, per role
- Leader-follower steering with separation
- `buildSafeWaypoints`-style greedy local avoidance for dynamic targets
- Recovery AI: drag-to-cover, stabilize-in-place, medic-approach
- Alerted-state override (360° vision + reactive steering dominates waypoint)

**Checkpoint (hour 15):** 6v6 scripted engagement on the MVP map runs end-to-end: units advance on waypoints, enemies react when spotted, wounded units drag teammates to cover, medic stabilizes. No hangs, no infinite loops, deterministic replay still passes.

**Fails gate → R9 (waypoints feel scripted) → kill-switch to tile-A*, budget ~2hrs from block 8 reserve.**

---

## Block 6 (hrs 15–18): Pixi.js rendering + combat HUD

**Deliverables:**
- Pixi.js scene, sprite-batched, tile grid rendered
- Unit sprites with facing indicator, vision cone visualization (focused + peripheral bubble)
- Wound HUD per unit: per-zone wound indicators, blood volume bar, treatment state
- Speed controls UI: 0.5x / 1x / 2x / 4x / 8x / pause
- Muzzle flash / tracer / impact visual feedback
- Combat-log timeline panel (scrollable, scrub support hook for replay)

**Checkpoint (hour 18):** The 6v6 engagement from block 5 renders in Pixi at 4x default speed, 60fps sustained on the dev machine with 16 units. Vision cones visibly change when units rotate. Wound HUD updates per-hit. Speed controls work.

**Fails gate → R2 (sim perf) or rendering bottleneck. Profile first, then optimize — don't rewrite. Pass/fail #1 is gated here.**

---

## Block 7 (hrs 18–21): UI surfaces (roster / armory / shop / contract board)

**Deliverables:**
- Main menu (new run / continue / settings)
- Roster screen (operator list + dossier view)
- Armory screen (stockpile, per-operator loadout, advanced toggle visible)
- Shop screen (buy to stockpile, small rotating inventory)
- Contract board (pick from 2 available)
- Briefing screen (contract details, pre-deploy loadout pass)
- Debrief screen (results + casualty list + "replay" button hook)
- Keyboard navigation working (tab order + hotkeys per ADR 009)
- Dark theme styling, flat design, no diegetic chrome

**Checkpoint (hour 21):** Full flow: new run → roster visible → shop → armory (loadout with advanced toggle) → contract board → briefing → combat → debrief. No tutorial modals. Pass/fail #6 (10-min demo test) conceptually possible.

**Fails gate → cut list kicks in. Priority cuts: shop polish → advanced-mode toggle UI (keep mode working, trim the UI chrome) → second contract variant → debrief polish.**

---

## Block 8 (hrs 21–24): Replay + polish + kill-criteria validation

**Deliverables:**
- Replay from debrief: re-run from seed + inputs, render live
- Scrub to any tick
- All speeds on replay
- Determinism test across reload (save replay, quit app, reload, replay produces same hashes)
- Pass/fail criteria validation runs (spec/08 §six success criteria, each):
  1. Perf test — 3 contracts end-to-end, log fps, assert 60fps sustained
  2. LOS tactical test — run flanking and frontal scripted scenarios, visual review
  3. Wound accumulation test — scripted multi-hit, HUD review
  4. Loadout predictability test — 20 trials heavy-vs-light, assert >70% directional win rate
  5. Replay bit-identity test — automated
  6. 10-min demo test — record designer playing cold
- Fix-list for any failing criterion (time-permitting)

**Checkpoint (hour 24):** All six pass/fail criteria have a verdict (pass / fail / can't-test). The MVP is shippable to an internal reviewer.

**Fails gate → write the failures into a post-mortem in planning/risks.md, trigger triage (scope / architecture / content) per spec/08 framing.**

---

## Reserve & cut-list discipline

The schedule above assumes no disasters. In practice at least one block will slip. The **cut list** (ordered, cut from the bottom of the list first to preserve pillars):

1. Shop UX polish (raw buy-list is fine)
2. Advanced-mode loadout UI chrome (keep the data model authoritative, trim the toggle UX)
3. Second contract variant (one contract is enough to prove the loop)
4. Debrief polish (list of outcomes, no graphics)
5. Replay scrub (whole-replay-playback is enough)
6. Replay at all (determinism test still runs in CI without playback UI)

**Do not cut:**
- Sim core + determinism (pillar P4)
- Advanced-mode loadout data model (spec/08 non-negotiable #1)
- Production-shape roster (spec/08 non-negotiable #2)
- Stockpile separation (spec/08 non-negotiable #3)
- Per-impact wounds + bleed (spec/08 non-negotiable #4 and P4)
- LOS + three-tier vision (P4)

Cutting any "do not cut" item invalidates the MVP as a proof of the pillars. At that point the correct move is to extend the budget, not ship a hollowed MVP.

---

## Budget-slip triggers (when to call it and extend, not push through)

- Hour 6: sim core not deterministic → extend, don't build on unsound foundation
- Hour 12: loadout doesn't measurably affect combat → extend, P1 depends on this
- Hour 18: sim+rendering not at 60fps with 16 units → extend, P4 depends on this
- Hour 21: end-to-end flow not navigable → extend, pass/fail #6 depends on this

Other slips are absorbable via the cut list.

---

## Related

- spec/08 — MVP vertical slice (the target)
- planning/risks.md — risks (R1 is this plan's central concern; checkpoints trigger its kill-criterion)
- ADR 010 — tech stack (the scaffold this plan assumes)
- spec/05 — pillars (the hierarchy the cut list honors)
- spec/06 — loadout (block 4 implements this)
- spec/07 — combat sim (blocks 2–3–5 implement this)
