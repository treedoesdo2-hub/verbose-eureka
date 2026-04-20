# ADR 001 — Pure autobattler, no in-fight player input

**Status:** Accepted
**Date:** 2026-04-20

## Context

During initial design exploration, "autobattler" was being used loosely to mean "any game where combat resolves as spectacle rather than twitch control." This drifted repeatedly into proposals for:

- Tactical games with pause + decision gates (Firefight-style RTwP)
- Broadcast-match games with inter-round decision gates (FM match engine-style)
- Hybrid "autobattler-ish" with limited player input during combat

All of these are strategy games you can pause. None are autobattlers in the strict genre sense.

The actual autobattler genre (TFT, Auto Chess, Backpack Battles, The Bazaar, Super Auto Pets, Hadean Tactics, Mechabellum) defines itself by the opposite commitment: **zero player input during combat resolution**. This constraint is what creates the distinctive autobattler dynamics — heavy prep-phase depth, synergy-web-as-core-mechanic, rapid iteration of prep→watch→adjust, spectator-as-reward-not-chore.

## Decision

The game is a pure autobattler. Once the player initiates combat, they have **no input** until the fight resolves. Specifically:

- No pauses to issue orders
- No decision gates at combat milestones
- No tactical input of any kind
- Speed controls (1×/2×/3×/skip) and spectator camera are allowed; actions that affect the simulation are not
- Behavior tags / AI-profile assignments are set pre-combat only

## Consequences

**Design consequences:**
- The prep phase carries 100% of player agency. It must be rich, legible, and replayable.
- Synergy architecture becomes the central design problem — it's where creativity and optimization live.
- Unit AI must be smart enough to make good decisions autonomously, because the player can't course-correct. Behavior tags must be expressive enough to meaningfully shape AI without being micromanagement.
- Combat visualization must be legible at a glance — the player is decoding the fight, not driving it.
- Fights must be short (~60–90s) to keep the prep→watch→adjust loop tight.

**Things this rules out:**
- Any "tactical" marketing positioning (we are not a tactical game; we are an autobattler in a tactical-shaped wrapper)
- Any feature that lets players intervene mid-fight, including "emergency rewind" / "timestop" type mechanics
- Any comparison to XCOM, BattleTech tactical mode, Firefight's actual play-loop, or Menace's combat. Those are references for *visual style* only.

## Supersedes / Supersded by

None.

## Related

- `spec/00-vision.md` — the positioning argument
- `spec/01-core-loop.md` — the structural implications
- `spec/02-open-questions.md` Q1, Q2, Q7 — design choices that follow from this
