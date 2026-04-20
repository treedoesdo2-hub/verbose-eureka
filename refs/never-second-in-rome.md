# Ref — Never Second in Rome

**What it is:** Turn-based historical RPG / management sim where you play a Roman centurion in Caesar's army. Developed by Alessandro Roberti. Unity. Steam EA Feb 2025. Steam app 3169580. 81% positive (~500 reviews).

## IMPORTANT: scope correction (2026-04-20)

Earlier framing called NSiR a **"UI gold standard"** and drifted into recommending its diegetic material aesthetic (carved wood, parchment, bronze borders, cobblestone). **User rejected this direction outright in /clarify round 3 (Q13).** See ADR 009 for the authoritative UI philosophy.

NSiR is no longer a **visual / material** reference. It remains a reference for:
- Information density in a complex sim
- Multi-axis reputation modeling
- Two-scale management (individual character + unit under command)
- Text-based narrative events with embedded skill checks
- Combat-as-readable-data pacing

What we do NOT steal from NSiR:
- Material metaphor (wood / parchment / bronze)
- Hand-pixel-art aesthetic
- Diegetic chrome of any kind
- Warm thematic palette tied to setting
- Any visual-identity cue

## What still transfers

### Multi-axis reputation

NSiR tracks six reputation axes visible on the character sheet: Valor, Humanitas, Integrity, Religion, Caesar's Opinion, Troop's Opinion. Each decision pushes multiple needles. This is the template for our faction system — multi-axis rep, every contract touches multiple needles, events become meaningful because every choice has consequences on more than one axis.

### Text-based events as skill checks

NSiR's narrative event screen shows a story text pane + an embedded skill check with performer, ability, and difficulty meter. This is the template for our "between-contract" events — narrative vignettes that present choices gated by the current squad's stats and affect multiple reputation axes.

### Two-scale management

NSiR has the player character (Titus Naevius the man, with attributes/skills/morale/fatigue) AND the Century under him (as a unit with discipline/cohesion/equipment). We port the *mechanical* two-scale idea: individual operators with full stats/progression AND the squad/company as a meaningful meta-unit. (ADR 005 removes the *avatar* — we have no player-character figure — but the squad-vs-individual dual-scale management still applies.)

### Information density

NSiR's combat screen shows ~40+ data points simultaneously without feeling cluttered. Bounded panels, clear hierarchy, aligned numbers. The *discipline* (density + readability in tension with each other) ports directly. The *execution* (bounded wooden frames) does not — we solve it with flat panels and 1px borders per ADR 009.

### Combat as readable data

NSiR's combat screen is rich data: momentum bar, commitment slider, combat log scrolling on the right, unit-state panels on top. No animation-heavy simulation — the fight is a data narrative. **Caveat:** NSiR is turn-based-with-player-input; we are autobattler. The visual-density and data-readability lessons transfer; the player-input model does not.

## Explicit non-ports

- **NSiR's aesthetic** (Roman-parchment-bronze) — not because it's setting-specific, but because material-metaphor chrome is rejected outright (ADR 009)
- **NSiR's turn-based tactical combat with player input** — our combat is autonomous autobattler (ADR 001)
- **"One consistent pixel-art style everywhere"** — our art style is flat web UI for everything except the combat view, and the combat view follows Firefight-tier tiny-sprite pragmatism (see `refs/firefight.md`)

## Why Clutch Legend still loses to NSiR, in the terms that actually matter

After the aesthetic correction, NSiR's advantages over CL reduce to:
- Consistent visual language (NSiR = one system, CL = five)
- Information density without clutter (NSiR = packed, CL = empty)
- No fake-locked features (NSiR = ships what it shows, CL = teases)
- No modal chain hell (NSiR = one screen at a time, CL = five sequential takeovers)
- No trademarked ™ feature names in-product

Every one of these advantages is available to us with a flat web-app UI. None of them require wood frames.

## Screenshots cached

`C:\Users\User\AppData\Local\Temp\nsir_refs\header.jpg` + `shot_0.jpg` through `shot_5.jpg`. Reference when discussing information-density strategies, NOT when discussing visual style.
