# ADR 002 — Customization depth: MWO-tier available, BT-default surface

**Status:** Accepted
**Date:** 2026-04-20

## Context

"Loadout depth is the game" was clarified in /clarify round 1 (Q1). The open question: how deep does customization go? Fully granular (MechWarrior Online — hardpoints, armor distribution per location, heat management, critical slots) is the deepest commercial reference. BattleTech tabletop and the HBS BattleTech game use a simpler "gear/equipment slot" abstraction that hides internals.

The tradeoff:
- **Deeper = better for the target audience** (sim-mgmt players who want BT-depth — see ADR 002's positioning against CL's thinness)
- **Deeper = wider surface new players bounce off of** — MWO's mech-lab filters ~half the playerbase from engaging with it
- **Deeper = more UI work, more balance work, more tooltip work** — not free

## Decision

**Progressive disclosure.** Default UI surface is BT-level (weapons, armor, equipment, cyberware/utility). Advanced toggle reveals full MWO-level granularity (per-location armor allocation, heat sink placement, critical-slot packing, ammo bin tonnage, engine ratings, etc.).

Apply the same pattern to **all unit types**, not just mechs:
- **Infantry:** basic = weapon + armor + 3 gear slots; advanced = cyberware-by-limb, ammo-load weight, per-limb armor
- **Vehicles:** basic = turret weapon + armor + utility; advanced = per-facing armor, crew loadouts, powerplant tuning
- **Mechs/walkers:** basic = hardpoint loadout; advanced = full MWO-style mech-lab
- **Drones:** basic = payload + AI mode; advanced = component-level

Default players get a coherent tabletop-feeling loadout game. Power users get a spreadsheet-tuning rabbit hole. Both work.

## Consequences

**Positive:**
- Serves two audiences with one system (the CL-tier casual sim player AND the BT hardcore)
- Marketing hook: "BattleTech-depth on the surface, MWO-depth underneath"
- Progressive disclosure is a UX pattern we can ship incrementally (basic first, advanced added in patches)

**Negative:**
- Doubles the customization design work (two coherent surfaces, not one)
- Advanced mode must never produce builds that dominate default-mode builds — balance must hold at both depths
- Every UI screen for loadouts needs both a compact and an expanded rendering

**Cascades into:**
- Unit stat schema (must support both abstractions cleanly)
- Tooltip system (advanced stats appear when toggle is on)
- Save/load format (full granular state always stored, UI just hides it)
- Shop design (does the shop sell "a medium laser" or "medium laser [ER/pulse/standard variants with heat/damage tuning]"? Probably the former at default, latter at advanced)

## Related

- ADR 001 — pure autobattler (customization is the main player agency since there's no in-fight control)
- Spec 02 Q6 — answered
