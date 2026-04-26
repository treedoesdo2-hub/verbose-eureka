# T-NNN — <slug-style summary>

**Status:** active | needs rework | review-pending | done
**Estimated size:** XS (≤4h) | S (≤1d) | M (≤3d) | L (≤1w — split if you can)
**Branch:** `task/T-NNN-slug`
**Base:** `main`
**Risks touched:** R-NN, R-NN (from `planning/risks.md`), or "none"
**Specs touched:** `spec/0X-...`, ADR NNN, or "none"
**Issued by PM:** YYYY-MM-DD

---

## Dispatch (paste-block for Builder todo)

> Steve dispatches from this block (or from a review-doc entry if
> the item is already documented there). PM's job: keep this block
> short, paste-ready, and self-contained — Steve copies once, doesn't
> re-summarise.

```
[T-NNN] <one-line title> (size)
- <One-line root cause or context>
- <One-line desired outcome / fix direction>
- Acceptance: <one-line testable criterion>
- Out of scope: <one-line list of explicitly excluded items>
- Branch: task/T-NNN-slug
- Full brief: pm/active/T-NNN-slug.md
```

If the item is already documented in a `reviews/` doc, replace this
block with a one-line pointer ("see `reviews/<file>.md` § <section>").

---

## Why

One paragraph. Why does this exist? What is the user-visible (or
sim-visible, or dev-visible) problem this closes? Cite the source — a
spec section, an ADR, a risk, a backlog item, a User decision.

If the only answer is "it would be nice," this assignment is wrong. Kill
it or push it to backlog.

---

## In scope

- Bullet list of what is in scope. Be specific. File paths welcome.
- Each item should be testable (something either works or it doesn't).

## Out of scope (hard NO)

- What is explicitly NOT to be done in this assignment, even if it's
  tempting.
- "While you're in there" is not a valid reason to do something here.
- If you find yourself wanting to do these things, escalate.

---

## Acceptance criteria

Each criterion is a checkbox the PM will tick on review. Specific,
testable, demonstrable.

- [ ] <Specific behavior 1, e.g. "Infantry units cannot path through a
  building's external edge that has `EDGE_OVERRIDE_DOOR_CLOSED` unless
  they have a door-open action.">
- [ ] <Specific behavior 2>
- [ ] Test added: <test file name + a brief assertion description>
- [ ] Tests pass: `pnpm test` green
- [ ] Typecheck: `pnpm typecheck` green
- [ ] Lint: `pnpm lint` green
- [ ] No regressions in <named related areas>
- [ ] No silent scope expansion (Builder confirms)

---

## Constraints

- Performance budget: e.g. "must not blow `MAX_NODES_EXPANDED = 4000`
  in A*"
- Schema rules: e.g. "do not change `BuildingRecord` shape"
- Determinism: "no `Math.random` in sim/worker"
- File touch list (advisory): which files are expected to change. Not a
  hard cap, but a sanity check.

---

## Kill criteria

Concrete observations that say "stop, escalate, do not push through":

- This assignment exceeds estimate by 2× → escalate.
- An ADR-worthy decision surfaces → escalate via ADR proposal.
- A new test that should pass demonstrably can't → escalate.
- The brief contradicts an existing spec or ADR → escalate.

---

## Notes / context

Anything the PM thinks the Builder needs that isn't elsewhere. Links to
prior assignments, prior commit hashes, related deferrals, similar past
decisions.

---

## Status

(Builder appends per-session entries here. Format per `pm/PROTOCOL.md`.)

### YYYY-MM-DD — session N
- Did:
- Next:
- Blockers:

---

## Status — Final

(Builder fills this when work is complete and ready for review. PM
reads this first when reviewing.)

**Quality gates:**
- [ ] `pnpm typecheck` green
- [ ] `pnpm lint` green
- [ ] `pnpm test` green (NN passed, 0 failed)
- [ ] App builds (if UI/sim touched)
- [ ] Feature exercised end-to-end
- [ ] No `Math.random` in sim/worker
- [ ] No leftover debug
- [ ] No ad-hoc constants that belong in schema/config

**What changed:**
- `path/to/file1.ts` — <one-line description>
- `path/to/file2.ts` — <one-line description>
- `path/to/test.test.ts` — <new test>

**What was intentionally not done (and why):**
- <thing> — out of scope per brief.
- <thing> — escalated as ADR proposal (see below).

**ADR impact:** none | proposed below | supersedes ADR-NNN

**Risk register impact:** R-NN likelihood drops to L | new risk surfaced |
no impact

---

## PM Review

(PM fills this on signoff or bounce.)

**Decision:** approve / rework / abandon
**Date:** YYYY-MM-DD
**Notes:**
- <approval reason or rework instructions>

If approved: PM moves file to `pm/done/`, merges PR, logs in `pm/log.md`.
If rework: PM appends notes here, sets status, moves file back to
`pm/active/`.
