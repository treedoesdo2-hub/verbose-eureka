# 08 — MVP Vertical Slice

The minimum playable that proves the game works. Built in 24 hrs of continuous AI coding effort. Evaluated against six pass/fail criteria. If it passes, we've validated the design space; if it fails, we triage (scope / architecture / content) and pivot.

## Non-negotiables

These are the design commitments MVP must honor. Cutting any of these invalidates the MVP as a proof.

1. **Advanced-mode loadout is authoritative.** MVP ships with the real packing-based loadout system — tonnage, crit slots, body-zone armor placement. The default-mode templates exist as UX scaffolding over it but the advanced data model is the truth.
2. **Roster system is production-shape.** Hire / fire / view named operators through the real data surface. Initial content pool is small but the *shape* matches what ships at 1.0 — no hardcoded lists that require ripping out.
3. **Stockpile separation is real.** Buy gear to stockpile; equip pulls from stockpile; shapes the economy-UI boundary that the production game lives in.
4. **Combat sim is the real engine.** LOS with vision cones, per-impact wounds, bleed-out, stabilization, recovery AI — the P4 sim-fidelity system, not a placeholder. No "HP pool" stand-ins.
5. **Determinism holds.** Seeded RNG throughout. Replays re-run from seed + inputs.
6. **UI discipline per ADR 009.** Flat, component-library-based, keyboard-navigable. No diegetic chrome, no modal chain.

## In scope for MVP

### Systems (full-depth)

- **Combat sim core** — tick loop, seeded RNG, deterministic state evolution
- **LOS & vision** — three-tier (40° cone + 80m peripheral + alerted 360°), tile-sampling raycast, elevation and cover factored in
- **Hit resolution** — 4-stage pipeline (hit/miss → zone → armor/pen → wound instance)
- **Wound model** — per-impact wound instances per body zone, bleed rate per wound, blood volume, stabilization (bandage / tourniquet / stabilize)
- **Recovery AI** — drag-to-cover + stabilize-in-place behaviors
- **Advanced-mode loadout** — crit-slot packing, tonnage budget, per-zone armor allocation, real constraints
- **Default-mode loadout (UX wrapper)** — template-driven view over the advanced model
- **Roster** — hire/fire/view with production data shape
- **Stockpile** — company-level gear inventory; equip/unequip operations pull/return
- **Shop** — small rotating inventory; buy to stockpile
- **Contract briefing / debrief** — single-engagement flow
- **Replay + speed controls** — 0.5x–8x, pause (view-only), auto-resolve

### Content (minimum viable)

- **1 map** — hand-authored tactical map, ~1024×1024 tile grid, representative terrain mix (road, buildings, forest, open ground)
- **1 infantry unit type** — no vehicles, mechs, PA, drones in MVP (these inherit the shared chassis model — expanding is post-MVP work on a solved abstraction)
- **~10 pre-made operators** in the recruit pool (enough to feel like a roster system, not a fixed list)
- **3 weapon types** — one common rifle (e.g., AR archetype), one LMG archetype, one sidearm. Each with full ballistic data (caliber, velocity, mass).
- **2 armor sets** — light (mobility) and heavy (protection). Both use real body-zone placement.
- **3 utility items** — grenade, smoke, medkit. Medkit is a real recovery tool.
- **1 enemy faction** — pre-made roster, 3 skill tiers (green / regular / veteran)
- **2 contract variants** on the same map — different enemy composition / numbers / objectives to prove the content pipeline

### UI surfaces

- Main menu (new run / continue / settings)
- Roster screen (operator list, dossier detail view)
- Armory screen (stockpile, loadout per operator, advanced toggle for zone-packing)
- Shop screen (buy items to stockpile)
- Contract board (pick from 2 available)
- Briefing screen (contract details, pre-deploy loadout pass)
- Deploy screen (combat view with HUD — speed controls, unit status panels, vision cone visualization)
- Debrief screen (results + casualty list + replay option)

### Pathfinding (MVP simplification)

Per Q27 decision, specific algorithm is deferred to prototype. For MVP, on the single hand-authored map, we use **CL-inspired hand-authored waypoint routes** (see refs/clutch-legend.md for the reference):

- Per-map, per-behavior (advance / hold / retreat / flank), per-role waypoint lists
- Simple leader-follower steering with separation
- `buildSafeWaypoints`-style greedy local obstacle avoidance for dynamic targets (recover fallen, approach medic, reposition)
- This is an MVP shortcut — explicitly not the production solution; production needs generic tile-grid pathfinder

**Why acceptable for MVP:** we're not testing pathfinding's cross-map scalability. We're testing combat sim viability on one map. Hand-authored routes let us focus 24hr-budget on the systems that actually differentiate the game.

**Kill switch if it's a problem:** if hand-authored routes reveal themselves as a dead end for MVP (e.g., the behavior looks too scripted), we pivot to simple tile-A* with cached precompute — ~2 hrs of the budget.

## Out of scope for MVP

All of these are deferred. None affect MVP validity.

- Vehicles / mechs / PA / drones (expansion on shared chassis model, post-MVP)
- Multi-engagement contracts / legwork / BT-style deployments
- Faction reputation / multi-faction politics
- Meta-progression / death / glory unlocks
- Campaign timeline / ironman / endless-until-death structure
- Narrative events / NSiR-style skill checks
- Cyberware (internal surface deferred; no cyberware slots in MVP loadouts)
- Multiple maps
- Crew positions for vehicles (no vehicles = no crew positioning)
- Scale: target is 12–16 units per engagement, not battalion
- Custom operator-hiring beyond pre-made pool
- Faction-specific gear unlocks
- Economy tuning across tiers
- Save-slot system (single autosave is enough for MVP)
- Audio (SFX/music secondary to mechanic validation — thin, placeholder-only)
- Localization (English only)
- Dark/light theme pair (dark-only for MVP)

## The six pass/fail success criteria

All must pass for MVP to validate the design.

### 1. Combat sim runs at 4x default speed with all 12–16 units on screen on mid-range laptop without frame drops.
- Measured: 60 fps sustained during 4x-speed combat playback
- Test: play 3 contracts end-to-end, no drops below 55 fps in 5-sec rolling window

### 2. LOS cones are visibly tactical.
- A flanking setup produces a visibly different outcome than a frontal assault
- Player can observe that unit facing matters — someone turning their back gets shot, someone looking the right direction spots first
- Peripheral-bubble (80m) is distinguishable from focused cone behavior
- Alerted-state override visibly changes unit behavior

### 3. Wounds accumulate per-impact with visible bleed HUD.
- Per-zone wound display with severity, type, and treatment state
- Blood volume bar per unit, draining from bleed
- Stabilization actions (medic) work mid-fight and reflect visibly
- Multi-hit accumulation visible (arm shot twice = two wounds, not upgraded tier)

### 4. Loadout changes measurably affect fight outcome.
- Test: run same 6v6 with heavy-armor loadout vs light-mobility loadout against same enemy
- Expected: heavy wins in static-engagement scenarios; light wins in maneuver scenarios
- Directional predictability > 70% across 20 trials
- If loadout is noise-indistinguishable from random, P1 pillar fails — mechanic is broken

### 5. Replay works.
- Any match replayable from debrief
- Full scrub (any point in time)
- All speeds (0.5x–8x)
- Deterministic — replay produces bit-identical state as original

### 6. The 10-minute demo test.
- A new player opens the game, hits "new run"
- Within 10 minutes they have completed one contract end-to-end and understand what happened
- No tutorial modal blocked them (per ADR 009 inline-annotation rule)
- Post-session verbal: "I get what this game is"

---

## Post-MVP priority sequence (from Q30)

When MVP passes, this is the expansion order:

1. **Second unit type** (recommend: powered armor — shares infantry paradigm with chassis overlay; good test of the shared model)
2. **Multi-engagement contract** — BT deployment layer
3. **Real pathfinder** — tile-grid A* or variant, replacing hand-authored waypoints
4. **Stockpile + shop depth** — more gear, rarity tiers, quality variants
5. **Death + meta-unlock loop** — ironman campaign → glory → next campaign
6. **Legwork phase** — Shadowrun-style prep
7. **Vehicles / mechs / drones** — remaining unit types
8. **Factions + reputation** — multi-axis rep, faction politics
9. **Narrative events** — NSiR-style skill checks

## Related

- spec/07 — combat sim architecture (this is what MVP builds)
- spec/06 — loadout system (advanced mode is the full spec; MVP implements the whole advanced surface)
- spec/03 — contract structure (MVP uses only Phase 1 briefing + Phase 3 single-engagement + Phase 4 payout; Phases 2 and 5 deferred)
- ADR 006 — combat pacing (MVP must ship speed controls to validate the pacing model)
- ADR 009 — UI philosophy (MVP UI must be discipline-honoring to validate the look)
- ADR 010 — tech stack (MVP is the first thing built on it)
- planning/prototype-plan.md — hour-by-hour MVP build plan
- planning/risks.md — risks and kill-criteria for MVP
