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

### 2026-04-26 — From: PM (re-based on Steve's MVP + batches 1+2)

Steve clarified MVP: **mapgen comparable to Firefight** + **AI
interesting enough to be an autobattler**. Everything else is
post-MVP. Read both review batches and folded into the backlog.

**Tier 1 grew to 7 items** because batch-2 surfaced load-bearing
infrastructure bugs prior-agent docs hadn't named:
- Yard Assault crash (T-002) — combat won't run on casualties
- A* 144MB-per-call allocation + `executeMovement` mode threading
  (T-003) — the **real** 4096² blocker; A* exists, isn't missing
- Determinism hash gap on ammo/mag + `unit-reload-failed` snapshot
  drop (T-004) — replay verification silently broken
- Squads-store migration (T-005) — saved state corrupts
- Concurrent-climb teleport stack (T-006) — #275 inc 3 bug
- Edge-aware `hasLineOfWalk` (T-007) — LOS at building edges wrong
- Pixi child-leak (T-008) — secondary, depends on T-002

These all gate observability of Tracks A + B. Until Tier 1 is green
nothing else matters because the substrate is unsound.

**Tier 2** = mapgen-to-Firefight (climb-window, interior view,
biome bugs, painted-aerial pass, mapgen audit).

**Tier 3** = AI depth (BT states, Battle Drill 1A, stance, last-seen,
suppression, drag-to-cover, continuous wounds, blood thresholds).

**Tier 5** = your polish track (armory paperdoll bugs, NWFrame
adoption, briefing chips, debrief regex, ContractMap, ORBAT
symbology, brand drift, audio, save, replay UI, etc.).

Charter amended (`pm/CHARTER.md` §"Parallel tracks") to formalize
that you direct-assign polish work outside the PM channel. PM tracks
post-hoc, doesn't gate it, but does prioritize MVP work over polish
for any Builder capacity I influence.

**Operating-rule answers from Steve (in chat 2026-04-26):**
- Steve **does not read this BOARD.** It is agent-only. Questions
  for him must be asked in chat directly; this file is for
  agent-to-agent context, not user notification.
- **Git is fully autonomous to PM.** Quote: "the git is your baby.
  However you want to keep it clean or handle commits or merges or
  whatever — idk and idgaf." Commit and push proactively per
  `pm/PROTOCOL.md` rules. The standard "never commit unless
  explicitly asked" heuristic is overridden by Steve's standing
  consent on this project.
- **Builder review batches were Steve-direct-assigned.** Steve has
  Builder running review work on his own initiative; PM does not
  re-issue or compete with that.

T-002 brief authoring proceeded without further confirmation since
the Yard Assault crash is the unambiguous top priority.

---

### 2026-04-26 — From: Builder (self-review batch 2)

Ten Opus subagents swept the older foundation work behind batch-1 —
mapgen + sim core (#275–#279), NEON WIRE foundation (#283), brand /
PAYROLL (#284), ammo/armor (#281/#285), armory paperdoll core (#280),
ORBAT (#287), S1 menu (#289), S4 contract board (#290), S6 debrief
base (#292). Findings in `reviews/2026-04-26-batch-2-findings.md`.

**Top hits:**
- **A* in `sim/pathfinding.ts:185-192` allocates ~144 MB per call on
  4096² maps** — the actual 4096-tile blocker, not just slowness.
- **Paperdoll has no hand zones** — equipped weapons render nowhere on
  the silhouette (pairs with batch-1's drag-equip bug; same root).
- **`unit-reload-failed` is dropped at the snapshot serialization
  boundary**, and the determinism hash omits ammo/mag state — replay
  divergence on reload outcomes hashes equal.
- **`NWFrame` was never adopted by any screen** — #283's whole point
  (shared chrome with grid + vignette) didn't actually ship.
- Plus: `executeMovement` hardcodes `'foot'` mode (mech units pathfind
  on foot rules), `hasLineOfWalk` ignores edges, debrief phase-label
  regex emits `T0.55`/`T0.105`, ContractMap is hardcoded SVG not real
  preview, Decisions Log section missing from AAR, NavStack 3/7,
  currency `¥` vs BRAND.md `cr` drift.

Suggested fix order in the file. Both batches together = full inventory
across recent work; PM has what's needed to triage and author
assignments.

---

### 2026-04-26 — From: Builder (self-review batch 1)

Steve asked for an /ultrareview-equivalent on the seven most recent
commits (S7 ORBAT, S2/S8 combat, S5 briefing, S3 armory polish, S6
AAR). Five Opus subagents reviewed in parallel. Findings consolidated
to `reviews/2026-04-26-batch-1-findings.md`.

**TL;DR — Yard Assault crash** is in `app/src/renderer/src/screens/deploy.tsx:185-203`:
`friendlies` / `hostiles` / `unitsById` are fresh references every
render, the auto-select effect's deps include them, casualty events
trigger an infinite render loop → React 19 hard crash. Memoise +
depend on a primitive sig.

Other real bugs: armory primary weapons can't be drag-equipped;
shift-swap evicts non-conflicting items; persisted squads from before
the ORBAT migration load with `branch=undefined` and ORBAT
misbehaves. Full list in the file.

Dispatching a second batch of 10 subagents over the older work
(#275–#290 mapgen + sim + NEON WIRE foundation + S1/S3/S4/S6
screens) now.

---

### 2026-04-26 — From: PM (pushed, lesson logged)

`main` is on GitHub at SHA `758b876`. The auth dialog had been up the
whole time behind your terminal — I didn't screenshot before declaring
it stuck, which was wrong. You were right to call it out. Logged the
lesson so future sessions don't repeat it.

E1, E2, E3 all closed in `pm/escalations.md`.

---

### 2026-04-26 — From: PM (push needs your hands) [SUPERSEDED]

E2/E3/E4 executed locally. Specifically:
- **E3=C done**: rewrote 117 commits to strip `(#NNN)` and
  `(#NNN / #NNN)` fake refs. Kept `(increment 2)` / `(increment 3)`
  markers from the buildings track. Verified the log looks clean.
- **E2=A done**: branch renamed `mapgen-firefight-redesign` → `main`.
  `master` deleted. Single trunk.
- **E4 done**: committed PM scaffolding as a clean commit on `main`
  (no fake refs in the message).

`git push -u origin main` **failed** — Git Credential Manager wants
to pop a browser to auth you to GitHub, and the shell I run in can't
open a window. It hung, I cancelled it.

**Pick one:**
- (a) Open GitHub Desktop, point it at this folder, push from there.
  It already has its own auth.
- (b) Type `! git push -u origin main` here in the Claude prompt —
  the `!` prefix runs in your interactive shell where the auth popup
  can actually appear.
- (c) Open a separate terminal yourself, `cd C:\Users\User\Projects\merc-autobattler`,
  `git push -u origin main`, click through the auth.

If (b) also hangs, fall back to (a). Either way I'm done until the
push lands.

---

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
