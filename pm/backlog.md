# Ranked Backlog

This is the PM-curated next-up list. Source of truth for what gets
assigned next. Re-ranked at session start; promoted to assignment files
in `pm/active/` when work begins.

Everything here is sized in t-shirt terms. PM tightens the estimate when
promoting to an assignment.

> **Convention:** items in this file are PM-readable shorthand. Once
> promoted to an assignment, they get the full brief treatment per
> `pm/templates/ASSIGNMENT.md`.

---

## Top of stack

**Blocked on User: GitHub setup.** Until a remote exists, no PR flow,
which means no Tier 3 review gate, which means PM cannot sign off
anything for merge in the strict sense. Local merges to `master`/`main`
remain possible but are formally degraded reviews.

---

## Tier 0 — Hygiene, before any feature work

| Pri | ID    | Title                                                | Size |
|-----|-------|------------------------------------------------------|------|
| 1   | T-001 | GitHub remote + branch reconciliation                 | S    |
| 2   | T-002 | README.md refresh — kill "Phase 0" claim              | XS   |
| 3   | T-003 | Add `CLAUDE.md` enforcement to commit hook (optional) | S    |
| 4   | T-004 | Move retired MVP risks (R1, R7, R8, R11, R12) to "resolved" in `risks.md` | XS |

Notes:
- T-001 is partially blocked on User; the part PM can prep is the
  reconciliation strategy doc. The push itself is User-with-PM.
- T-003 is optional / nice-to-have, not gating.

---

## Tier 1 — Ship-blockers for 1.0 (per `planning/post-mvp-backlog.md`)

| Pri | ID    | Title                                | Size | Notes |
|-----|-------|--------------------------------------|------|-------|
| 5   | T-005 | Real pathfinder (tile A*, cached)    | M    | Kill-switch for R9. Spec/08 already reserves the slot. |
| 6   | T-006 | ADR 017 increment 2 — climb-window   | S    | Already committed to in the ADR. |
| 7   | T-007 | ADR 017 increment 3 — interior view  | M    | Renderer roof toggle exists per `208bdd8`. |
| 8   | T-008 | Manual 10-min demo test (User-only)  | XS   | Just ask User to play; PM captures verbal. |
| 9   | T-009 | Save system (single autosave)        | M    | Touches new ADR 011 (save format schema). |
| 10  | T-010 | Replay playback UI                   | S    | Foundation built; UI is the gap. |
| 11  | T-011 | Powered armor unit type              | M    | First chassis-overlay test of `CombatProfile`. |
| 12  | T-012 | Death + meta-progression loop        | L    | Touches ADR 008 (endless-campaign). Split before promoting. |
| 13  | T-013 | Audio (SFX: gunfire/impact/death)    | M    | New ADR 013 (audio strategy). |

---

## Tier 2 — Pillar expansion

(Lift directly from `planning/post-mvp-backlog.md` Tier 2; not promoted
to T-IDs until Tier 1 closes. Listed for visibility only.)

- Multi-engagement contracts (BT-style)
- Legwork phase (Shadowrun-style)
- Faction reputation system
- Narrative events between contracts
- Mechs / vehicles / drones (remaining unit types)

---

## Tier 3 — Polish & legibility

(Per `planning/post-mvp-backlog.md` Tier 3.)

- Kill feed / event ticker in Deploy
- Wound detail panel on unit click
- Operator dossier screen
- Roster screen (hire/fire surface)
- Shop screen
- Briefing map preview (minimap + spawns)
- Loadout validation warnings in UI

---

## Tier 4+ — UX, sim depth, engineering

See `planning/post-mvp-backlog.md`. Not duplicated here. Promote when
upstream tiers close.

---

## Recently bumped / explicitly NOT scheduled

- Drag-and-drop expansion in armory (`DEFERRED.md`) — kept deferred
- Multi-room building interiors (`ADR 017` out-of-scope) — kept deferred
- Light theme + density modes (ADR 009 §6) — Tier 4 polish, not Tier 1

---

## Promotion log

- 2026-04-26 — Backlog created from `planning/post-mvp-backlog.md` and
  `decisions/DEFERRED.md` revisit triggers.
