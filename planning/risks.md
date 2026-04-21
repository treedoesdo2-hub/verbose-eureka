# Risk Register

Live register of risks that could invalidate MVP or the broader project thesis. Each risk has: likelihood (L/M/H), impact (L/M/H), kill-criterion (what observation proves it's fatal), and mitigation (cheap action we can take now or early in MVP to reduce it).

This document is meant to be updated as we learn. "Kill-criterion" is deliberately concrete — it's the observation that triggers a pivot, not a subjective judgment call.

---

## R1 — 24hr AI-effort budget is insufficient for the MVP scope

**L: H · I: H**

The MVP as spec'd (spec/08) is large for 24hr continuous AI-driven coding: full advanced-mode loadout, real sim, wound/bleed model, 8 UI surfaces, replay, determinism. AI velocity is high but not unlimited, and integration/debug friction is real.

**Kill-criterion:** At hour 16 checkpoint (see planning/prototype-plan.md), if combat sim is not running end-to-end with at least placeholder loadouts and rendering, we are not going to ship the full MVP in the remaining 8 hrs — we either extend the budget or cut scope.

**Mitigation:**
- Rigid hour-by-hour plan (prototype-plan.md) with explicit checkpoints
- Build order: sim core → loadout data model → rendering → UI. The sim is the proof; UI is the frame around it.
- Pre-committed cut list (ordered): debrief polish → shop UX → advanced-mode toggle → second contract variant → replay scrub → replay at all. Keep cutting in that order to preserve the pillars.
- Hand-authored waypoints instead of tile A* (already in spec/08) is one such cut already taken.

---

## R2 — Combat sim TypeScript perf ceiling lower than target scale

**L: M · I: H**

ADR 010 puts the sim in TS-in-Worker as starting assumption with Rust/WASM as escape hatch. MVP target is 12–16 units on the screen at 4x speed at 60fps on mid-range laptop. Our longer-term scale target is battalion (hundreds).

**Kill-criterion (MVP-scope):** Sim cannot hold 60fps with 16 units at 4x speed on mid-range laptop after sensible TS profiling and obvious wins (object pooling, typed arrays, avoiding allocations in tick loop). This is pass/fail #1 in spec/08.

**Kill-criterion (project-scope):** After best-effort TS optimization *and* Rust/WASM port of the hot path, sim still cannot hold 60fps at battalion scale. This would invalidate ADR 010's stack choice.

**Mitigation:**
- MVP scale is well under project-scope scale — we're not testing battalion in the MVP. If MVP perf is fine at 16, we defer battalion-perf decisions.
- Sim architecture (spec/07) is already structured to be port-friendly: pure-function tick, seeded RNG, no DOM access. Porting hot path to Rust is mechanical if needed.
- Profiling is built into the MVP plan (hour 18 checkpoint): measure, don't guess.

---

## R3 — MWO-depth loadout is un-balanceable in practice

**L: M · I: H**

Our P1 pillar is MWO-depth customization. MWO itself has famous balance problems despite a decade of tuning. At our team size (AI + one human designer), balance might collapse into dominant strategies that make loadout choices performative rather than meaningful.

**Kill-criterion (MVP):** Pass/fail #4 is "loadout changes measurably affect fight outcome" with directional-predictability test. If loadout becomes noise-indistinguishable from random (heavy-armor doesn't reliably beat light-mobility in static engagements, or vice versa in maneuver scenarios), the mechanic is broken.

**Kill-criterion (project):** In post-MVP playtesting, a single loadout archetype wins >80% of engagements across diverse scenarios. This means the depth is fake and the player will rationally collapse to one build.

**Mitigation:**
- Pillar hierarchy (P4 combat sim is soul, P5 is tiebreaker; P1 customization is the headline) means we can adjust balance by tuning combat-sim parameters without re-architecting. The sim is the balance lever.
- Data-driven gear spec (Zod-validated JSON per ADR 010) means rebalance is a JSON diff, not code.
- Build a sim-replay harness (matrix of loadout pairings, auto-run, aggregate outcomes) as a post-MVP tool to surface dominant strategies before players find them.

---

## R4 — "Pure autobattler" + "MWO-depth" is genre-fit-bad

**L: M · I: H**

This is the project-thesis risk. Autobattlers historically ship light customization by design — the genre reward is in the draft/synergy loop, not in building deep loadouts for units. Our bet is that combining deep pre-fight loadout with sim-driven autobattle is a novel space. It might also just be boring — the player spends 20 minutes in the armory then watches 3 minutes of combat, and the combat doesn't feel connected to their loadout choices.

**Kill-criterion (MVP):** Pass/fail #6, the 10-minute demo test, fails — specifically the "I get what this game is" verbal. If a new player emerges from one contract not understanding why they'd spend time in the armory, the loop is broken.

**Kill-criterion (project):** In post-MVP playtesting, players skip the armory / pick templates only / don't engage with advanced mode at all. This would mean our P1 pillar isn't actually desired.

**Mitigation:**
- Progressive disclosure (ADR 002): default-mode templates are the primary surface; advanced mode is opt-in. If players never toggle advanced, they still have a working game — we just lose the P1 depth differentiation and need to reconsider pricing/positioning.
- Combat view HUD must make loadout choices *visually legible* (visible wound zones matching armor placement, visible weapon ballistics). If the combat view doesn't show the connection, the connection is invisible regardless of how deep the sim is.
- Wound/bleed system is the visceral feedback that ties loadout to outcome — you can see the shot that went through light armor at the gap, you see the bleed starting. The combat-loadout connection is the feature.

---

## R5 — Per-impact wound + bleed-out is UI-illegible at 4x speed

**L: M · I: M**

spec/07 mandates per-impact wound instances with bleed rate per wound, per-zone wound arrays, visible blood volume bar. At 4x speed, the player might not be able to follow what's happening at the wound level — events scroll by too fast, and the HUD becomes noise.

**Kill-criterion (MVP):** Pass/fail #3 — "wounds accumulate per-impact with visible bleed HUD" — fails its observability requirement. If a designer watching combat at 4x can't tell whether an operator's deterioration is from one bad hit vs five small ones, the wound model is internally correct but externally indistinguishable from an HP pool. The mechanic's pillar value is destroyed by illegibility.

**Mitigation:**
- Speed controls (ADR 006) — player can drop to 0.5x to see events when they matter. 4x is the default cruise, not the only mode.
- Wound events push to a timeline log per unit (scrollable, paused in debrief). The live HUD shows summary; the log has detail.
- Replay + scrub (spec/08 scope) lets players reconstruct what happened after the fact. Observability doesn't have to be real-time.

---

## R6 — Determinism breaks in subtle ways we miss

**L: M · I: H**

Seeded RNG and deterministic replay are non-negotiable (spec/08 non-negotiable #5). Determinism is famously easy to break in JavaScript — Map/Set iteration order, Object key order, floating-point cross-CPU drift, async scheduling, Math.random fallbacks. One library that uses Math.random internally can silently poison the sim.

**Kill-criterion:** Same seed + same inputs produces divergent replays. This is a binary failure; partial determinism is not determinism.

**Mitigation:**
- Every RNG call routed through the seeded PRNG; `Math.random` banned in Worker code (linter rule, day 1).
- Dependency audit before pulling anything into the Worker — if a package imports lodash or faker or any randomness, it doesn't go in the sim.
- Replay test in CI from day 1: run match, record final state hash; replay from seed, compare hash. Detect divergence immediately.
- No async in tick loop. All work per-tick is synchronous.

---

## R7 — "Production-shape roster" takes longer than we expect

**L: M · I: M**

spec/08 non-negotiable #2: roster system is production-shape, not hardcoded. This means real data pipeline (Zod schemas, JSON files, hire/fire/view flows, persistence through save system) in the MVP. This is more engineering work than a hardcoded list.

**Kill-criterion:** At hour 20, the loadout UI still can't iterate a list of operators from the stockpile/roster store. At this point the production-shape requirement has cost us so much MVP time that we'd cut it, but cutting invalidates the MVP as a proof of thesis.

**Mitigation:**
- Data pipeline is a day-1 task (prototype-plan.md hour 1–2): define the schema, load the JSON, confirm the end-to-end path before anything else. If this takes >3 hrs, we have a stack problem to surface immediately.
- Roster is ~10 operators authored by hand in JSON — the data volume is tiny. The schema and loader are what cost effort; the content is cheap.
- Zod is chosen specifically for load-time validation so shape bugs surface immediately on load, not 6 UI layers deep.

---

## R8 — Pillar hierarchy gets inverted by polish instincts

**L: M · I: M**

P4 (combat sim fidelity) is the soul; P5 (info density) is the tiebreaker. The risk is that during 24hr execution we over-invest in UI polish (P5 territory) because UI bugs are easier to see than sim bugs, and neglect sim correctness (P4 territory) because sim bugs surface later and are harder to detect.

**Kill-criterion:** At MVP review, UI feels polished but pass/fail #2 (LOS cones visibly tactical) and #3 (wounds accumulate) are failing. We shipped the frame without the painting.

**Mitigation:**
- Build order is sim → loadout data → rendering → UI. Sim runs before any UI exists.
- Pass/fail criteria in spec/08 are weighted toward sim observations (4 of 6 are sim-behavior), not UI polish. Honor the criteria.
- Hour 20 checkpoint: if sim is not passing its criteria, freeze UI work and finish sim. UI is recoverable in a patch; sim architecture is not.

---

## R9 — Hand-authored waypoint pathing looks scripted

**L: L · I: M**

spec/08 MVP shortcut: CL-inspired hand-authored waypoints instead of real pathfinding. Risk is that watching combat, the routes feel pre-canned — operators take the same paths contract-to-contract, flanks happen in the same spots, the combat feels like watching a cutscene rather than an emergent engagement.

**Kill-criterion:** During MVP review, a designer watching a contract says "the AI is running a script" within the first 3 engagements. The waypoint pattern is visible.

**Mitigation:**
- Already has a kill-switch in spec/08 — pivot to tile-A* with cached precompute, ~2hrs budget.
- Two contract variants on the same map specifically exist to vary enemy composition / spawn locations, which breaks static pathing patterns.
- Waypoints are per-behavior, per-role — a rifleman advancing and an LMG holding use different routes; an alerted unit overrides waypoint with local reactive steering. Not as scripted as it sounds, but if it reads scripted, the kill-switch is the answer.

---

## R10 — Endless-campaign fatigue (post-MVP, thesis risk)

**L: M · I: H (for full game)**

ADR 008 commits to endless campaign — no victory condition. Death + meta-unlock (the Dwarfs model) is meant to create loop longevity. If the meta loop isn't compelling enough, or if the combat doesn't stay interesting after 20–30 contracts, the game has no structural end to lean on and becomes a boredom trap.

**Kill-criterion:** Not MVP-detectable. Post-MVP, measured as playtester session-length falling off a cliff around contract 15–20 with "I've seen everything" sentiment.

**Mitigation (deferred to post-MVP):**
- Dwarfs-model glory / death / next-campaign structure needs concrete implementation
- Gear rarity tiers, procedural contract variants, faction rep unlocks all feed the "seen everything" horizon
- Track this risk after MVP passes; pre-MVP it's not actionable

---

## R11 — Scope creep during 24hr window

**L: H · I: M**

The spec has grown during requirements clarification. Inside 24hr execution, the temptation to "just add this one thing" is high. One-small-feature-at-a-time is how 24hr budgets become 48hr budgets.

**Kill-criterion:** At hour 12, we are working on something not explicitly in spec/08 "in scope" list, and no kill-criterion triggered its addition.

**Mitigation:**
- Scope is locked by spec/08 "in scope" and "out of scope" lists before execution starts. If it's not in "in scope," it's out.
- Ideas for scope additions during execution get written to planning/backlog.md (to-be-created), not implemented.
- "In scope + on critical path" gets priority over "in scope + nice-to-have" — if we're running out of time, we cut nice-to-haves first, not core sim.

---

## R12 — Electron install / packaging eats budget on day 1

**L: L · I: M**

ADR 010 locks Electron. Electron projects are notorious for first-day setup friction (native modules, code signing, asset bundling, OS-specific quirks). If hour 1–3 are lost to build tooling rather than code, the whole budget slips.

**Kill-criterion:** At hour 4, the app does not run a "hello world" React page inside Electron with Vite HMR working.

**Mitigation:**
- Use `electron-vite` starter (chosen in ADR 010 explicitly for this reason) — it eliminates most hand-wiring.
- No native modules in MVP (JSON saves, not SQLite; no better-sqlite3). The Electron install should stay stock.
- If at hour 4 the app isn't running, that's a clear architecture smell — investigate rather than push through.

---

## Summary table

| ID | Risk                                              | L | I | MVP-relevant? |
|----|---------------------------------------------------|---|---|---------------|
| R1 | 24hr budget insufficient                          | H | H | Yes           |
| R2 | TS sim perf ceiling                               | M | H | Yes           |
| R3 | MWO-depth un-balanceable                          | M | H | Yes (pf #4)   |
| R4 | Autobattler + depth is genre-bad                  | M | H | Yes (pf #6)   |
| R5 | Wound/bleed UI-illegible at speed                 | M | M | Yes (pf #3)   |
| R6 | Determinism breaks subtly                         | M | H | Yes (pf #5)   |
| R7 | Production-shape roster takes too long            | M | M | Yes           |
| R8 | Pillar hierarchy inverted by polish instinct      | M | M | Yes           |
| R9 | Hand-authored waypoints look scripted             | L | M | Yes           |
| R10| Endless-campaign fatigue                          | M | H | Post-MVP      |
| R11| Scope creep during 24hr window                    | H | M | Yes           |
| R12| Electron packaging eats hour 1–3                  | L | M | Yes           |

## Related

- spec/08 — MVP pass/fail criteria (R2–R8 map to these)
- planning/prototype-plan.md — hour-by-hour plan with R1/R12 checkpoints
- ADR 010 — tech stack (source of R2, R6, R12)
- spec/05 — core pillars (source of R4, R8 hierarchy)
