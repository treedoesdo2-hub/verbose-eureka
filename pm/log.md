# PM Log

Newest entry at top. PM appends; nothing here is ever rewritten.

Format: dated heading, terse bullets. Decisions, assignments issued,
reviews completed, escalations sent, escalations resolved.

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
