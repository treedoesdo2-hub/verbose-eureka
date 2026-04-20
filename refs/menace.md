# Ref — Menace (Overhype Studios, Feb 2026)

**What it is:** Sci-fi turn-based tactical RPG. Developed by Overhype (the Battle Brothers devs). Early Access Feb 2026. Setting: the "Wayback system," a cut-off lawless sci-fi frontier. Military commander premise. 50+ mission types, tanks/walkers/infantry, procedural multi-mission operations.

## Why it's in this repo

User has identified Menace as a spiritual reference alongside BattleTech. Specifically inherits BB's attention to roster-attachment, injury/scar systems, and gritty tactical depth — but in a sci-fi setting. Overhype's Battle Brothers was user's entry point to this design space (they've modded BB).

## What we steal from Menace

### Frontier sci-fi tone

"Cut off from the chain of command, lawless Wayback system." Cynical mil-sci-fi, not chrome-neon cyberpunk. This is a strong flavor pocket:
- Inner sphere is corrupt / absent
- You're on your own, making hard calls
- Moral compromises are the default, not the exception
- Enemies are strange, resources are scarce
- The setting has heat-death vibes — a future that's rusting

**Consider locking this as our setting (Q4 resolution).** It's distinctive, doesn't overlap with Cyberpunk's visual crowding, and gives a clear tonal commitment (ALIEN/Expanse/Warhammer40K-lite, not Night City).

### Procedural multi-mission operations

Menace chains missions into "operations" — a sequence of linked objectives where outcomes of mission 1 affect mission 2. This is more interesting than standalone contracts.

**Port as:** some contracts are multi-stage operations (2–4 linked fights). Each stage's outcome affects the next. Casualties persist between stages. This creates mini-arcs within a run.

### Gear depth + unit composition

Menace has "a massive selection of equipment" + tanks, walkers, and infantry squads. Gear-heavy tactical RPG with real loadout decisions.

**Port:** operator gear is the primary mid-term progression. Weapons, armor, cyberware (if cyberpunk-flavor), consumables. ~80–120 equipment items across tiers.

### Procedurally generated battle maps

Menace generates tactical maps per mission. This lets them ship 50+ missions without hand-authoring 50 maps.

**Port consideration:** procedural terrain with hand-curated biome seeds. Our 20–40 painted maps become 20–40 *biome templates* that procedurally decorate + drop features. Increases replayability. Complicates art pipeline.

### Training + roster management

Menace has "train your troops" as explicit system. Not just combat-earned XP — between-mission training actions.

**Port:** downtime actions in the hub (rest, train, heal, scout). Each operator can do one per "turn" (which here = between contracts, not mid-contract).

## What we DON'T port

- **Fully turn-based tactical combat with player control.** We are autobattler. Menace gameplay is XCOM-adjacent, moment-to-moment unit control.
- **Vehicles/mechs as primary units.** Pending Q3, but current recommendation is infantry-only with vehicles/exos as equipment.
- **40+ hour campaign.** We are run-based, 45–75 min per run.
- **Menace's specific setting and lore.** Similar frontier tone, not the same universe.

## The "we're the casual-autobattler in this space" pitch

If BattleTech and Menace are hardcore tactical RPG sims for the genre fan who wants 40 hours per campaign — **we are the snack-sized autobattler alternative in the same tonal space**. Same gritty merc-frontier vibe. Same attachment to named operators. Same gear depth. But in 45-minute runs you can fit in an evening, with zero in-fight input so you can play while half-watching a stream. That's a real, specific audience.
