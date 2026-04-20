# 02 — Open Questions

Decisions that need to be made before the spec goes deeper. Each one cascades — resolving it unlocks design work downstream. Loosely ordered by how much they block other things.

## Tier 1 — highest leverage, resolve first

### Q1. Synergy architecture

The core design problem. Three broad patterns:

- **A. Trait stacks (TFT pattern)** — operators have tags like `Sniper`, `Corpo`, `Cyborg`, `Berserker`. Running multiple operators with the same tag activates tiered bonuses (e.g., 2 Snipers: +10% range; 4 Snipers: +25% range + pierce).
- **B. Item adjacency (Bazaar / Backpack Battles pattern)** — operator loadouts are a spatial puzzle; items interact with neighbors in the inventory grid. Gear-centric rather than class-centric.
- **C. Build archetypes (deckbuilder pattern)** — operators and gear produce cards/abilities; the "team" is really a built deck.

**Recommendation:** Trait stacks + light item combos. Squad-scale autobattler wants *squad* synergies to be readable, and item-grid puzzles (B) work better for solo-hero autobattlers than 6-operator teams.

### Q2. Prep economy

How the shop and credits work.

- **A. TFT-classic** — credits per round, variable reroll shop, tier-up thresholds, interest on saved gold
- **B. Backpack-style** — fixed shop per round, pick one or two, no rerolls, lean
- **C. BT-style contract payouts** — credits come only from contract rewards; the "shop" is persistent + refreshes slowly

**Recommendation:** C with A-flavored tactics. BT-style contract payouts give roguelite pacing the meta-tension it needs (every credit counts), with limited rerolls as a skill expression.

### Q3. Unit scale

- **A. Individuals only** (3–6 operators, Firefight-tier infantry-scale)
- **B. Mixed infantry + vehicles/mechs** (BT/Menace-tier, with support units)
- **C. Abstract squads** (each "unit" represents a 5-man fireteam, Mechabellum-adjacent)

**Recommendation:** A, with vehicles as *gear* rather than units (e.g., an operator can be equipped with an Exo-Suit, turning them into a heavy). Keeps sprite count low; keeps attachment focused on named people.

## Tier 2 — resolve soon, block art/content production

### Q4. Setting pocket

Where on the mil-sci-fi / cyberpunk spectrum do we sit?

- **Corpo-frontier (Menace-flavored)** — lawless outer system, cut-off-from-command, corporate interests and pirates
- **Cyberpunk-grunge** — megacity edgerunner crew, fixers, cyberware, street gangs vs corps
- **Post-collapse wasteland** — scavenger convoys, raiders, ruins
- **Hybrid retrofuture** — BattleTech-flavored, Inner-Sphere-esque succession-war merc culture

Setting drives: portraits, terrain biomes, faction design, gear vocab, naming conventions, UI flavor.

### Q5. UI accent color

- **Tactical amber** (phosphor-amber, 70s/80s CRT, BT cockpit, milspec-warm)
- **Tactical cyan** (modern milspec, BT HBS's screens, sci-fi-cool)
- **Phosphor green** (classic terminal, nostalgic, risks looking *too* Fallout)

Recommendation: **amber**. Cyan is everywhere in sci-fi games right now and reads generic. Amber reads specifically military-industrial and is underused.

### Q6. Roster persistence within a run

- **A. Hard permadeath** — dead operators gone forever; wipe = run over
- **B. Knocked-out state** — "dead" operators are severely injured, out for N contracts, return with scars
- **C. Graduated severity** — light wound → bed rest 1 contract, heavy wound → 3 contracts, crit → run-ending

**Recommendation:** C. Rewards smart play, still has devastating outcomes, avoids binary "you're dead now it's over."

## Tier 3 — resolve later, lower urgency

### Q7. Real-time-with-pause or deterministic-per-tick combat simulation?

The combat is autonomous. But is it real-time animation or a tick-based resolver?

- **A. Real-time animation** — continuous movement, Firefight-style
- **B. Tick-based** — discrete turns (e.g., 1 tick per second) resolved sequentially, rendered as animation
- **C. Full determinism** — combat is purely seed+state; animation is a replay of a computed result

Recommendation: **C.** Determinism gives us clean replays, shareable runs, reproducible bug reports, and easier balance. Visual presentation is still real-time playback of the deterministic solve.

### Q8. Art pipeline commits

- Unit sprites: Pixellab (user's existing pipeline) — **assumed**
- Portraits: AI-gen + dither-posterize filter (tbd which tool)
- Terrain maps: AI aerial renders + heavy processing (tbd pipeline, SDXL/Midjourney/custom)
- Equipment icons: bulk-commissioned monochrome SVG, or AI + hand-cleanup

### Q9. Platform and stack

- Electron (confirmed — web tech, cross-platform, matches CL-tier)
- Framework: React / Svelte / SolidJS / vanilla? (user has React experience, but Solid/Svelte are faster and smaller bundle)
- Combat engine: deterministic TypeScript simulator rendered with Canvas or Pixi.js?
- State: Zustand / Redux / custom?
- Save system: local JSON, cloud sync tbd

### Q10. Campaign length and replayability

- Single fixed-length campaign per run (~25 contracts) or variable (player chooses length upfront)?
- How many distinct runs before the game feels "solved"?
- What's the metaprogression ceiling? (Slay the Spire Ascension 20 tier system?)
