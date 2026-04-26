# Ranked Backlog

PM-curated next-up. Re-based 2026-04-26 against Steve's actual MVP
definition (see `pm/STATUS_SNAPSHOT.md` § MVP definition) and folded
in Builder review batches 1 + 2 (`reviews/2026-04-26-batch-{1,2}-findings.md`).

> **Convention:** items here are PM shorthand. When promoted to a
> real assignment they get the full brief per
> `pm/templates/ASSIGNMENT.md`.

> **Legend:**  
> 🔴 = MVP-blocking infrastructure (combat won't run / determinism breaks / 4096² OOMs)  
> 🟧 = MVP Track A (mapgen comparable to Firefight)  
> 🟦 = MVP Track B (AI / sim depth — "interesting autobattler")  
> 🟩 = MVP-adjacent (combat-view rendering — battles must not look like garbage)  
> ⬜ = Post-MVP (player-facing / polish)  
> 🛠 = Hygiene (tooling, docs, repo)

---

## Tier 1 — MVP-blocking infrastructure (do first)

| Pri | ID    | Tag | Title                                                        | Size | Source |
|-----|-------|-----|--------------------------------------------------------------|------|--------|
| 1   | T-002 | 🔴   | Fix Yard Assault render-loop crash (`deploy.tsx:185-203`)    | XS   | batch-1 |
| 2   | T-003 | 🔴   | A* allocation + `executeMovement` mode threading (4096² blocker) | M | batch-2 |
| 3   | T-004 | 🔴   | Determinism hash + `unit-reload-failed` snapshot drop        | S    | batch-2 |
| 4   | T-005 | 🔴   | Squads-store persist migration (`branch=undefined` corruption)| S   | batch-1 |
| 5   | T-006 | 🔴   | Concurrent-climb teleport stack (#275 inc 3 corruption)      | S    | batch-2 |
| 6   | T-007 | 🔴   | `hasLineOfWalk` ignores edges (LOS broken at building edges) | S    | batch-2 |
| 7   | T-008 | 🔴   | Pixi child-leak fix in `combat-view.tsx`                     | XS   | batch-1 |

Until Tier 1 is green: combat may crash on casualties (T-002), 4096²
maps OOM (T-003), replay verification is silently broken (T-004),
saved squads load corrupted (T-005), buildings corrupt unit positions
(T-006), LOS through edges is wrong (T-007). Nothing else MVP-track
matters because the substrate is unsound.

T-003 and T-007 also gate observability for Track A — without the
4096² fix and edge-aware LOS, "comparable to Firefight" can't be
visually validated at full map scale. T-004 also gates Track B —
determinism is the verification mechanism for AI changes.

---

## Tier 2 — MVP Track A: Mapgen comparable to Firefight 🟧

| Pri | ID    | Title                                                  | Size | Source |
|-----|-------|--------------------------------------------------------|------|--------|
| 8   | T-009 | Rural march-road must terminate on map edge            | XS   | batch-2 |
| 9   | T-010 | Arid biome hedge generator (cover variation)           | S    | batch-2 |
| 10  | T-011 | ADR 017 increment 2 — climb-window mechanic            | S    | ADR 017 |
| 11  | T-012 | ADR 017 increment 3 — interior view                    | M    | ADR 017 |
| 12  | T-013 | Side-by-side mapgen audit vs Firefight; gap list to PM | S    | refs/firefight.md |
| 13  | T-014 | Biome-varied wall kinds (mud_hut, oil_refinery, etc.)  | S    | ADR 017 future-work |
| 14  | T-015 | Painted-aerial style pass for terrain layer            | M    | refs/firefight.md §"painted aerial" |
| 15  | T-016 | `mapgen/render/biome.ts` per-pixel `fillRect` perf fix | S    | batch-2 |

T-013 may surface concrete gaps that re-rank T-014 / T-015 / new
items. PM proposal: do T-009 / T-010 / T-011 / T-012 first
(concrete known fixes), then T-013, then re-rank.

---

## Tier 3 — MVP Track B: AI good enough to be interesting 🟦

Sized for individual promotion; many are 1–3 day assignments.

| Pri | ID    | Title                                                  | Size | Source |
|-----|-------|--------------------------------------------------------|------|--------|
| 16  | T-017 | BT Reacting state + Battle Drill 1A sequence           | M    | spec/07 §7 |
| 17  | T-018 | BT Suppressed + Panic states                           | S    | spec/07 §7 |
| 18  | T-019 | Stance system (standing / crouched / prone)            | M    | spec/07 §3 |
| 19  | T-020 | Last-seen memory per unit                              | S    | spec/07 §3 |
| 20  | T-021 | Alerted-state decay (1–2 min, veterans slower)         | XS   | spec/07 §3 |
| 21  | T-022 | Alerted-state propagation (squad comms within radius)  | S    | spec/07 §3 |
| 22  | T-023 | Suppression mechanic (high-volume fire → accuracy / panic) | S | spec/07 §7 |
| 23  | T-024 | Cover-seeking BT micro-state                           | S    | post-MVP backlog Tier 5 |
| 24  | T-025 | Drag-to-cover recovery (action exists, never produced) | S    | mvp-audit |
| 25  | T-026 | Continuous wound severity 0–100 + aggregation          | S    | spec/07 §5 |
| 26  | T-027 | 5-step blood-threshold model (currently 1)             | XS   | spec/07 §5 |
| 27  | T-028 | Treatment states full set (bandage, tourniquet)        | S    | spec/07 §5 |

PM proposal once Tier 1 + 2 settle: T-017 → T-019 → T-020 + T-021 →
T-018 → T-022 → T-023 → T-024 / T-025 → wound depth (T-026 → T-027 →
T-028). Each builds on the prior layer's behaviors.

---

## Tier 4 — MVP-adjacent: combat-view rendering 🟩

| Pri | ID    | Title                                                  | Size | Source |
|-----|-------|--------------------------------------------------------|------|--------|
| 28  | T-029 | Restore minimap (orphaned by deploy.tsx rewrite)       | S    | batch-1 |
| 29  | T-030 | Tactical overlay completeness vs Firefight (aim cones, threat arcs, movement trails) | M | refs/firefight.md |

These are the visible half of "battles must not look like garbage."
PM stance: finish Tier 1 + 2 + 3 stack before further investment
beyond what's already shipped.

---

## Tier 5 — Post-MVP polish ⬜ (Steve-assigned to Builder)

PM tracks but does not gate. Steve direct-assigns these. Recent batch
findings of this class (combined batch-1 + batch-2):

**Armory** (paperdoll core broken in multiple ways):
- Paperdoll has no hand zones — equipped weapons render nowhere
- Drag-equip silently click-only for primary weapons
- Shift-swap mass-evicts non-conflicting items
- `CONFIRM LOADOUT` button is a no-op
- Hover preview shows item stats not delta vs equipped
- Shift-swap detection couples to UI copy (`reason.includes('already')`)
- Head zone crit-slot grid renders above silhouette
- EquippedRow tooltip lost the ✕ button mention

**NEON WIRE foundation:**
- `NWFrame` exported but adopted by zero screens — grid + vignette
  + edge tick marks not rendering anywhere despite #283 shipping
- NEON WIRE playground route unreachable (no menu entry)

**Briefing:**
- `LOCK LOADOUT` only locks slot edits, not ARMORY chip
- `ABORT` chip uses `window.history.back()` (no-op in Electron)
- PHASE TIMELINE / live-comms dots are decorative (no backing data)
- `useMapPreview` runs synchronously in `useEffect` (no skeleton)
- `previewSeed = Date.now() & 0xffff` — only 65k collision space
- `initialSlotCount` capped at 6 but Yard Assault has 8

**Debrief:**
- Phase-label regex emits `T0.55` / `T0.105` (malformed)
- Decisions Log section missing entirely (#292 spec'd it)
- Wiped squads draw at world origin (centerX=0, centerY=0)
- Font-size unclamped (`vbW / 50` blows to 80+ on 4096-meter map)
- Squad-color palette 3 entries — repeats with 4+ squads

**Contract board:**
- `ContractMap` is hardcoded SVG; never reads real mapgen
- Same thumbnail every contract

**ORBAT:**
- Plaques use stylized icons not APP-6 symbology (#287 spec drift)
- Readiness / deployment filter chips absent
- Filter auto-jumps drill-in on toggling active squad's branch

**S1 Main Menu:**
- `NavStack` ships 3 items, spec called for 7
- `CompanyCard` hardcoded "A CO" instead of reading store
- Drone-track decoration has no pulse animation

**Brand drift (cross-cutting):**
- Callsigns bare in deploy roster + event feed (no rank / squad tag)
- `WIN` / `LOSS` instead of `MISSION COMPLETE` / `MISSION FAILED`
- Currency `¥` in code vs `cr` / `Cr` in BRAND.md
- Companies seed missing 4th company

**Sim instrumentation:**
- `MAX_SNAPSHOTS = 64` silent stop at ~32 sim-min (endurance-only)
- `match-stats.ts hostileTotal` accumulated then `void`-discarded

**Combat-view secondary (post-T-002):**
- `ISSUE BN ORDER` chip has no `onClick`
- Squad roster strip clip-path nibbles outer plaques
- Z-stacking collision at <900px height
- `WITHDRAW` aborts mission with no confirm

**Existing post-MVP feature backlog** (per `planning/post-mvp-backlog.md`):
- Audio (SFX + ambient)
- Save system / autosave
- Replay scrubber UI
- Death + meta-progression loop
- Powered armor / chassis-overlay second unit type
- Roster / dossier / shop screens
- Multi-engagement contracts
- Faction reputation
- Narrative events between contracts

---

## Tier 0 — Hygiene 🛠

| Pri | ID    | Title                                                  | Size |
|-----|-------|--------------------------------------------------------|------|
| —   | T-001 | GitHub remote + branch reconciliation (DONE 2026-04-26)|      |
| 30  | T-031 | README.md refresh — kill "Phase 0" claim               | XS   |
| 31  | T-032 | Audit `planning/` + `spec/` for prior-agent claims Steve hasn't ratified | S |
| 32  | T-033 | Move retired risks (R1, R7, R8, R11, R12) to "resolved" in `risks.md` | XS |

---

## Dispatch principle

PM issues from this list, prioritizing Tier 1 → 2 → 3 → 4 in order.
Steve may direct-assign work to Builder (polish track) outside the PM
channel — that's explicitly allowed under the charter (see
`pm/CHARTER.md` §"Parallel tracks"). When Steve direct-assigns, PM
logs it in `pm/log.md` post-hoc but does not re-prioritize it.

PM-issued assignments **always** prioritize MVP track over polish
track when both have open Builder capacity. If Steve's direct
assignments are starving the MVP track for too long, PM raises the
issue on `BOARD.md` rather than silently letting MVP slip.

---

## Promotion log

- 2026-04-26 — Backlog re-based against Steve's MVP definition.
  Folded in Builder batch-1 + batch-2 findings. Tier 1 grew from
  3 items to 7 because batch-2 surfaced load-bearing infrastructure
  bugs (A* OOM, determinism hash gap, edge-aware LOS, climb stack)
  that prior agent docs hadn't named. Old "Tier 1 ship-blockers for
  1.0" framing dropped — those items mostly belonged in Tier 5 by
  the new MVP bar.
