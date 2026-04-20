# 00 — Vision

## Pitch

You're the commander of a merc crew operating on the frontier of corporate space (or a cyberpunk-adjacent equivalent TBD). Each run spans a campaign of ~25–30 contracts. You recruit operators, equip them, choose their positioning and behavior, then watch them fight autonomously. Survive, loot, level the survivors, and push deeper into harder contracts until a run-ending boss fight.

This is a pure autobattler in the **Backpack Battles / Hadean Tactics / The Bazaar** lineage. Not TFT-style PvP. Not BattleTech-style tactical strategy. All input is pre-combat. Once you press GO, you spectate.

## Positioning (the market argument)

The "low-art, web-tech-wrapped, Electron indie management game" tier is currently defined by **Clutch Legend**-shaped failures: ugly SaaS-dashboard UI, shallow systems, sim-fidelity traps that players skip. That tier is commercially valid — these games sell — but the bar is hilariously low. **We beat it by shipping a game that actually looks good and plays deep, using the same budget envelope.**

The mil-sci-fi-squad-autobattler pocket specifically is empty:
- **Mechabellum** occupies "huge-scale army autobattler"
- **Backpack Battles / Bazaar** occupy "item-combo fantasy autobattler"
- **Super Auto Pets / Storybook Brawl** occupy "cute PvP autobattler"
- **Mercenary squad, Firefight-tier tactical resolution, character-attachment with permadeath, BT/Menace flavor** → nobody.

## Who it's for

- Sim-management players who want depth but will settle for low-art-high-systems (BattleTech, Menace, Battle Brothers, NSiR audience)
- Autobattler players tired of fantasy/cute aesthetics (TFT/Bazaar refugees looking for tone)
- Roguelite fans who enjoy run-based systems with meta-progression (Slay the Spire, Inscryption, Hadean Tactics audience)
- Players who specifically resent Electron shovelware (CL, knock-off esports managers) but would buy one that's actually good

## What it is NOT for

- Twitch / action players (zero real-time input)
- AAA-graphics chasers (visual budget is intentionally bounded)
- PvP / multiplayer competitive players (single-player only)
- Open-world sandbox expectations (runs are tight, bounded, replayable)

## The three commitments (non-negotiable)

1. **Pure autobattler.** Zero player input during combat. All agency is pre-fight. Decision gates during combat are a rejection mode we catch in review.
2. **Low-art is a design commitment, not a compromise.** We lean into mil-sci-fi readouts-as-visual-language. Unit sprites are tiny. Portraits are dithered. Terrain is painted top-down. The UI *is* the production value.
3. **Accessible UI is the moat.** Every UI-commitment we fail to hit is a competitive gift to the next CL-tier shovelware. See `spec/09-ui-kit.md` when written — keyboard-first, one-modal-pattern, discoverable, dense-but-readable, no fake-locked features, tabular figures, colorblind-correct.
