# 06 — Loadout System

The game's central mechanic (P1). Loadouts are where the player's agency lives. This spec defines the data model, packing rules, UX surfaces, and unit-type-specific variations.

## One-paragraph summary

Two inventory paradigms exist: **infantry** (body-anatomy spatial packing) and **everything else** (chassis-constrained tonnage + crit-slot packing with typed hardpoints). Buying gear fills a company-level **stockpile**; equipping pulls from stockpile onto units. **Templates** make battalion-scale management tractable — player-definable role configs applied across squads, nestable, overridable per-unit. **Progressive disclosure** (ADR 002) gives default players a BT-level surface and advanced players MWO-level depth over the same underlying data.

---

## Part 1 — The two paradigms

### Paradigm A: Infantry (body-anatomy spatial)

Each infantry unit is a body with anatomical zones. Gear has physical footprint — weight, volume, and which zones it occupies. Loadout validity is a packing problem against real physical constraints (can't layer plates, can't hold three rifles, etc.).

### Paradigm B: Non-infantry (chassis + crit slots)

Unit = a chassis, bought as an atomic entity. The chassis defines tonnage budget, crit-slot layout, hardpoint types and locations, powerplant mount, inherent sensor package, and crew positions. Customization happens within those constraints.

All non-infantry unit types (vehicles, mechs, powered armor, drones) share this paradigm. What varies between them is *parameters*: how many locations, which hardpoint types are valid, scale of budget.

**Why two paradigms instead of one:** infantry customization is about *what someone is carrying* (intuitive, anatomical, flexible). Non-infantry customization is about *what fits into a vehicle's designed mount points* (engineered, constrained, pre-spec'd). Forcing infantry into crit-slot packing loses the "what's in her chest rig" feel; forcing vehicles into anatomical packing produces nonsense ("a tank's left arm").

---

## Part 2 — Infantry loadout

### Body zones

| Zone | Volume budget | Armor layer | Primary use |
|---|---|---|---|
| Head | Small | 1 slot | Helmet, optics, comms headset |
| Torso — front | Medium | 1 plate slot | Plate carrier front, chest rig |
| Torso — back | Medium | 1 plate slot | Back plate, pack mount anchor |
| Arm (L) | Small | Optional pad/sleeve | Cyberware + minor items |
| Arm (R) | Small | Optional pad/sleeve | Cyberware + minor items |
| Hand (L) | 1 grip | n/a | Weapons held here |
| Hand (R) | 1 grip | n/a | Weapons held here |
| Waist / belt | Medium | n/a | Holsters, IFAK, pouches |
| Leg (L) | Small | Optional plate | Cyberware, holsters |
| Leg (R) | Small | Optional plate | Cyberware, holsters |
| Back mount | Large (1 large-item slot) | n/a | Rucksack, LAW, specialist kit |
| Internal cavity | Separate pool | n/a | Cyberware (organs, spine, nerves) |

### Packing rules

- **Armor layer:** one plate per zone. No stacking hard plates over soft armor over plates.
- **Hand rule:** rifles/long-arms consume both hands. Pistols/knives/utilities consume one. Items in holsters/slings are carried but not *in-hand*.
- **Back mount rule:** one large item at a time (rucksack, LAW launcher, specialist case).
- **Internal rule:** cyberware occupying body cavity (implants, nervous system) is a separate capacity pool, doesn't compete with worn gear.
- **Physiology-altering cyberware:** flagged on the item; occupies external zone capacity in addition to internal (a full dermal-plated torso blocks wearing a plate carrier over it).
- **Encumbrance:** weight + volume together produce an encumbrance score; over thresholds the soldier is slowed, loses accuracy, tires faster. Green troops overload; veterans know what to leave behind.

### Default slot surface (maps to zones via templates)

Default mode shows abstracted "slots" — these are convenient labels mapping to zone placements via an internal template:

- `PRIMARY WEAPON` → hands L+R (long-arm) or hand R (pistol)
- `SIDEARM` → waist holster (default), hand L (if free)
- `BODY ARMOR` → torso front + back plate slots
- `HELMET` → head
- `UTILITY × 3` → belt/chest-rig/leg pouches, auto-assigned by gear type (grenades → chest rig, med kits → belt, climbing kit → back mount)
- `CYBERWARE × N` → internal + surface slots per implant definition

### Advanced mode

Exposes the raw zone grid. Player manually packs items into specific zones, sees conflicts/encumbrance directly, optimizes to gram+volume level.

---

## Part 3 — Non-infantry loadout (shared paradigm)

### Chassis properties (universal across vehicles/mechs/PA/drones)

Every non-infantry chassis declares:

- **Weight class** (light/medium/heavy/assault for mechs; light/medium/heavy/superheavy for vehicles; etc.)
- **Role tag** (scout, IFV, MBT, assault, EW, transport…)
- **Total tonnage budget**
- **Locations** (varies by unit type — 1 for vehicles/drones, 4 for PA, 8 for mechs)
- **Per-location crit slots**
- **Per-location hardpoints** (count + type)
- **Armor budget distribution** (varies by unit type — see Part 4)
- **Powerplant slot** (swappable across all non-infantry)
- **Inherent sensor package** (baseline; modules can augment)
- **Crew positions** (vehicles; mechs have single pilot; drones have operator-link; PA has pilot)
- **Omni flag** (mechs only — declares whether hardpoints are pod-swappable)
- **Rarity tier** (common through legendary; determines hardpoint count, tonnage efficiency, crit density)

### Hardpoint types (5 classes)

| Type | Weapon examples |
|---|---|
| Energy | Lasers, PPC, flamers, plasma |
| Ballistic | Autocannons, gauss, machine guns, coilguns |
| Missile | LRM, SRM, rocket pods, ATGM, MLRS |
| Support | ECM, BAP, TAG, C3, anti-missile, comms boosters |
| Melee | Hatchets, swords, retractable blades, maces (mechs/PA primarily) |

### Tonnage + crit slots = the two-budget constraint

Every item consumes both tonnage and crit slots. An AC-10 might be 12 tons + 7 crit slots. Armor is tonnage-only (no crit slot cost — it lives in the dedicated armor budget). Engines and heat sinks consume tonnage and crit slots per their type.

Tonnage-over = weight budget exceeded, invalid. Crit-slots-over = physical packing failed, invalid. Both must pass.

### Powerplant (swappable)

All non-infantry chassis have swappable powerplants. Different powerplants trade:
- Speed / top-speed ceiling
- Range / operating duration (drones: battery life; vehicles: fuel range)
- Tonnage cost
- Heat generation (mechs)
- Noise signature (stealth-relevant for scouts)

### Heat management (mechs primarily; relevant to PA)

Heat system governs energy-weapon fire rate and component stress.

- **Default surface:** a single "thermal tier" slider (1–10 scale) that summarizes sink count. Player tunes high-low based on expected combat profile.
- **Advanced surface:** per-location heat sink placement (single vs double sinks, crit-slot cost, engine-internal vs external). MWO-standard depth.

Heat matters less for vehicles (most weapons are kinetic) and PA (smaller powerplants dissipate enough for most loadouts). Drones rarely engage long enough to overheat.

### Omni-chassis (mechs; rare)

Certain rare chassis are "omni" — their hardpoints are pod-based, swappable between configurations without shop-level refits. Omni-chassis are tier-unlock or faction-locked rewards. They offer flexibility at the cost of rarity (harder to acquire, more expensive to refit pods with top-tier gear).

---

## Part 4 — Unit-type specifics

### Vehicles (1 location, 6 armor facings)

- **Locations:** 1 ("hull") — single crit slot pool shared across the vehicle
- **Armor facings:** 6 — Front / L-Side / R-Side / Rear / Top / Bottom. Per-facing tonnage allocation. Top-attack munitions (Javelin, drones) make Top armor tactically relevant.
- **Hardpoints by position:** Turret / Sponson / Coax / Pintle (RWS) / Remote weapon — each hardpoint has a physical location on the chassis determining firing arcs and vulnerability.
- **Crew positions:** Commander / Driver / Gunner / Loader / (role-specific: radio op, spotter, passenger slots). Each is a full infantry slot — operator skills apply. Understaffed vehicles operate with penalties (no loader = slower ROF, no commander = poor spotting).
- **Powerplant swap:** engine options within chassis-defined class.

### Mechs (8 locations, per-location armor front/rear)

- **Locations (8):** Head (H), Center Torso (CT), Left Torso (LT), Right Torso (RT), Left Arm (LA), Right Arm (RA), Left Leg (LL), Right Leg (RL)
- **Engine** lives in CT (consumes crit slots there; some larger engines extend into side torsos). Engine destruction = mech destroyed.
- **Per-location max armor:** chassis-defined ceiling; player allocates tonnage within budget. Torsos split front/rear — thin rear armor is a classic flanking vulnerability.
- **Per-location hardpoints:** chassis-defined count and types per location. A Catapult might have 2 missile hardpoints per side torso; an Atlas has hardpoints distributed across CT, torsos, and arms.
- **Crit slots per location:** chassis-defined; generally larger locations (CT, torsos) have more slots than extremities (head, legs). MWO-standard counts (12 for torsos, 12 for arms, 6 for head/legs) are the starting reference.
- **Jump jets:** equipment class; mounted in crit slots; consume tonnage. Chassis has max JJ capacity ceiling.
- **Melee hardpoints:** arm-mounted melee weapons (hatchet, sword, retractable blade) are a 5th hardpoint type. Distinct from base-action fist/stomp attacks that all mechs have.
- **Pilot:** single pilot. Has a full infantry loadout underneath (default "Standard Pilot Kit" template). Ejection is default-standard on most chassis.
- **Heat sinks:** default slider in basic UI; advanced UI exposes per-location sink placement and single/double/Clan-double sink types.
- **Omni flag:** some rare chassis are omnimech-equivalent — flex-typed hardpoints, pod swaps cheaper.

### Powered armor (4 locations, simpler armor)

- **Locations (4):** Helmet / Torso / Arms / Legs — arms and legs are paired into single locations (no L/R split at this scale)
- **Crit slots:** small pool (~20 distributed across locations)
- **Hardpoint types:** Energy / Ballistic / Support (no Missile by default; rare heavier frames may unlock). Melee hardpoints possible (PA combat knives, crush gauntlets).
- **Armor:** torso has front+rear; other locations are single-pool.
- **Jump jets:** possible on heavier frames.
- **Powerpack:** swappable (like a mech's engine, smaller scale).
- **Pilot loadout constraint:** frame imposes an **internal-space budget** on the pilot's infantry loadout. Light/fast frames allow pilot to wear only a flight suit + pistol. Heavy "assault armor" frames may allow full body armor + sidearms underneath. Frame spec sheet includes "pilot space" rating.
- **Mid-fight eject (per Q18.17):** pilot can dismount during combat. Frame is abandoned salvage. Pilot becomes dismounted infantry with whatever gear they had on (usually very little). Tactically a step down but can save pilot life.
- **Recovery branches:**
  - **Dismount-and-drag:** pilot ejects, squadmate drags infantry body (standard infantry CASEVAC)
  - **Frame-tow:** pilot stays unconscious inside frame, squadmate drags whole PA unit (heavier, slower, may need specialized tow equipment — exoskeleton, winch vehicle)

### Drones (1 location, CPU-driven skill)

- **Locations:** 1 for micro/light (single body pool). 4 facings for medium+ if directional armor matters at that scale.
- **Crit slots:** very small pool (8–15 depending on size class).
- **Hardpoint types:** Payload slots — Weapon / Sensor / EW / Utility.
- **Powerplant:** battery or fuel cell; constrains **duration** not heat. Drones time out; longer-duration powerplants trade tonnage for endurance.
- **CPU component (key!):** a dedicated crit-slot component that determines the drone's autonomous AI quality. Directly analogous to infantry skill tiers. Low-tier CPU = "stand and shoot" battle-droid behavior. Top-tier CPU = rivals elite human operators; may exceed them in some dimensions (reaction time, perfect memory of terrain seen).
- **Operator link:** a named operator at command adds their skill to the drone's effective capability. Link-severed (via EW) = drone falls back to pure CPU quality. Expensive CPUs shrug off link loss; cheap CPUs go helpless.
- **Size classes:** Micro / Light / Medium / Heavy — all four in scope, shared data model, tier differences are mostly number-tuning.

---

## Part 5 — Cross-cutting systems

### Rarity (chassis + components, both axes)

- **Item-type rarity:** AK-220 is always common. Zasdan Reaver Gauss Rifle is always rare. Rarity is a property of the *type*, not the instance. Common items are widely available in shops; rare items appear occasionally; legendary items are faction-locked or earned.
- **Chassis rarity:** same principle applied to chassis. A Shadow Hawk is common; a Battlemaster variant with Star-League-lostech hardpoints is legendary.
- **Two progression axes:** you can find a rare chassis (like finding a Catapult K2) and equip it with mostly common components, OR you can run a common Commando and pack it with rare ER PPCs. Both are progression.

### Quality (per-instance modifier)

Each item *instance* carries a quality modifier independent of type rarity:

- **Stock:** baseline stats
- **Refurbished:** minor penalty (reliability, durability)
- **Mint:** baseline + small bonus (reliability, condition)
- **Custom-tuned:** meaningful bonus in exchange for credits + a gunsmith operator skill check

So: your operator's AK-220 (common, refurbished) and her partner's AK-220 (common, custom-tuned) are both AK-220s but perform differently. Opens a secondary economy (gunsmithing, custom-tuning) that long-run players engage with.

### Cyberware rules

- **Default:** cyberware is internal (body cavity, nervous system, bone lattice). Doesn't compete with external worn gear.
- **Physiology-altering exception:** cyberware flagged as altering external physiology (full limb replacement, extensive subdermal plating, protruding muscle grafts) occupies both the internal pool AND the external body-zone that it modifies.
- **Installation:** requires facility (ripperdoc / medbay — base-level upgrade), credits, and 1–3 campaign days depending on implant severity.
- **Failure risk:** surgery is always risky. Install can fail; failure = extended time out of action (severe for limb replacement, moderate for minor implants), not destroyed implant. Scales with procedure complexity. Not save-scum-triggering.
- **Removal:** possible at cost (credits + time + stress/morale penalty). Not free; not impossible.

### Pilot / crew loadouts underneath (DF sim fidelity)

Every pilot, driver, commander, or crewmember assigned to a vehicle, mech, or PA frame is a full-fidelity infantry unit with their own loadout underneath. This matters for:

- Ejection (mechs) or dismount (PA) — pilot arrives as infantry
- Vehicle penetration — shrapnel + spall affects crew; their armor matters
- Boarding / capture — infantry vs crew in enclosed vehicle spaces
- Out-of-combat narrative events — pilot kit determines survival scenarios

UX mitigation: **"Standard Pilot Kit" templates** per unit type. Assign template once, every new pilot inherits it. Advanced players can per-pilot-tune.

### Templates (first-class UX)

The mechanism that makes battalion-scale loadouts tractable.

**Template types:**
- **Infantry role templates:** "Veteran Rifleman", "Corpsman", "Designated Marksman", "Breacher", "Sapper", "Commo", etc. Define preferred weapons, armor loadout, utility pouches, cyberware priorities.
- **Squad templates:** define distribution of role templates across a squad (e.g., "Standard Rifle Squad: 1 IC, 1 Corpsman, 2 Riflemen, 1 Marksman, 1 Grenadier"). Squad templates reference role templates.
- **Vehicle/mech loadout templates:** per-chassis saved loadouts. "My standard Atlas build" saved as template; apply to any Atlas.
- **Pilot-kit templates:** what pilots underneath mechs/PA carry by default.

**Template operations:**
- Name, tag, save, load, duplicate, rename
- Apply template to N units in one action
- Per-unit override after template application (overrides don't desync — template changes propagate, overrides remain)
- Share templates across the campaign
- Import/export templates as text (meta-feature: share with other players online, though no built-in netcode)

**Where templates live in UX:**
- Armory → Templates tab (top-level surface, not buried)
- Roster detail view → "Apply template" action button prominent
- Shop → "Stock per template" button (e.g., "Buy enough kit to outfit 12 Standard Riflemen"); computes delta against current stockpile

### Stockpile (separate from loadout)

Buying gear puts it in a **company-level stockpile**, not on a unit. Equipping pulls from stockpile onto unit loadouts. Two distinct screens.

**Stockpile surface:**
- Inventory list: item type, quality, quantity, tonnage-in-stockpile, location-tag (HQ / deployed-to-unit-X / in-transit)
- Sort/filter by type, rarity, quality, weight, date acquired
- Bulk operations (sell N of item Y, mark set aside for role Z)
- Reserve/allocate: mark items as "reserved for the DMR squad" to prevent accidentally auto-assigning them to a rifleman

**Loadout surface (per unit or template):**
- Draws from stockpile on equip
- On unequip, returns to stockpile
- On destruction/loss, removes from stockpile permanently (with damage/salvage nuances)

**Why this matters:** at battalion scale, the stockpile IS the armory economy. Seeing that you have 200 AK-220s but only 40 plate carriers is a logistics problem the player engages with. Merging shop + loadout into one surface breaks this.

---

## Part 6 — Advanced mode mapping (per ADR 002)

What's hidden by default vs exposed in advanced mode, across the system:

| Surface | Default | Advanced |
|---|---|---|
| Infantry zones | Abstracted "slots" mapped via template | Raw body-zone grid, weight+volume explicit |
| Utility slots | Auto-assigned to zones | Manual zone packing |
| Vehicle armor | Per-chassis presets ("Balanced / Frontal / Light") | Per-facing tonnage slider |
| Mech armor | Per-location preset | Per-location front/rear slider |
| Mech heat sinks | Thermal tier slider (1–10) | Per-sink placement, single/double/Clan-double choice |
| Crit slot packing | Implicit (UI manages) | Explicit grid packing, drag-and-drop |
| Engine tuning | Swap-only (pick from list) | Per-engine rating tuning, fuel mix, governor |
| Cyberware placement | Internal auto-assigned | Manual organ/nerve slot placement |

Advanced mode is a toggle, not a mode-switch. Any player can flip sections individually (advanced armor but default hardpoints, for instance).

---

## Part 7 — Open questions (deferred to later specs)

Questions that loadout spec surfaces but don't need to answer now:

- **Economy pricing curve:** what does a common AK-220 cost vs a rare Reaver Gauss? Deferred to economy spec.
- **Salvage rules:** what fraction of enemy gear enters stockpile after a fight? Tied to contract negotiation (ADR 007). Deferred.
- **Shop inventory rotation:** how often does shop stock refresh? What determines availability? Deferred to economy spec.
- **Cyberware market:** black market vs corporate vs military-surplus — does every faction offer cyberware, or only specialists? Deferred to faction spec.
- **Gunsmith operator skill:** does custom-tuning require a specialist pilot skill? Or a facility? Deferred to roster/skill spec.
- **Gear condition / wear:** does gear degrade over time? Need repair? Deferred to economy spec.
- **Ammo as stockpile item:** do we track ammo bins per gun per campaign, or abstract as "enough ammo for the deployment"? Most mgmt sims abstract. Decide during MVP scoping.
- **Template portability:** can templates be imported/exported across campaigns (meta-progression)? Deferred to meta spec.

---

## Status

**Accepted.** Derived from ADRs 001, 002, 004, 005, and core pillars. Round 5 clarify sequence (Q18–Q22) fully captured.

## Related

- ADR 002 — Progressive disclosure philosophy, applied here extensively
- ADR 004 — Unit typology, now has data-model grounding
- ADR 005 — Meta-persistence (templates + stockpile are *within-campaign* only; meta-persistence handles *between-campaign* unlocks)
- `spec/05-core-pillars.md` — P1 (loadout primary agency), P5 (management-sim first), P4 (sim fidelity) all heavily relevant
