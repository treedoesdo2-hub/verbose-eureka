# ADR 006 — Combat pacing: multi-speed, default fast-forward

**Status:** Accepted
**Date:** 2026-04-20

## Context

Clarify round 3 (Q10) asked how long a combat engagement takes in real-world time. User chose "C" — hybrid pacing: 1x is the slow "watchable for obsessives" speed; 4x is the default; slow-down is available for key moments. This matches how BattleTech-game players eventually learn to crank the speed slider.

## Decision

**Playback speed controls:**
- `0.5x` — cinematic slow-mo, for capturing a clutch moment or understanding what went wrong
- `1x` — baseline, "natural" pacing — maps roughly to how fast a real engagement would look
- `2x` — moderate fast-forward
- `4x` — **default starting speed**
- `8x` — "I trust this fight, run it out" — the skip-button replacement

Controls are hotkey-accessible (`,` / `.` / space to cycle, or `1`–`5` for absolute speed) and persist across fights within a campaign.

**Pause** is allowed — but *no input while paused*. Purely observational. Player can pause to examine a status panel, read a log entry, screenshot a moment; they cannot issue orders. This preserves the autobattler commitment (ADR 001).

**Auto-resolve** is available for explicit skips:
- Available after the first 5 seconds of a fight (so you can't skip before the AI has committed to an opening)
- Shows a fast simulation log-summary screen instead of visual combat
- Always available but not the default — intent is visual playback is the reward for investing in prep

## Consequences

**Positive:**
- Small fights (3 units) feel snappy at 4x (~20s real-time for a 90s sim)
- Large fights (battalion) stay tractable at 4x–8x (~2–4 min real-time)
- Slow-mo gives the "clutch moment" highlight-reel experience
- Auto-resolve respects the player's time without killing the visual draw

**Negative:**
- Animation design must be legible at 4x — no subtle-timing animations
- Physics / projectile speed scales with playback speed, which can cause visual glitches at 8x (accept this or implement fixed-timestep sim)
- Sim must be deterministic so auto-resolve output matches visual playback output exactly

**Implementation note:**
- Simulation runs at fixed-tick (60hz or 30hz) internally
- Playback speed is a *renderer* multiplier, not a *sim* multiplier — fixes determinism, allows seamless speed changes

## Related

- ADR 001 — autobattler purity (pause-without-input preserves this)
- ADR 003 — scale (big fights require fast-forward to be tractable)
