# ADR 007 — Contract structure: BattleTech deployment + Shadowrun legwork

**Status:** Accepted
**Date:** 2026-04-20

## Context

Clarify round 3 (Q11) asked what a contract decomposes into. User said: **lean heavily into how BattleTech runs contracts (they are not one-off fights) and how Shadowrun handles these.** This rejects the "TFT-cadence single-fight" model in favor of a multi-phase operation structure.

Key reference mechanics:

**BattleTech (HBS 2018):**
- Accept contract from employer → negotiate (C-Bills vs salvage vs support)
- Travel to target system
- Deploy into multi-mission tour (typically 3–4 missions per contract in HBS; tabletop "tour of duty" can run 6+)
- Casualties/damage **carry between missions within a contract** — no base access mid-tour
- Salvage claimed mid-contract may or may not be deployable before extract
- Payout happens at contract end, not per-mission

**Shadowrun (tabletop + CRPG):**
- Mr. Johnson briefing (who, what, why, paranoia check)
- **Legwork phase** — optional pre-run investment of time/money/rep:
  - Buy intel from fixers (reveals enemy comp, map layout, complications)
  - Bribe officials (removes obstacles, alters objectives)
  - Hire NPC specialists (one-run contractors: face, decker, rigger, sam)
  - Requisition exotic gear
  - Choose insertion/extraction approach
- The run itself = chained encounters (2–4 scenes), with complications fired by how well legwork was done
- Extract → payout → karma/rep consequences

## Decision

**A contract = a multi-phase operation, not a single fight.**

### The five phases

**1. Briefing / Negotiation**
- Contract appears on job board (travel/reputation/faction conditions determine availability)
- Details shown: employer, target faction, location, job type, est. engagements, est. opposition, deadline
- Negotiation knobs: upfront pay ↔ salvage rights ↔ support assets
- Accept / decline / save-for-later

**2. Legwork** *(Shadowrun layer)*
- Optional pre-deployment phase — player spends time / credits / reputation to improve conditions
- Pool of actions: buy intel, bribe, hire NPC extras, buy one-run gear, choose insertion vector
- Every action has a cost and a narrative explanation
- Time spent in legwork can also advance the campaign clock — reserving time for legwork means fewer contracts per campaign year

**3. Deployment** *(BattleTech layer)*
- Multi-mission operation: 1–6 engagements, typical 2–4
- **Can't return to base mid-deployment** — casualties and damage carry forward
- Between engagements: brief staging phase
  - Loadout tweaks only (no hiring, no full repairs)
  - Field-medic style partial recovery possible (at cost)
  - Salvage from prior engagement can be applied if time permits
- Each engagement plays out per combat-engine rules (ADR 006)

**4. Extract / Payout**
- Final engagement frequently = exfil under fire; sometimes = clean extract
- Payout formula: base pay + per-objective bonus + salvage value claimed + support-asset adjustments
- Partial-failure payout possible (didn't complete primary but did complete secondary)

**5. Consequences**
- Faction reputation shifts (multi-axis — see future ADR)
- Narrative achievement triggers (per ADR 005)
- Casualties confirmed KIA / WIA / MIA
- Campaign-timeline advance

### Contract types by length

| Type | Engagements | Legwork | Use |
|---|---|---|---|
| Milk run | 1 | Minimal | Early campaign, low pay, low risk |
| Standard | 2–3 | Moderate | Campaign bread and butter |
| Deep deployment | 4–6 | Heavy | High-tier, big payout, long commit |
| Specialist | 1 complex engagement | Heavy legwork | Shadowrun-style heist: one surgical fight, lots of prep |

## Consequences

**Positive:**
- Much meatier than single-fight contracts — each contract is a mini-narrative
- Casualty stakes amplified by inability to repair mid-deployment
- Legwork phase gives spenders (credits-hoarders) something to spend on
- Specialist contracts create variety in the run — not every contract is "kill everything"
- Matches the target audience's expectations from BT/Shadowrun heritage

**Negative:**
- Run length increases significantly — a campaign of 25 contracts × 3 engagements = 75 fights. At 4x playback that's still 4–6 hours of combat viewing per campaign.
- More design surface: staging-phase UI, legwork-action authoring, contract-type balance
- Deployment-phase state management is non-trivial (track damage/ammo/casualties across a chain)

**Cascades into:**
- Campaign-length design (see ADR 008)
- Economy design — legwork is a money sink, forces pacing choices
- Faction design — factions offer different contract mixes (corpos do specialist heists, militia does milk runs, pirates do deep deployments)
- Save/quit — must be robust mid-deployment (players should be able to quit between engagements within a contract)

## Related

- ADR 005 — meta-persistence (campaign-length is sensitive to contract length)
- ADR 006 — combat pacing (4x default helps tolerate multi-engagement contracts)
- Future spec: `spec/03-contract-structure.md`
