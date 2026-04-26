# Project Status Snapshot

**Refreshed:** 2026-04-26
**Refreshed by:** PM
**Branch:** `main` (de-facto and named — single trunk as of 2026-04-26)
**Remote:** `origin` → `github.com/treedoesdo2-hub/verbose-eureka`

> **Earlier versions of this file claimed "MVP shipped — 5/6 criteria
> green" based on `planning/mvp-retrospective.md`.** That was a prior
> agent's verdict against a prior agent's criteria. Steve has clarified
> his actual MVP bar (2026-04-26, see Definition below), and we are
> not at it.

---

## MVP definition (per Steve, 2026-04-26)

Two and only two things gate MVP. Quote:

> "Mapgen needs to produce maps comparable to Firefight. Unit AI
> pathfinding and decision making needs to possess enough fidelity
> to be an interesting autobattler. Those two things are MVP for me.
> Because everything else built on top of that is player-facing. The
> battles need to not suck and not look like they're happening on
> top of garbage."

### MVP Track A — Mapgen comparable to Firefight

- The bar is `refs/firefight.md`: top-down painted aerial terrain,
  tactical overlays as primary visual interest, varied biomes,
  utilitarian-mil chrome (we do NEON WIRE sci-fi reskin), tile-based
  baked-cover system.
- Currently we have: 4096²-tile mapgen pipeline (ADR 012), the COA-1
  through COA-8 phases (density-field scatter, cluster pruning,
  dominant lines, hero landmarks, marching-order spawn, contour bake,
  edge-barrier system, ADR 014 spawn model), and ADR 017 increment 1
  (perimeter walls + door + window stamping).
- Not yet: ADR 017 increments 2 (climb-window) + 3 (interior view);
  biome-varied wall kinds (only stone_wall_low); painted-aerial style
  pass; per-biome scatter / building variety beyond current stamps;
  side-by-side audit vs Firefight to surface concrete gaps.

### MVP Track B — AI good enough to be interesting

- The bar is `spec/07-combat-sim-architecture.md`. The MVP-relevant
  surface (per "interesting autobattler"): three-tier vision with
  alerted decay, last-seen memory, BT with all top-level states
  (Panic, Suppressed, Reacting, Patrolling — currently only
  Idle+Alerted are real), Battle Drill 1A sequence, stance system,
  continuous wound severity + aggregation, 5 blood thresholds,
  treatment states beyond untreated→stabilized, drag-to-cover
  recovery, cover-seeking behavior, suppression mechanic, real
  pathfinder (A*) replacing hand-authored waypoints.
- Currently we have: 30 Hz tick + determinism (replay hash holds),
  3v3 fights run end-to-end, hit/wound pipeline exists with
  simplifications, hand-authored waypoints, lean BT (Idle + Alerted),
  hardcoded standing stance, 4-enum wound severity, 1 blood
  threshold (downed at ≤30%), no last-seen memory, no alert decay.
- Honest coverage estimate: spec/07 surface is ~50%; the bones are
  right but the depth to feel "interesting" is not there yet.

### MVP-adjacent — Combat-view rendering

- The "battles need to not look like garbage" half of Steve's bar
  lives in the combat-view's PIXI render layer. Most recent commits
  are working this — ghost contacts, LOS edge vignette, 14-zone
  paperdoll, objective hex-rings, NEON WIRE rewrite. There is a
  Yard Assault crash from a render-loop bug (see Tier 1 below) and
  a Pixi child-leak in the same area; both block actually watching
  battles, and so block validating Tracks A and B.

### Explicitly post-MVP

Everything player-facing that is *not* the combat view:
- S1 main menu, S3 armory, S4 contracts, S5 briefing, S6 AAR,
  S7 ORBAT screens (the NEON WIRE polish is fine to continue, but
  no further investment gates MVP)
- Audio
- Save system / autosave
- Replay scrubber UI
- Death + meta-progression loop (Dwarfs-style)
- Powered armor / chassis-overlay second unit type
- Roster / dossier / shop screens

---

## What's actually shipped on `main` today

- Mapgen pipeline (ADR 012, 014, 017 inc. 1 — see Track A above)
- Sim core (deterministic, 30 Hz, worker-isolated)
- Loadout system (zone-grid packing, hand rules, stockpile, 14-zone
  paperdoll editor)
- Combat-view PIXI rendering (fancy chrome; has bugs — see Tier 1)
- 3v3 / Yard Sweep / Yard Assault end-to-end fight flow
- Determinism harness + replay foundation (no scrub UI yet)
- 63/63 sim tests green at last MVP-audit pass — needs re-running
  on current HEAD
- 17 ADRs; mature `decisions/DEFERRED.md`
- NEON WIRE rebrand on S1 / S3 / S4 / S5 / S6 / S7 / S2/S8

## Open quality issues (from Builder batch-1 review)

Full list in `reviews/2026-04-26-batch-1-findings.md`. Summary:
- **1 crash-class** bug — Yard Assault infinite render loop in
  `deploy.tsx:185-203` (auto-select effect on unstable refs).
  Blocks playing the game during casualties.
- **5 real bugs** including squads-store migration gap (legacy
  saves load with `branch=undefined`), armory primary weapons
  silently click-only, shift-swap mass-evicts non-conflicting items.
- ~15 UI / regression / dead-code findings.
- 5 more review batches dispatching against older work — findings
  pending.

## Open risks (active per `planning/risks.md`)

Most-relevant given new framing:
- **R3 — MWO-depth un-balanceable.** Defer until MVP fight loop
  is real enough to balance against.
- **R4 — autobattler + depth genre-bad.** Pending criterion #6
  manual playtest (which is itself gated on MVP being real).
- **R9 — hand-authored waypoints look scripted.** Active. Real A*
  is in MVP Track B.

R1 (24h budget), R7 (production-shape roster), R8 (pillar inversion),
R11 (scope creep), R12 (Electron packaging) — these were all 24h-
prototype-window risks; that window is closed. Move to "resolved"
when next touching `risks.md`.

---

## Parallel tracks

Steve runs two streams:
- **MVP track** (mapgen + sim/AI) — gates "shipped." PM prioritizes.
- **Polish track** (player-facing screens, design updates, NEON WIRE
  refinement) — Steve assigns directly to Builder. PM tracks but
  does not gate.

See `pm/CHARTER.md` for how the two are reconciled.
