# Project Status Snapshot

**Refreshed:** 2026-04-26
**Refreshed by:** PM
**Branch (de-facto trunk):** `mapgen-firefight-redesign`
**Branch (named trunk):** `master` (stale)
**Remote:** none yet (User setting up GitHub 2026-04-25)

> The README still says "Phase 0 — pre-spec." That is wildly stale.
> Updating the README is on the backlog. Until then, treat THIS file
> as the authoritative state.

---

## Where the project actually is

**MVP shipped.** Per `planning/mvp-retrospective.md`: 5 of 6 spec/08
pass/fail criteria pass in code; criterion #6 (manual 10-min demo
verbal) is by definition User-only and pending.

**NEON WIRE rebrand shipped across S1–S8.** ADR 016 originally deferred
S5 briefing and S2/S8 combat; both have since landed:
- S5 NEON WIRE briefing — `08271fa`
- S2/S8 combat — multiple commits (`9664316`, `d5135a6`, `17e2d29`)
- S6 AAR squad-position scrubber + comms / commendations / intel — `68a7e6f`
- S3 armory polish (drag-drop, modifiers, crit slots, quick unequip) —
  `a007c17`

**Mapgen + structures track in flight.** ADR 017 (buildings as structures)
shipped increment 1 (perimeter + door + window stamping). Increments 2
(climb-window mechanic) and 3 (interior view) are committed-to follow-ons,
not yet started in earnest.

**Sim depth is intentionally partial.** `mvp-audit.md` notes spec/07 is
~50% — suppression, panic, stance, last-seen memory, alert decay, 5 blood
thresholds, wound aggregation, battle drill 1A, drag-to-cover all
absent. These are post-MVP per spec/08 but several are Tier 5 in the
backlog.

**Tests:** 63/63 green at last MVP audit pass. Need to re-run on current
HEAD (PM has not verified locally yet).

---

## What's open

### Tier 1 (ship-blocker for 1.0) — from `planning/post-mvp-backlog.md`

- Real pathfinder (tile A* with cached precompute) — replaces
  hand-authored waypoints
- Powered armor unit type — first chassis-overlay test
- Death + meta-progression loop (Dwarfs-style glory on death)
- Save system (single autosave for 1.0)
- Replay playback UI (foundation built; scrub bar + tick stepper needed)
- Audio (gunfire, impact, death; ambient combat)
- Manual 10-min demo test — User-only

### In flight

- ADR 017 increment 2 (climb-window) — not started
- ADR 017 increment 3 (interior view) — not started

### Hygiene debt (PM concerns)

- README.md is stale — says Phase 0
- Branch `mapgen-firefight-redesign` is the de-facto trunk; `master` is
  the named trunk; should reconcile post-GitHub
- 49 commits ahead of master with zero merges back — needs a single
  consolidating merge once history rewriting is decided
- Some commits reference fabricated PR numbers (`(#280)`, `(#288 / #478)`,
  etc.) — historical, can't be undone, but going forward forbidden

### Active deferrals (`decisions/DEFERRED.md`)

15 active entries. Most relevant to near-term work:
- S9 theater map — wait until MVP post-mortem
- Loadout presets / templates / save / load
- Combat-load → STAM/MOVE sim coupling
- Drone overwatch real mechanic
- Comms transmissions schema
- Decision queue real wiring

---

## Open risks (from `planning/risks.md`)

- **R3 — MWO-depth un-balanceable.** Active. Pass/fail #4 is currently at
  60% across 10 trials; spec asks for 70% across 20. Variance is high at
  small N.
- **R4 — autobattler + depth genre-bad.** Pending criterion #6 (User-only
  playtest).
- **R5 — wound/bleed UI-illegible at 4×.** Pending playtest.
- **R10 — endless-campaign fatigue.** Post-MVP risk; not yet detectable.

R1, R7, R8, R11, R12 (MVP-scoped budget / shape risks) are now retired by
MVP shipping; PM will move them to a "Resolved" section in `risks.md` as
a backlog hygiene item.

---

## What PM is doing this week

1. Spinning up the PM ↔ Builder protocol (this commit).
2. Drafting the first assignment (`T-001` — TBD; see `pm/backlog.md`).
3. Awaiting User on three escalations — see `pm/escalations.md`.

PM will refresh this snapshot at the top of each new working session and
on every milestone (assignment closed, ADR ratified, milestone shipped).
