# Board

Free-form notes between Steve and the PM. Not a formal channel —
that's `pm/escalations.md` (asks needing decisions) and `pm/log.md`
(PM activity log). Use this for: FYIs, quick course-corrections,
"btw I noticed", thinking-out-loud, kudos, complaints, anything
short that doesn't need its own file.

## Rules

- **Newest entry at the top** of the `## Thread` section, under
  the most recent dated heading.
- Each entry: `### YYYY-MM-DD HH:MM — From: Steve | PM | Builder`,
  then the message body.
- Resolved or stale entries: move to `## Archive` at the bottom.
  Don't delete history.
- If something here demands a decision, the PM **also** opens an
  entry in `pm/escalations.md`. Don't rely on the board alone for
  asks that block work.
- Keep it short. If a message is longer than a paragraph, it
  probably belongs in an assignment, an ADR, or a status entry —
  not here.

---

## Thread

### 2026-04-26 — From: PM (re: GitHub URL)

Got the URL: `https://github.com/treedoesdo2-hub/verbose-eureka.git`.
Added `origin` remote locally. GitHub repo is currently empty (zero
commits) — confirms Desktop didn't push anything, just registered the
folder.

**I'm not pushing yet.** Reason: now is the only painless moment to
settle E2 (branch rename) and E3 (rewrite fake-PR commit messages or
not). Once we push, option E3=C costs a force-push; doing E2 after
the push means renaming on GitHub too, which is fine but more steps.
Cheapest if you decide first.

When you tell me your A/B/C calls on E2 and E3, I'll:
1. (If E3=C) rewrite history to strip the fake `(#NNN)` refs
2. (If E2=A) rename the branch locally
3. Commit the PM scaffolding (`pm/`, `BOARD.md`, `CLAUDE.md`)
4. Push to `origin`

If you'd rather just get it backed up and decide later, tell me
"push now, defaults" and I'll push as-is (option E2=C, E3=A — leave
both alone). We can still revisit later; rewrites get more annoying
but not impossible since you're the only user.

---

### 2026-04-26 — From: PM

Board initialized. Two follow-ups from your last message folded
into the protocol:

1. **ADR origination rule applied.** Updated `pm/CHARTER.md`
   §Decision rights and `pm/PROTOCOL.md` §"ADR proposals" to
   reflect that all ADRs come from you. The old
   `pm/templates/ADR_PROPOSAL.md` (which let Builder propose) is
   now `pm/templates/ADR_CAPTURE.md` (PM/Builder write up an ADR
   you've stated, then you ratify). Builder is explicitly
   forbidden from originating an ADR.

2. **Board lives at repo root** as you asked, not under `pm/`.
   Path is `BOARD.md`. CLAUDE.md and the Charter both point to
   it now so any agent will see it.

Three escalations are still open for you in `pm/escalations.md`:
GitHub URL (E1), master/main rename (E2), historical fake-PR
policy (E3). Take your time.

---

## Archive

(empty)
