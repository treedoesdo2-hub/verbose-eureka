# PAYROLL — A Private Military Sim

> **You run the company. The company runs the war.**

(Codebase / repo name: `merc-autobattler`. Game brands as **PAYROLL** —
see ADR 016.)

Single-player roguelite autobattler with PMC / mil-sci-fi flavor. Target
tier: Electron/web-tech indie. Low art budget, high systems / UI bar.

## The one-liner

> **Backpack Battles × Firefight × BattleTech in a cyberpunk corporate-PMC
> ops console.**

You run a private military company. Each run = ~25–30 contracts. Prep
phase: hire operators, buy gear, set positions and behavior tags. Press
DEPLOY. Watch the top-down tactical engagement play out autonomously in
~60 seconds. Collect payout, patch the wounded, grieve the dead, re-prep,
next contract. Synergies between classes / gear / traits are where the
game lives.

## Genre niche

Autobattler-proper (Backpack Battles / Hadean Tactics / The Bazaar / Mechabellum lineage), **not** a pausable tactical game. Zero player input during combat, full stop. The mil-sci-fi squad-scale pocket of the autobattler genre is currently empty — Mechabellum is huge-scale army combat; nobody's doing Firefight-tier squad autobattler with character attachment.

## Non-goals (hard NO list)

- Not a Clutch-Legend-style 30-round CS match simulator
- Not a tactical strategy game with pause + decision gates (that's just a strategy game you can pause — reject)
- Not a TFT-style 8-player PvP game (single-player only, cheaper + more distinctive)
- Not a Football Manager dashboard-on-dashboard experience
- Not cyberpunk maximalist neon (too expensive to do right, saturated)
- No gradient SaaS cards, no Dicebear avatars, no trademarked feature names, no modal-on-modal onboarding, no fake-locked sidebar items

## References we're building from

- **[Never Second in Rome](refs/never-second-in-rome.md)** — gold standard for indie mgmt-sim UI. Material consistency, hand-pixel-art, density, diegetic framing.
- **[Firefight](refs/firefight.md)** — combat view visual reference. Top-down painted maps, tiny unit sprites, tactical overlays, worn-mil UI chrome.
- **[BattleTech (HBS)](refs/battletech.md)** — merc roster attachment, contract-based mercenary campaign, gear depth, scar system.
- **[Menace (Overhype)](refs/menace.md)** — sci-fi squad tactics, procedural operations, frontier setting. Battle Brothers lineage.
- **[Clutch Legend](refs/clutch-legend.md)** — negative example. What not to do. The whole "low-art Electron mgmt game" tier is currently defined by CL-shaped failures.

## Structure of this repo

```
merc-autobattler/
├── README.md                ← this file
├── spec/
│   ├── 00-vision.md         ← pitch, positioning, who-for
│   ├── 01-core-loop.md      ← run structure, fight structure, time scale
│   ├── 02-open-questions.md ← what we still need to decide
│   └── (more as we decide)
├── refs/                    ← reference game teardowns (CL, NSiR, Firefight, BT, Menace)
└── decisions/               ← Architecture Decision Records (ADRs)
    └── 001-pure-autobattler.md
```

## Status

**Phase 0 — pre-spec.** We've locked the positioning and genre commitments. Most design decisions (synergy system, economy model, setting specifics, unit scale) are still open — see `spec/02-open-questions.md`.

## How to work on this

1. Open `spec/02-open-questions.md` and resolve one question.
2. When a decision is made, record it as an ADR in `decisions/` (copy the `001-pure-autobattler.md` format).
3. Expand the relevant `spec/` doc once the decision is locked.
4. Never reopen an ADR — supersede it with a new one if thinking changes.
