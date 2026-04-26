# PM Log

Newest entry at top. PM appends; nothing here is ever rewritten.

Format: dated heading, terse bullets. Decisions, assignments issued,
reviews completed, escalations sent, escalations resolved.

---

## 2026-04-26 — operating rules locked + T-002 issued

- Steve confirmed two standing rules in chat:
  1. **BOARD.md is agent-only** — he doesn't read it. Questions for
     him go in chat. Saved as memory.
  2. **Git is fully autonomous** — "the git is your baby." Commit
     and push proactively, don't ask. Saved as memory.
- Steve also clarified the review batches were Builder-dispatched
  on his direct assignment (not unilateral). Reinforces the
  parallel-track structure already in `pm/CHARTER.md`.
- Issued **T-002 — Fix Yard Assault render-loop crash** in
  `pm/active/T-002-deploy-render-loop-fix.md`. Builder can pick up
  next session.
- Updated BOARD entry to record the operating-rule decisions
  (since Steve doesn't read it, this is for future-PM / Builder
  context).

---

## 2026-04-26 — re-based on actual MVP definition

- Steve clarified MVP: **mapgen comparable to Firefight + AI good
  enough to be interesting.** Quote: "The battles need to not suck
  and not look like they're happening on top of garbage." Everything
  player-facing is post-MVP per Steve. Saved as a memory.
- Earlier `pm/STATUS_SNAPSHOT.md` had quoted
  `planning/mvp-retrospective.md`'s "MVP shipped, 5/6 criteria green"
  claim. That was a prior agent's verdict, not Steve's. Re-wrote
  STATUS_SNAPSHOT to make this explicit.
- Re-based `pm/backlog.md` around the new framing. New tier
  structure: Tier 1 = MVP-blocking bugs (Yard Assault crash, squads
  migration, Pixi leak); Tier 2 = MVP Track A (mapgen); Tier 3 = MVP
  Track B (AI/sim depth); Tier 4 = combat-view rendering; Tier 5 =
  post-MVP (everything player-facing).
- Read `reviews/2026-04-26-batch-1-findings.md` from Builder. The
  Yard Assault crash, squads-store migration gap, and Pixi child-
  leak are MVP-blocking by Steve's bar. Other findings (armory
  drag-drop bugs, briefing chip wiring, decorative phantom data,
  etc.) are post-MVP polish.
- Amended `pm/CHARTER.md` to explicitly recognize Steve's
  parallel-track operating mode: he direct-assigns polish-track
  work to Builder verbally / in chat. This is no longer a charter
  violation — PM tracks post-hoc and prioritizes MVP-track over
  polish-track for Builder capacity, but does not gate Steve-direct
  assignments.

---

## 2026-04-26 — pushed to GitHub; tier-0 hygiene closed

- E1, E2, E3 all closed.
- Rewrote 117 commits to strip fake `(#NNN)` refs (E3=C). Kept the
  `(increment N)` markers from the buildings track. Used
  `git filter-branch --msg-filter` since `filter-repo` isn't installed.
- Renamed `mapgen-firefight-redesign` → `main`; deleted `master` (E2=A).
- Committed PM scaffolding as `758b876` on a clean message.
- Initial push to `https://github.com/treedoesdo2-hub/verbose-eureka.git`
  via GCM browser auth. PM had given up on the push prematurely the
  first time — the GCM dialog was sitting behind the terminal the
  whole time. Saved as a feedback memory.

---

## 2026-04-26 — board + ADR rule

- Steve clarified: **all ADRs originate from him**, even when relayed
  through the Builder. Updated `pm/CHARTER.md` decision matrix and
  escalation triggers; updated `pm/PROTOCOL.md` ADR section. Renamed
  `pm/templates/ADR_PROPOSAL.md` → `pm/templates/ADR_CAPTURE.md` and
  rewrote it to reflect the new flow (PM/Builder capture, never
  originate). Added rule #9 to `CLAUDE.md` hard rules.
- Created `BOARD.md` at repo root for free-form back-and-forth.
  Pointed at it from `CLAUDE.md` and `pm/PROTOCOL.md`.

---

## 2026-04-26 — PM role established

- PM role assumed at User direction.
- Surveyed `software development for retards` library (Documents/...).
  Strongest principles to import: short-lived branches with daily
  rebase, four-tier quality gates, structured-written comms only,
  vertical slicing, scope kill-criteria, ADRs as canonical decisions,
  CLAUDE.md as session-handoff protocol.
- Surveyed repo. Findings:
  - MVP shipped (`planning/mvp-retrospective.md`); 5/6 criteria green.
  - NEON WIRE rebrand shipped across S1–S8 (commits `08271fa`, `9664316`,
    `d5135a6`, `17e2d29`, `68a7e6f`, `a007c17`).
  - ADR 017 increment 1 done; 2 + 3 outstanding.
  - 17 ADRs, robust deferral log, mature spec set.
  - README is stale ("Phase 0") — backlog T-002.
  - No git remote. Branch `mapgen-firefight-redesign` is de-facto trunk;
    `master` is named trunk and is fossil. 49 commits ahead, 0 merges
    back. T-001.
  - Historical commits contain fabricated PR numbers (`(#280)`,
    `(#288 / #478)`, `(#291 / #514)`, etc.) — going forward forbidden,
    history left as-is.
- Wrote PM scaffolding: `pm/CHARTER.md`, `pm/PROTOCOL.md`,
  `pm/STATUS_SNAPSHOT.md`, `pm/backlog.md`, `pm/log.md`, this file,
  `pm/escalations.md`, `pm/templates/ASSIGNMENT.md`,
  `pm/templates/ADR_PROPOSAL.md`. Created empty `pm/active/`,
  `pm/review/`, `pm/done/`.
- Wrote `CLAUDE.md` at repo root for any-agent session boundaries.
- Issued three escalations to User (see `pm/escalations.md`):
  E1 GitHub remote setup, E2 master/main reconciliation, E3 fabricated
  PR numbers retroactive policy.
- No assignments issued yet. Tier 0 hygiene first; T-001 will be issued
  once User confirms the GitHub repo URL.
