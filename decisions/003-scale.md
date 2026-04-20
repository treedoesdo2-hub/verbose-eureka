# ADR 003 — Scale: 3 start, battalion ceiling, field cap TBD

**Status:** Accepted (field cap deferred)
**Date:** 2026-04-20

## Context

Squad size and the scale-progression arc determines the shape of the economy, the shop, the UI for commanding large forces, and the combat engine's performance ceiling. Clarify round 1 (Q3) established: start small, grow as economy allows, attachment model is MegaMek/ironman-XCOM style where individuals earn legendary status through performance rather than being narratively pre-anointed.

## Decision

- **Starting force:** ~3 units at campaign start. Can be any mix (3 infantry, 1 mech + 2 drones, 2 APCs, etc. — player chooses during campaign intro).
- **Endgame ceiling:** Battalion-scale. Practical interpretation: ~3–4 companies, each with ~3–4 lances/platoons, each with 3–5 units. Player-managed roster in the low-to-mid hundreds at peak, with only a subset deployed per contract.
- **Field cap (units on screen simultaneously):** **No cap for now.** Start uncapped, let playtesting reveal the cap. If 40-unit fights become visually incomprehensible or performance-tanking, introduce a contract-type-based cap (strike teams cap small; open-field engagements cap large).

## Consequences

**Positive:**
- Scale-growth IS the progression arc — every campaign has a natural rising-action curve
- Late-game complexity provides genuine replay differentiation (different campaigns spec into different force compositions)
- Emergent attachment through performance tracking, not scripted heroes

**Negative / unresolved:**
- **Combat engine performance is now a real concern.** Firefight-tier tiny sprites on a painted map can plausibly handle 30–40 units. Beyond that, UI/AI both strain. Need to benchmark early.
- **Command UI for battalion-scale is non-trivial.** Roster browser, sub-unit assignment, pre-deployment force composition — all need designs.
- **Balance across the scale curve.** The game must be fun at 3 units AND at 80. Very different design problems.
- **Contract pacing at scale.** A 3-unit raid takes ~1 min; a battalion engagement might take 10+ min. Need a pacing system.

## Consequences for UI

Roster needs *hierarchy*: company → platoon/lance → unit. Player commands at the platoon/lance level ("deploy Bravo lance to this contract"), drills into individual units for loadout/status. Analogy: BT's barracks + lance management, scaled up to multiple lances.

## Deferred questions

- **Field cap rule** — revisit after first combat-engine prototype with dummy units
- **Scale-up gating** — what mechanically limits growth? Credits only, or also reputation / facility upgrades / supply capacity?
- **Roster max** — is there a hard ceiling, or purely economic?

## Related

- ADR 002 — customization (at battalion scale, MWO-tier customization per unit is hours of prep; default BT surface becomes essential)
- Spec 02 Q7 — answered with caveats
