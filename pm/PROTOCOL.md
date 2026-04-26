# PM ↔ Builder Protocol

This is the operational contract between PM and Builder. The Charter
(`pm/CHARTER.md`) defines roles; this defines the day-to-day mechanics.

---

## Directory layout

```
pm/
├── CHARTER.md              ← role definitions, decision rights
├── PROTOCOL.md             ← this file
├── STATUS_SNAPSHOT.md      ← current project state, refreshed by PM
├── backlog.md              ← ranked next-up
├── log.md                  ← running PM log (newest at top)
├── escalations.md          ← open asks to the User
├── templates/
│   ├── ASSIGNMENT.md       ← assignment file template
│   └── ADR_CAPTURE.md      ← write-up template for an ADR User has stated
├── active/                 ← open assignments (Builder works here)
├── review/                 ← assignments awaiting PM review
└── done/                   ← signed-off assignments (kept for history)
```

**Sibling files at repo root that PM also owns:**
- `BOARD.md` — free-form back-and-forth between Steve and the PM. See
  the file itself for usage rules.
- `CLAUDE.md` — session-handoff for any agent.

---

## Assignment lifecycle

**Dispatch reality:** Steve is the dispatcher. Builder does not poll
`pm/active/`. Briefs in `pm/active/` are PM tracking records (scope,
AC, kill criteria, status); they are not the channel by which work
reaches the Builder. Steve relays work to Builder's working todo list
manually — sometimes from a review doc, sometimes from a `## Dispatch`
block at the top of a PM brief, sometimes verbally.

```
PM drafts brief → pm/active/T-NNN-slug.md
    │             (with a ## Dispatch paste-block at the top
    │              for items not already covered by a review doc)
    ▼
Steve relays the dispatch block (or review-doc entry) into Builder's
todo list — PM does not autoroute
    │
    ▼
Builder picks up the dispatched item
    │
    ├─ creates branch task/T-NNN-slug from main when the item maps
    │  to a PM-tracked T-NNN; otherwise commits on main directly
    │  (polish-track convention per CHARTER §"Parallel tracks")
    ├─ updates ## Status section of the brief if Steve has flagged
    │  it as PM-tracked, otherwise just commits
    │
    ▼
Builder finishes → fills ## Status — Final → moves file to pm/review/
    (PM-tracked items only)
    │
    ▼
PM reviews against ## Acceptance criteria, runs gates
    │
    ├─ Pass: PM merges PR → moves file to pm/done/ → logs in pm/log.md
    └─ Fail: PM appends review notes → moves file back to pm/active/
                with status "needs rework"
```

There is exactly one active branch per Builder session for PM-tracked
work. Polish-track work follows whatever pattern Steve and Builder
have established.

**Implication for PM:** PM cannot assume a brief in `pm/active/` is
"in flight" with Builder. It's only in flight after Steve dispatches
it. PM should either author a `## Dispatch` block at the top of the
brief for Steve's convenience, OR — for items already covered in a
review doc — point Steve at the review-doc section in the brief's
`## Notes`.

---

## Assignment IDs

`T-NNN` where NNN is a zero-padded sequential integer. PM assigns the next
ID at draft time. Once written, never reused.

Slug: `kebab-case-summary`, ≤6 words. Example: `T-007-real-pathfinder`.

---

## Branch / commit / PR rules

### Branches
- Always branched from `main`.
- Name: `task/T-NNN-slug`. One branch per assignment.
- Lifetime: target ≤3 days. If you're past 3 days, escalate.
- Daily integration: rebase or merge `main` into the branch every active
  day, even if you have nothing to push.

### Commits
- Subject ≤72 chars, imperative mood. Format:
  ```
  <area>: <imperative summary>  [T-NNN]
  ```
  Example: `sim: emit unit-downed events on bleed transition  [T-009]`
- Body: explain *why*. Reference the assignment by ID. Reference ADRs
  affected. Reference real GitHub PR numbers only after the PR exists.
- **Forbidden:** referencing `(#N)` for a PR that does not exist on
  GitHub. If the PR isn't created yet, write `(PR pending)`.
- **Forbidden:** `--no-verify`, `--no-gpg-sign`, amending pushed commits,
  force-pushing main.

### Pull requests
- Title: assignment subject + `[T-NNN]`. ≤70 chars.
- Body: copy the assignment's `## Why` and `## Acceptance criteria`
  sections. Add `## Status — Final` from the assignment file.
- One PR per assignment. Squash-merge by default; preserve commits only
  if the assignment was multi-step and the steps make sense as separate
  history.
- Reviewer: PM. No self-merge.

### Main branch
- `main` is the trunk. (At time of writing, repo's trunk is named
  `master` and `mapgen-firefight-redesign` is the de-facto trunk.
  Renaming to `main` is escalation #1 — see `pm/escalations.md`.)
- `main` must always pass: typecheck, lint, tests. If it doesn't,
  next thing anyone does is fix it.

---

## Quality gates

A merge requires all of these to be green. Builder runs them and pastes
results into `## Status — Final` before requesting review.

### Tier 1 — Automated (Builder runs)
- [ ] `pnpm typecheck` (or `tsc --noEmit`) — no errors
- [ ] `pnpm lint` (Biome) — no errors
- [ ] `pnpm test` — all tests pass; new behavior has new tests
- [ ] If renderer / sim changes: app builds (`pnpm build`)

### Tier 2 — Self-check (Builder confirms in Final status)
- [ ] Feature exercised end-to-end at least once (Electron run for UI;
      integration test or scratch script for sim)
- [ ] No `Math.random` introduced in `app/src/sim/**` or `app/src/worker/**`
- [ ] No ad-hoc constants that should be config / schema
- [ ] No leftover `console.log` / debug scaffolding
- [ ] No new ADR-worthy decisions made silently — if there are, they're
      proposed in `pm/templates/ADR_PROPOSAL.md` style

### Tier 3 — PM review
- [ ] Acceptance criteria all met (or any unmet are explicitly noted +
      justified in Final status, awaiting PM call)
- [ ] No silent scope expansion
- [ ] Spec / ADR alignment intact
- [ ] Commit hygiene per above
- [ ] Risk register impact reviewed (does this newly trigger a kill
      criterion? change a likelihood?)

If Tier 1 fails: Builder fixes before requesting review. If Tier 2 or 3
fails: PM bounces back with notes.

---

## Status reporting

Builder updates the assignment file's `## Status` section every active
session. Format:

```
## Status

### 2026-04-26 — first session
- Did: stamped perimeter walls in pipeline.ts; new test
  `building-perimeter.test.ts` passing.
- Next: door selection (long-axis bias).
- Blockers: none.

### 2026-04-27 — second session
- Did: door + windows. All sim tests pass.
- Next: integration test that an enemy can't walk through.
- Blockers: a* path expansion budget might need raising — escalating.
```

When done, Builder writes a `## Status — Final` section with:
- Quality-gate checklist
- Summary of what changed (file paths)
- Anything intentionally not done + why
- Test results (count, pass/fail)
- ADR impact (none / proposed in <link> / superseded <id>)

PM appends `## PM Review` after sign-off or rejection.

---

## ADRs — origination and capture

**ADRs originate from the User. Period.** Neither PM nor Builder
proposes an ADR. The User has the architectural authority on this
project; PM and Builder execute and document.

When Builder hits something that needs an architectural decision but no
ADR covers:

1. Stop coding the affected area.
2. Add a `## Blockers` entry in the assignment file describing the
   decision space — what choices exist, what each implies for code /
   schema / sim / save format / determinism / perf. **Do not pick one.**
3. Move assignment file to `pm/review/` with note "Architectural
   question — needs ADR".
4. PM frames the question into `pm/escalations.md` for the User.
5. User states the decision (in chat, on the BOARD, or however).
6. PM writes the ADR in `decisions/NNN-slug.md` using the
   `pm/templates/ADR_CAPTURE.md` template and references it back into
   the assignment file before sending it back to active.

Builder does NOT write to `decisions/` directly. PM does not write
ADRs the User hasn't stated. If PM thinks an ADR-worthy question
exists but the User hasn't weighed in, PM frames it and waits.

---

## When the brief is wrong

If Builder finds the brief contradicts the spec, an ADR, or reality:

1. Stop work on the assignment.
2. Write a `## Blockers` entry stating exactly what's contradicting
   what (cite file paths and line numbers).
3. Move file to `pm/review/`.
4. PM either rewrites the brief or escalates.

This is not an escalation to be apologetic about. The brief is wrong;
catching that early saves a rework loop.

---

## Risk register hooks

When Builder touches code that's load-bearing for a risk in
`planning/risks.md`, they note it in `## Status` with the risk ID:

> Touches R6 (determinism). Verified replay hash holds via
> `determinism.test.ts` after change.

PM reviews risk-touching changes with extra care.

---

## Communication outside files

There is no Slack, no DMs, no informal channel. Everything that matters
between PM and Builder is in `pm/`. If the User says something verbally
that should bind future decisions, PM commits it to the appropriate
file in the same session it's said.

User-to-PM communication is whatever channel the User uses to talk to
the PM agent (chat in this terminal). PM-to-User communication is
`pm/escalations.md` plus the chat response in the same session.
