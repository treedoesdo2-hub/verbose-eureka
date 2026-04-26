# CLAUDE.md — agent context for PAYROLL (merc-autobattler)

> Read this first, every session, before doing anything else. It is the
> session-boundary handoff document. If something here contradicts what
> you "remember", trust this file.

---

## What this project is

**PAYROLL** (codebase name: `merc-autobattler`). Single-player
mil-sci-fi PMC autobattler. See `README.md` for the pitch (note: the
README's "Status: Phase 0" line is stale — see
`pm/STATUS_SNAPSHOT.md` for current state).

Stack: Electron + electron-vite + React + TypeScript + Pixi v8 + Zustand
+ Zod + Vitest + Biome. App lives at `app/`. See `decisions/010-tech-stack.md`.

---

## Project management is now formalized

There is a strict PM ↔ Builder protocol. **Read these in order:**

1. `pm/CHARTER.md` — role definitions, decision rights, escalation triggers.
2. `pm/PROTOCOL.md` — file conventions, branch / commit / PR rules,
   quality gates, status reporting.
3. `BOARD.md` (repo root) — running back-and-forth between Steve and PM.
   Always check the latest entries; they may override standing plans.
4. `pm/STATUS_SNAPSHOT.md` — what's actually shipped, what's open, what
   risks are live.
5. `pm/backlog.md` — ranked next-up.
6. Any open file in `pm/active/` — that's your current assignment if
   you are the Builder.

If you don't know which role you are: **you are the Builder unless the
User explicitly addresses you as PM.** PM only writes to `pm/`,
`decisions/`, `planning/`, `spec/`, `README.md`, and `CLAUDE.md`.
Builder writes to `app/` (and tests, and any user-facing docs).

---

## Hard rules — non-negotiable

These are restated from `pm/CHARTER.md` for visibility. Violating any of
them blocks merge.

1. **Main is always releasable.** Failing test on main = stop everything,
   fix it, before any other work.
2. **No fabricated PR numbers in commit messages.** If you write `(#N)`,
   PR N must exist on GitHub. Otherwise: `(PR pending)` or omit.
3. **No code without a brief.** No file in `pm/active/`? Don't write code.
4. **No silent scope expansion.** "While I'm in here" is an escalation,
   not a license.
5. **No `Math.random` in `app/src/sim/**` or `app/src/worker/**`.**
   Determinism is a pillar (R6 in `planning/risks.md`).
6. **Never reopen an ADR.** Supersede with a new one.
7. **The deferral log (`decisions/DEFERRED.md`) is canonical.** If it's
   in there, don't work on it without a `revisit when` trigger met.
8. **Never `--no-verify`, `--no-gpg-sign`, force-push to main, or amend
   pushed commits** unless the User explicitly says so.
9. **ADRs originate from Steve only.** Never propose, draft, or
   originate an ADR yourself. If you (PM or Builder) hit an
   architectural decision not covered by an existing ADR, escalate
   the question to Steve. He decides; you write it up using
   `pm/templates/ADR_CAPTURE.md`.

---

## Quick command reference

```bash
# Dev
cd app && pnpm dev          # electron-vite dev with HMR

# Quality gates (run before requesting review)
cd app && pnpm typecheck    # tsc --noEmit
cd app && pnpm lint         # biome
cd app && pnpm test         # vitest
cd app && pnpm build        # full electron build

# Sim-only iteration
cd app && pnpm test src/sim
```

(Confirm script names in `app/package.json` if any of these are wrong.)

---

## Where to find things

| Topic                               | Path                              |
|-------------------------------------|-----------------------------------|
| Pitch, positioning, non-goals       | `README.md`, `spec/00-vision.md`  |
| Core game loop                      | `spec/01-core-loop.md`            |
| Open design questions               | `spec/02-open-questions.md`       |
| MVP slice scope + criteria          | `spec/08-mvp-vertical-slice.md`   |
| Combat sim architecture             | `spec/07-combat-sim-architecture.md` |
| Architectural decisions             | `decisions/NNN-*.md`              |
| What's deferred + when to revisit   | `decisions/DEFERRED.md`           |
| Risk register                       | `planning/risks.md`               |
| Recent retrospective                | `planning/mvp-retrospective.md`   |
| Recent audit                        | `planning/mvp-audit.md`           |
| Post-MVP backlog (raw)              | `planning/post-mvp-backlog.md`    |
| **PM-curated backlog (work from this)** | `pm/backlog.md`               |
| **Current project state**           | `pm/STATUS_SNAPSHOT.md`           |
| **What PM owes the User**           | `pm/escalations.md`               |
| Reference game teardowns            | `refs/`                           |

---

## Determinism reminders (sim/worker code)

- Every RNG call goes through the seeded PRNG. No `Math.random`.
- No async in tick loop. Tick is a pure function of `(state, inputs, rng) → state'`.
- Map/Set iteration is order-fragile in JS — sort or use arrays for
  any cross-tick state that becomes part of the hash.
- New deps that touch sim/worker need a quick audit for hidden
  randomness (lodash random, faker, etc.).

---

## Pillar hierarchy (when in doubt, fall back here)

From `spec/05-core-pillars.md` and reinforced by R8 in `risks.md`:

1. P4 — combat sim fidelity (the soul)
2. P1 — MWO-depth customization (the headline)
3. P2 — pilot legend / attachment
4. P3 — contract pacing
5. P5 — info density (the tiebreaker)

When something has to give: protect P4 first. UI polish (P5) is
recoverable; sim architecture is not.
