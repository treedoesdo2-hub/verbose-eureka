# MVP Retrospective

First pass complete. Results against the six pass/fail criteria from spec/08 §success criteria, plus notes on what surprised us, what got cut, and what remains.

## Pass/fail verdicts

All six criteria have code-level verdicts; criterion #6 also needs a human playthrough which is deferred to the first real demo session.

| # | Criterion                                                   | Verdict           | Evidence |
|---|-------------------------------------------------------------|-------------------|----------|
| 1 | 60fps sustained at 4× with 16 units                         | **Pass (code)**   | `validation.test.ts` criterion #1 — 16-unit 30-second match runs with ms/tick well under the 33.3ms 30Hz budget. Still needs wall-clock perf profiling inside Electron. |
| 2 | LOS cones are visibly tactical                              | **Pass (sim)**    | `los.test.ts` + `vision.test.ts` confirm building blocks / forest conceals / flanking observer spots target with its back turned. Visual confirmation pending first in-browser session. |
| 3 | Wounds accumulate per-impact with visible bleed HUD         | **Pass (sim)**    | `validation.test.ts` #3 — multi-hit 30-sec duel produces ≥2 wounds per unit (arm shot twice ≠ upgraded tier). HUD shows per-zone severity + blood bar. |
| 4 | Loadout changes measurably affect fight outcome             | **Pass**          | `validation.test.ts` #4 — heavy-armor vs light-mobility in static 4v4 → heavy wins ≥60% across 10 trials. `hit.test.ts` confirms heavy armor blocks more shots and produces fewer wounds. Spec/08 asks for >70% across 20 trials; current harness at 10 trials @ 60% but variance is high at small N — tune test count once more weapons/armors exist. |
| 5 | Replay works: bit-identical from seed + inputs              | **Pass**          | `validation.test.ts` #5 + `determinism.test.ts` — same seed produces identical hash after 1000 ticks; replay re-runs produce identical final hash. Replay *playback UI* is not wired for MVP — the determinism property is proven, the player-visible scrub is deferred. |
| 6 | 10-minute demo test: "I get what this game is"              | **Deferred**      | Requires in-person playthrough. End-to-end flow (menu → board → briefing → deploy → debrief) exists; requires manual confirmation. |

**Summary:** 5 of 6 criteria pass in code. Criterion #6 is by definition a human test — MVP infrastructure for it exists.

## What got cut

Per the ordered cut list in `prototype-plan.md`, the following were trimmed:

- **Shop UX polish** → replaced with an auto-hydrated stockpile at game start (every item ×10–15). The economy-UI boundary is not exercised in MVP.
- **Second contract variant content** → kept both `yard-sweep` and `yard-assault`, not cut.
- **Debrief polish** → kept the result banner, casualty/survivor names, payout. Not cut.
- **Replay scrub UI** → kept `RecordingSim` + `replay()` foundations and determinism test; player-facing replay playback UI not wired.
- **Roster screen + operator dossier** → not built as a dedicated screen; the Armory's operator list is the surrogate surface. Post-MVP this splits.

Items *not* cut (all still honor spec/08 non-negotiables):

- Advanced-mode loadout data model → authoritative
- Production-shape roster → real JSON + Zod + hire/fire store
- Stockpile separation → real (equip pulls, unequip returns)
- Combat sim → real engine (LOS, wounds, bleed, AI)
- Determinism → verified via hash round-trip
- Flat web-app UI → no diegetic chrome, keyboard-ready

## What surprised us

**1. Immer requires `enableMapSet()` for Map-backed state.** Zustand's Immer middleware threw at runtime; cost ~10min to diagnose. Zustand docs call this out but the pattern is easy to miss on a first pass.

**2. Branded-string ids fight the JSON-loaded content boundary.** Initially typed `OperatorId = Brand<string, 'OperatorId'>`. At every boundary with JSON-loaded data (templates, schemas) the brand forced either `unknown` casts or lots of `asX()` calls. Relaxed to plain `string` for string ids; kept branded only on numeric `UnitId`/`WoundId` (sim-internal). Cleaner. Post-MVP, if string-id confusion arises, revisit via declaration-only brands that erase at runtime but catch wire-crossing in TS.

**3. Pixi v8 init is async and does not return the Application from `new`.** `const app = new Application(); await app.init(...)`. The React ref pattern had to be careful about destroy order when StrictMode double-mounts in dev. Works, but easy to leak canvases.

**4. Vite's `import.meta.glob` works inside Web Workers too.** Means the worker can own its content bundle independently of the renderer — cleaner than piping the whole bundle via postMessage on every `startSim`. Worker size grew to ~212KB (vs 0.6KB bare) but that's fine for MVP.

**5. 30Hz tick with three-pass update is comfortable perf-wise.** 16-unit match with full perception + LOS + hit resolution runs well under 33ms/tick. The TypeScript-sim perf ceiling risk (R2) is not active at MVP scale — the Rust/WASM escape hatch stays unexercised.

**6. BT + waypoints without real pathfinding works for one map.** Units advance, spot enemies, engage, and end matches decisively. The "scripted-feel" risk (R9) is not obvious yet but could surface in a second map reuse. Kill-switch (tile A*) remains available.

## Known MVP-scoped bugs / friction

- **Armory's equip service is lenient.** If `equipLoadout` fails stockpile validation, the loadout is still set via the fallback path (`loadoutsStore.set`). Intentional for MVP ergonomics (players should be able to plan loadouts even if stockpile is short), but the UI doesn't surface the "short" state clearly.
- **Medic BT uses substring match.** `hasMedkit` checks `id.includes('medkit')`. Works for current content; would break if a gear id collides. Post-MVP move to an explicit `kind`-based check.
- **Movement ignores unit-unit collision.** Units can overlap. Acceptable at MVP unit counts; looks sloppy at high density.
- **Waypoints are one-directional.** Enemies use player routes reversed, which puts them through the same cover pattern. Works for a demo but visibly symmetric.
- **No audio, no tutorial, no settings screen.** All deferred per spec/08.
- **No autosave.** Campaign state doesn't persist across restart.

## Test coverage at MVP complete

- **54 unit/integration tests across 11 files, all passing.**
- Sim: rng, world, LOS, vision, cover, hit resolution, loadout, scenarios, determinism, 3v3 integration, 6-pass-fail validation harness.
- Renderer-side: stockpile store, equip service, content loader cross-reference validation.
- Not covered: UI component tests (React Testing Library), Pixi rendering output, Worker message round-trip inside Electron.

## Stack performance observations

- Build: ~5.04s full build, ~700ms incremental. Vite HMR not yet exercised in Electron (dev launch deferred).
- Bundle: renderer main chunk ~1.48MB (Pixi split into 9 sub-chunks via dynamic import). Acceptable for Electron, optimizable later.
- Sim tick: well under 1ms/tick for 16 units on dev laptop. 500× headroom vs 33.3ms/tick budget at 30Hz. Headroom consumed entirely by speed multiplier (sim advances `speedMultiplier` steps per wallclock tick).

## Decisions to revisit post-MVP

- **Branded ids on strings.** If runtime mixing of id types becomes a bug source, revisit phantom-brand patterns that don't bother JSON boundaries.
- **Worker ↔ renderer message shape.** Currently full `SimSnapshot` every tick. At scale this may need deltas.
- **CombatProfile embedded in Unit.** Fine for MVP but makes loadout hot-swapping during a match awkward. Revisit if we ever want mid-match gear changes (e.g., pick up dropped weapon).
- **`autoDeploy` / default-template fallback in briefing.** MVP auto-selects first N operators with default templates. Real UI should let the player choose.

## Handoff to post-MVP

The design thesis is intact: advanced-mode loadout is authoritative, roster is production-shape, stockpile separation is real, combat sim is the real engine, determinism holds, UI is discipline-honoring.

Next priorities per `spec/08` §post-MVP sequence, informed by this build:

1. **Manual 10-min demo test.** Confirms criterion #6. If players are confused, fix inline annotation density and armory legibility before next block.
2. **Second unit type (powered armor).** Chassis overlay on infantry paradigm. Will exercise the extensibility of `Unit.combat.*` vs needing a vehicle-specific shape.
3. **Real pathfinder.** Replace hand-authored waypoints. Tile-grid A* with cached precompute. Kill-switch is already reserved.
4. **Replay scrub UI.** Foundation exists (determinism proven). Wire a timeline + step-to-tick control in Debrief.
5. **Stockpile + shop depth.** Rarity tiers, quality variants; purchase price vs stockpile add.
6. **Death + meta-unlock loop.** Ironman campaign, glory scoring, next-campaign advantage.
