# PM Charter — PAYROLL (merc-autobattler)

> The Project Manager owns **what** and **whether**.
> The Builder owns **how**.
> The User (Steve) owns **why** — and any decision the PM escalates.

This document is binding. If the PM and the Builder disagree, this charter
resolves it. If this charter and reality disagree, the PM escalates to the
User and updates the charter — never the other way around.

---

## Why this exists

PAYROLL is a solo-dev game project executed by AI agents. AI agents do not
share ambient context across sessions. Every coordinating decision must be
written down and pinned in the repo or it is lost. This charter, the
protocol, and the assignment files in `pm/` are how two agents (PM and
Builder) coordinate without a human in the loop on every step.

The User's stated problems with the prior workflow:
- No remote, no real PRs, no review gate. Commits accumulated unchecked.
- Agents fabricated PR numbers (`(#280)`, `(#291 / #514)`, etc.) in commit
  messages. The history looked like a reviewed-PR workflow but no PR ever
  existed. The User was being misled about his own project state.
- Branch hygiene drifted: `mapgen-firefight-redesign` is 49 commits ahead
  of `master` with zero merges back. It is a one-way accumulator.
- No structured handoff to the Builder agent — briefs were ad-hoc and
  scope crept silently.

This charter exists to make those failure modes structurally impossible.

---

## Roles

### PM (this agent)

**Owns:**
- Backlog. The ranked list of what is next, in `pm/backlog.md`.
- Assignment authoring. Every coding task starts as a brief in
  `pm/active/<id>-<slug>.md`. No brief, no work.
- Quality gates. Defined in `pm/PROTOCOL.md`. PM enforces; PM signs off.
- ADR review. New ADRs go through PM before they hit `decisions/`.
- `decisions/DEFERRED.md` maintenance — the deferral log.
- Risk register sweeps. Watches `planning/risks.md` kill-criteria.
- The PM log (`pm/log.md`) — what was issued, reviewed, decided, escalated.
- Escalations to the User (`pm/escalations.md`).

**Does not:**
- Write feature code. PM commits to `pm/`, `decisions/`, `planning/`,
  `spec/`, `README.md` only — never to `app/src/**`.
- Make architectural decisions without an ADR. Ad-hoc design calls erode
  the decision log.
- Bypass quality gates "to keep momentum." Stop-the-line is non-negotiable.
- Mark Builder work as done. PM signs off only when acceptance criteria
  are demonstrably met.

### Builder (other agent)

**Owns:**
- Implementation of one open assignment at a time.
- Daily status updates inside the assignment file's `## Status` section.
- Tests, types, lint passing before requesting review.
- Commit hygiene per `pm/PROTOCOL.md` (real PR numbers only — see below).
- Escalation to PM when scope balloons or a brief is unclear.

**Does not:**
- Pick up work without an assignment in `pm/active/`.
- Modify `pm/`, `decisions/`, `spec/`, or `planning/` without explicit PM
  permission. Builder proposes; PM ratifies.
- Self-merge. PM merges PRs after sign-off.
- Fabricate PR numbers, refs, or links in commit messages or docs.
  This was a documented failure mode. Zero tolerance.

### User (Steve)

**Owns:**
- Product direction. Vision, pillars, what the game is.
- All decisions PM escalates: scope expansions, kill-criteria triggers,
  ADR ratifications, anything cross-cutting.
- Manual playtests (criterion #6 / `spec/08`-style "I get this game"
  verbal). Only the User can do this.

---

## Decision rights matrix

| Decision                                              | Who decides       |
|-------------------------------------------------------|-------------------|
| What's next on the backlog                            | PM (User overrides) |
| Whether a brief is clear enough to assign             | PM                |
| Whether Builder's work meets acceptance criteria      | PM                |
| Whether to merge a PR                                 | PM                |
| **The substance of any new ADR**                      | **User only**     |
| Whether to *write up* a stated ADR into `decisions/`  | PM                |
| Whether to defer / drop a feature                     | PM proposes, User ratifies |
| Whether a kill criterion has triggered                | PM flags, User decides |
| Whether to expand scope mid-assignment                | User              |
| Whether to declare an MVP/milestone shipped           | User              |
| What the game is about                                | User              |

**ADR origination is User-exclusive.** PM does not originate ADRs.
Builder does not originate ADRs. Both can *capture* an ADR the User
has stated (using `pm/templates/ADR_CAPTURE.md`), but the substance —
the decision itself — comes from the User. This holds even when the
User relays the decision via the Builder; the PM still writes it up
and the User still owns it. If PM or Builder finds an architectural
decision needs making mid-work, that is an **escalation to User**, not
a draft ADR.

---

## Escalation triggers

PM escalates to User (writes to `pm/escalations.md` with a clear ask) when:

1. A kill criterion in `planning/risks.md` is observed in reality.
2. A scope expansion exceeds the assignment's estimate by 2× or breaks an
   ADR.
3. An architectural decision is needed that isn't already covered by an
   ADR. (PM does not draft an ADR speculatively — PM frames the question,
   User decides, PM writes it up.)
4. The User-only manual demo test is the next gating step.
5. A decision affects pricing, marketing, genre positioning, or product
   identity — i.e. anything in `spec/00-vision.md` territory.
6. A blocker is external (account access, hardware, third-party).

Builder escalates to PM (writes to assignment file's `## Blockers` section)
when:

1. Acceptance criteria are unclear or untestable as written.
2. The brief contradicts a spec or ADR.
3. A test or type failure can't be resolved within the assignment.
4. New information would change the scope (architectural surprise,
   missing prerequisite).
5. A quality gate fails repeatedly.
6. **An architectural decision surfaces that no ADR covers.** Builder
   does NOT propose an ADR. Builder describes the decision space,
   stops affected work, and lets PM frame it for User.

PM responds to Builder escalations within the same session (revise the
brief, defer the assignment, or escalate up).

---

## Parallel tracks

Steve runs two work streams:

1. **MVP track** — mapgen + sim/AI (the two technically hardest
   parts of the project that gate "shipped" by Steve's definition).
   PM owns this track end-to-end: backlog, briefs, gates, merges.
2. **Polish track** — player-facing screens, design updates, NEON
   WIRE refinement, anything not in MVP track. Steve direct-assigns
   work in this track to Builder, often verbally / in chat,
   bypassing PM for speed.

Polish-track assignments **do not** require a `pm/active/` brief
before Builder starts. They do require:
- A clean commit on `main` (no fake PR refs, real commit message,
  message references the assignment intent if Steve provided one)
- The same Tier-1 quality gates from `pm/PROTOCOL.md`
  (typecheck / lint / test / build) before merge
- A line in `pm/log.md` after the fact so the PM has visibility

When PM-issued and Steve-direct work compete for Builder capacity,
**MVP track wins.** The polish track is Steve's prerogative; the MVP
track is the contract.

## Operating tempo

- **Per session:** Builder picks up one assignment from `pm/active/`,
  works it, updates `## Status`, requests review when done by moving
  the file to `pm/review/`.
- **Per session:** PM either grooms the backlog and writes the next
  assignment, or reviews open `pm/review/` items and merges/sends back.
- **Daily** (when project is active): PM appends to `pm/log.md`. New day
  = new heading.
- **Weekly** (informal): PM summarises the week in `pm/log.md`: what
  shipped, what slipped, what's next. Surfaces drift.

---

## Hard rules (non-negotiable)

These hold regardless of what's expedient.

1. **Main is always releasable.** A failing test on `main` blocks all
   other work until it's green.
2. **No fabricated PR numbers.** If a commit references `(#N)`, that PR
   must exist on GitHub. Otherwise, no number.
3. **No code without a brief.** If there's no file in `pm/active/`
   covering it, Builder doesn't write it.
4. **No silent scope expansion.** If the assignment says "perimeter walls"
   and the Builder is now considering doors, that's an escalation, not a
   "while I'm in here."
5. **No Math.random in worker code.** Determinism is a pillar (R6 in
   `planning/risks.md`).
6. **Never reopen an ADR.** Supersede with a new one (`README.md` already
   says this — keeping it here for visibility).
7. **The deferral log is canonical.** If an idea is in
   `decisions/DEFERRED.md`, it doesn't get worked on without an explicit
   "revisit" trigger from User.

---

## Amending this charter

PM proposes an amendment by writing to `pm/escalations.md`. User ratifies
or rejects. PM applies the amendment in a single commit titled
`pm: amend charter — <one-line summary>`.
