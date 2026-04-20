# ADR 004 — Unit typology: all types, readability deferred

**Status:** Accepted
**Date:** 2026-04-20

## Context

Clarify round 1 (Q8) asked which unit types exist in the game. User chose "all of them" — infantry, powered armor / exo-suits, vehicles (crewed), mechs/walkers (single-pilot), drones (AI-controlled), cyberware-heavy humans (as operator class not distinct type). Readability concerns (silhouette design, sprite distinctiveness) were explicitly deferred: "we're cleaving close to the CL model regarding visual fidelity."

## Decision

**All unit types are in scope.** The typology:

| Type | Crew | Scale | Equipment surface |
|---|---|---|---|
| Infantry | 1 human | Smallest | Weapon + armor + 3 gear slots + cyberware |
| Cyberware-heavy | 1 human (class variant) | Same as infantry | Same + expanded cyberware surface |
| Powered armor / exo-suit | 1 human | Mid-small | Hardpoint weapons + frame + powerpack |
| Drone | 0 (AI, pilot-linked) | Small | Payload + chassis + AI mode |
| Vehicle (crewed) | 2–6 humans | Mid | Turret weapon + armor per facing + crew roles |
| Walker / mech | 1 human | Mid-large | Full MWO-style hardpoint loadout |

Cyberware-heavy humans are a **class/operator variant**, not a distinct unit type — they occupy an infantry slot but have an expanded customization surface.

## Consequences

**Positive:**
- Faction design is easier — each faction can emphasize different unit-type mixes (corpo megacorps push mechs, street crews push cyberware-heavy + drones, frontier militia pushes infantry + vehicles)
- Tabletop-feeling force composition (you pick a balanced force across types, like BT lance-building)
- Every customization system from ADR 002 gets exercised

**Negative / accepted risks:**
- **Readability at scale is a real problem.** 40 units on a painted top-down map, mixing infantry + mechs + vehicles + drones, can become visual noise. Silhouette design is deferred, not free.
- **Art pipeline scope is wider.** Each unit type needs its own sprite set, its own damage states, its own destruction animations. Pixellab-tier pipeline still works but production time multiplies by type-count.
- **AI complexity.** Each unit type has different optimal behavior (infantry uses cover, mechs mass-fire, drones scout, vehicles anchor). The autobattler AI must handle all of them.

## Visual-fidelity commitment

Explicit: we're at **CL-tier visuals**. This means:
- Tiny sprites, not hand-painted per-unit portraits in combat
- Palette-swap variants acceptable for faction differentiation
- Animation budget is low (idle + move + fire + die, maybe 6–8 frames each)
- Readability solved through UI (icons, bars, selection highlights) not sprite distinction alone
- If something becomes visually unreadable, prefer a UI overlay fix over more sprite art

## Deferred

- Silhouette / readability design — revisit after combat-engine prototype with mixed-type battles
- Unit-class count per type — how many infantry subtypes, how many mech chassis, etc.
- Crew mechanic for vehicles — do crew members have individual stats/names, or is the vehicle the atomic unit?

## Related

- ADR 002 — customization depth applies per unit type
- ADR 003 — scale amplifies typology visibility problems
- Spec 02 Q8 — answered with visual-fidelity caveat
