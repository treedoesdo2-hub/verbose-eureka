# 03 — Contract Structure

Elaboration of ADR 007. A single contract is a multi-phase operation, not a fight. This document defines the player-facing flow and the state machine.

## The five phases

### Phase 1 — Briefing / Negotiation

**Trigger:** player selects a contract from the job board.
**Input:** contract parameters (employer, target, location, estimated engagement count, estimated opposition, deadline, proximity).
**Player actions:**
- Negotiate terms (slider interactions between upfront pay / salvage rights / support assets — classic BT trinity)
- Read contract prose (1–3 paragraphs of in-world flavor)
- Review intelligence available to date (may be thin at this stage — that's what legwork is for)
- Accept / decline / save-for-later (hold on board for N campaign-days)

**Output:** accepted contract enters legwork phase; declined contract disappears; saved contract sits on the board consuming a slot.

**UI surface:** a single contract-details screen with tabs for Overview / Terms / Intelligence / Prose. No modal chain.

---

### Phase 2 — Legwork *(optional)*

**Trigger:** contract accepted, player has not yet launched deployment.
**Input:** available legwork actions (seeded by contract type, faction, and player's rep/credits).

**Legwork action pool** (each costs credits / time / reputation; each improves conditions):

| Action | Cost | Effect |
|---|---|---|
| Buy intel — enemy composition | Credits | Reveals enemy unit types, ~counts |
| Buy intel — terrain | Credits | Reveals map layout, objective locations, extraction points |
| Buy intel — complications | Credits + Rep | Reveals mid-deployment twists (reinforcements, weather, civilian presence) |
| Bribe — official | Credits + Rep | Removes an obstacle (e.g., "local garrison will stay out") |
| Hire — NPC specialist | Credits | One-contract contractor (face / decker / rigger / heavy) — cannot die permanently, leaves after |
| Hire — NPC grunt | Credits | One-contract body; can die; not counted against roster |
| Requisition — one-use gear | Credits + Rep | Gear usable only during this contract (shaped charges, stims, smoke) |
| Insertion vector choice | Rep only | Choose entry approach (loud / stealth / night / insertion from N/E/S/W) |
| Delay deadline | Credits | Extends the deadline if one was set; uses campaign time |

**Design rule:** legwork is never *required*. A zero-legwork run is always possible — it's just harder. Min-maxers will legwork heavily; speed-runners will skip.

**Output:** modifiers applied to deployment (known map state, reduced/increased opposition, friendly spawns, new objectives).

**UI surface:** legwork screen is a card-list; each card is an available action with clear cost/effect. Running ledger at top shows total legwork spend so far.

---

### Phase 3 — Deployment

**Trigger:** player commits to launch.

**Structure:**
- Deployment = a chain of 1–6 engagements. Count and flavor set by contract type (see ADR 007 table).
- **No base access during deployment.** Once launched, player is committed until extraction or failure.

**Per-engagement sub-structure:**

```
┌──────────────────────────────────────────────┐
│  PRE-ENGAGEMENT STAGING                      │
│  - Review current unit status (HP, ammo,     │
│    morale, damage per location)              │
│  - Minor loadout tweaks (swap between        │
│    equipped gear; no hiring, no new gear)    │
│  - Apply field-medic actions (cost time,     │
│    partial HP recovery)                      │
│  - Commit to engagement                      │
└────────────────────┬─────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────┐
│  ENGAGEMENT (per combat-engine rules,        │
│   ADR 006 pacing)                            │
└────────────────────┬─────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────┐
│  POST-ENGAGEMENT RESULT                      │
│  - Casualties confirmed (WIA / KIA)          │
│  - Salvage claimed (if time/opportunity)     │
│  - Intel gathered (may alter next engagement)│
│  - If more engagements: loop back to staging │
│  - If last engagement: proceed to Phase 4    │
└──────────────────────────────────────────────┘
```

**Persistent state across a deployment:**
- Unit HP / damage-per-location (mechs, vehicles)
- Ammo remaining per weapon
- Morale / stress / status effects
- Pilot wounds (WIA pilots in a damaged mech may perform worse in next engagement)
- Consumed one-use legwork gear
- KIA — permanent, final at deployment end; WIA can be stabilized with field medic actions

**Failure conditions during deployment:**
- Primary objective failed on any engagement → deployment may still continue (partial contract) or may terminate (contract-dependent)
- Full roster casualty on a single engagement → deployment terminates (emergency extract or loss)
- Player-initiated emergency extract → available from staging phase (penalty applied)

---

### Phase 4 — Extract / Payout

**Trigger:** final engagement resolves OR player triggers emergency extract OR hard failure.

**Payout formula:** `base_pay × completion_fraction + salvage_value + objective_bonuses − legwork_cost − damage_cost`

- `base_pay` from negotiation
- `completion_fraction` from primary + secondary objectives hit
- `salvage_value` from salvage rights claimed during deployment
- `objective_bonuses` for hidden/optional objectives discovered
- `legwork_cost` already spent — not reimbursed on failure
- `damage_cost` — cost to repair/replace damaged mechs, treat wounded pilots, bury dead

**Rare outcomes:**
- Over-performance bonus (employer impressed, future contracts from this faction pay +X%)
- Under-performance penalty (faction rep takes a hit beyond normal)
- Betrayal (employer doesn't pay; reputation with employer drops; possible follow-up revenge contract)

---

### Phase 5 — Consequences

**Automatic, no player input required.**

- Faction reputation updates across all affected factions
- Narrative achievements triggered (if any)
- Casualty roster finalized (KIA additions to Hall of the Fallen — flavor only, per ADR 005)
- Campaign timeline advances
- New contracts generated to replace completed one

**UI surface:** a quick debriefing screen with highlights. Not a modal chain. One screen, scroll to read, continue.

---

## Contract type shorthand (see ADR 007 for full table)

- **Milk run** — 1 engagement, light legwork, low pay. For early campaign and low-risk income.
- **Standard** — 2–3 engagements, moderate legwork. Campaign staple.
- **Deep deployment** — 4–6 engagements, heavy legwork encouraged. High-tier, high-pay, high-risk.
- **Specialist** — 1 complex engagement, heavy legwork required. Shadowrun-style heist.

Balance target: a campaign of 20–40 contracts, median 2.5 engagements, yields 50–100 actual fights per campaign. At 4x playback (ADR 006) that's 3–8 hours of combat-watching per campaign. A full campaign including legwork / staging / meta should target 15–30 real-time hours.

## Open questions for this spec

- Legwork action count per contract — fixed 5, or scaled by contract tier?
- Staging phase duration — is "field-medic action" instant, or does it cost deployment time?
- Emergency extract penalty structure — just lost pay, or faction-rep hit too?
- Betrayal frequency — rare flavor event, or common enough that trust is a real concern?

These unlock during economic-design work later.
