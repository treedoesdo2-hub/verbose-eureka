# T-002 — Fix Yard Assault render-loop crash in deploy.tsx

**Status:** active
**Estimated size:** XS (≤4h)
**Branch:** `task/T-002-deploy-render-loop-fix`
**Base:** `main`
**Risks touched:** none directly (this is a renderer-side bug, sim
unaffected). Indirectly unblocks observation of all R-* combat-side
risks.
**Specs touched:** none (no spec or ADR changes — bug fix only)
**Issued by PM:** 2026-04-26

---

## Why

Yard Assault contracts hard-crash with React 19 "max update depth
exceeded" when an operator dies. This is the highest-priority bug
on the project: combat doesn't run reliably, which means Tracks A
(mapgen) and B (AI) cannot be observed or validated even when they
are otherwise correct. Every other MVP item depends on combat being
runnable through casualty events.

Source: Steve reported the crash; Builder batch-1 review traced the
root cause. Full write-up in
`reviews/2026-04-26-batch-1-findings.md` § Crash root cause.

---

## Root cause (per Builder review)

`app/src/renderer/src/screens/deploy.tsx` lines 185–203:

- `friendlies` and `hostiles` are computed inline as
  `snapshot?.units.filter(...)`. Array identity changes every render.
- `unitsById` is a `useMemo` keyed on `[snapshot]`, producing a fresh
  `Map` every snapshot tick.
- The auto-select `useEffect` declares
  `[selectedUnitId, friendlies, unitsById]` as deps.

Result: each render produces fresh `friendlies` → effect fires →
`setSelectedUnitId(first.id)` → state change re-renders → fresh
`friendlies` → effect re-fires. Yard Assault triggers this hard
because casualty events are common; whenever the selected operator
dies, the early-return falls through, the effect picks the next
survivor, sets state, and the cycle restarts every tick. React 19
hard-crashes on "max update depth exceeded."

---

## In scope

- Memoise `friendlies` and `hostiles` against `[snapshot]` (or a
  more-stable upstream signature) so their array identity is stable
  across non-snapshot renders.
- Change the auto-select `useEffect` deps from
  `[selectedUnitId, friendlies, unitsById]` to a primitive signature
  — recommended: `[selectedUnitId, firstAliveId]` where
  `firstAliveId` is computed alongside the memoised friendlies (or
  null if no friendlies remain).
- Whatever similar-pattern fragility lives in this file's *other*
  effects, if any (Builder may discover; flag if found, fix scope is
  this assignment).
- Add a regression test (renderer-side) that simulates snapshot
  updates with casualty changes and asserts the auto-select effect
  fires a bounded number of times.
- Verify by running a Yard Assault contract end-to-end through at
  least 3 casualty events without crashing.

## Out of scope (hard NO)

- The Pixi child-leak in `combat-view.tsx` (separate assignment T-008).
  Builder review noted it pairs with this fix; do **not** roll them
  together. T-008 lands after T-002 because the child-leak masks
  fewer regressions once the render loop is calm.
- Any other deploy.tsx polish — minimap restoration, ISSUE BN ORDER
  wiring, clip-path nibble, z-stacking. All separate assignments.
- Refactoring deploy.tsx structure beyond the minimum needed to fix
  this. If you find yourself moving large blocks around: stop,
  escalate.
- Any sim / worker-side changes. This is a renderer-side bug only.

---

## Acceptance criteria

- [ ] `friendlies` and `hostiles` are stable refs across renders that
  do not change `snapshot` reference identity. Confirmed via dev
  tools or `useDebugValue` / explicit ref-equality assertion.
- [ ] Auto-select `useEffect` deps are a primitive signature (no
  array, Map, or object references in the dep list).
- [ ] Yard Assault contract runs to completion through a minimum of
  3 operator deaths without "max update depth exceeded" or any
  React 19 render-loop error.
- [ ] At least one other contract (Yard Sweep) still runs to
  completion (regression check on the non-Assault branch).
- [ ] New regression test: simulates rapid `snapshot` updates with
  casualty changes (e.g. `unit.alive` flipping false), asserts the
  auto-select effect fires N+ε times not N×ticks times. Test file
  named clearly (suggest `deploy-auto-select.test.tsx` or similar
  per existing renderer-test conventions).
- [ ] `pnpm test` green (target: 64+ passed, 0 failed).
- [ ] `pnpm typecheck` green.
- [ ] `pnpm lint` green.
- [ ] App builds: `pnpm build`.

---

## Constraints

- **No snapshot-shape changes.** The shape of `SimSnapshot` and the
  worker → renderer message format are unchanged. This is purely a
  React-side memoisation bug.
- **No `Math.random` in any sim/worker code touched** (defensive —
  this assignment shouldn't touch sim/worker at all, but stating
  the rule).
- **No new useState introduced** that doesn't already exist in the
  file. The fix is memoisation + primitive dep, not new state.
- File touch list (advisory): `app/src/renderer/src/screens/deploy.tsx`
  primarily; one new test file. If you find yourself editing other
  files, that's a flag to escalate.

---

## Kill criteria

Concrete observations that say "stop, escalate":

- Estimate exceeds 2× (i.e. >8h). Likely means the bug is not what
  the review described.
- The cheap memoisation fix doesn't actually break the loop.
  Probably means there's a second source of unstable identity in
  this effect's dep chain. Surface it; don't push through.
- Any test that should pass demonstrably can't.
- Discovery that this fix needs to live elsewhere (e.g. inside the
  worker, or in a sim-side change). That contradicts the brief —
  escalate.

---

## Notes / context

- Full review notes: `reviews/2026-04-26-batch-1-findings.md`
  § "Crash root cause" and § "Findings by severity → Crash-class".
- React 19 is strict about "max update depth"; previous React
  versions might have masked this with a warning. This is partially
  why the bug surfaced now.
- The Pixi child-leak in `combat-view.tsx` (T-008) is in the same
  area but a different file. If your fix significantly slows the
  selection-flicker, the leak may become less GC-painful even
  before T-008 lands. Note this in your final status if observed.

---

## Status

(Builder appends per-session entries here.)

### YYYY-MM-DD — session N
- Did:
- Next:
- Blockers:

---

## Status — Final

(Builder fills when work is complete and ready for review.)

**Quality gates:**
- [ ] `pnpm typecheck` green
- [ ] `pnpm lint` green
- [ ] `pnpm test` green (NN passed, 0 failed)
- [ ] App builds (`pnpm build`)
- [ ] Yard Assault end-to-end through 3+ casualty events
- [ ] No `Math.random` in sim/worker (N/A — no sim/worker changes)
- [ ] No leftover debug
- [ ] No ad-hoc constants that belong in schema/config

**What changed:**
- ...

**What was intentionally not done (and why):**
- ...

**ADR impact:** none (bug fix)

**Risk register impact:** none directly; unblocks observability of
sim-side risks (R3, R4, R5, R9).

---

## PM Review

(PM fills on signoff or bounce.)

**Decision:** approve / rework / abandon
**Date:**
**Notes:**
