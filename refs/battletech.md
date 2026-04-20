# Ref — BattleTech (HBS, 2018)

**What it is:** Turn-based tactical mech combat with mercenary management meta-layer. Developed by Harebrained Schemes. Based on the BattleTech tabletop IP. Inner Sphere setting, post-Succession-Wars mercenary period.

## What we steal from BT

### The mercenary fantasy

- You run a merc company (the Argo, in BT's case) — a ship/hideout that persists between contracts
- You pick contracts from a shortlist, each has **negotiation** (upfront pay vs salvage vs support)
- Contracts come from **factions** (Great Houses, corps) with lasting rep consequences
- Operators (pilots) are named people with callsigns, not anonymous units
- **Permadeath-with-gradations** — pilots can be knocked out for weeks, get scars, or actually die

### Faction-rep economics

Factions: Federated Suns, Lyran Commonwealth, Taurian Concordat, Aurigan Reach, pirates, etc. Each has its own contract pool. Work for one → gain rep → unlock better contracts → but burn other factions → harder world to navigate.

**Port as-is** with sci-fi-flavor names. 4–6 factions is enough. Every contract shifts multiple needles (NSiR pattern).

### Salvage + modular gear

Every mech is a **chassis + N component slots**. After a fight, you salvage wrecked enemy equipment. Customization is where the real game lives — you'll spend hours in the Mech Bay.

**Port:** operator gear is modular. Scavenge after fights. Customize loadouts between contracts. Equipment *is* the mid-term progression.

### Pilot progression and attachment

Each pilot has:
- Name + callsign + portrait + voice lines
- 4 skills that improve with use (Gunnery, Piloting, Guts, Tactics)
- Traits earned over time (Called Shot Mastery, Ace Pilot, etc.)
- Backstory

The *named-character-attachment* is the engine. When Glitch gets her leg blown off, you care. When Medusa dies on a contract, you grieve. This is the emotional core.

**Port directly.** Operators have callsigns, portraits, skill progressions, earned traits, and can die permanently.

### The Argo (home base)

Between contracts: the ship hub. Visit MedBay (injured pilots), Mech Bay (customization), Command Center (contract selection), Bridge (travel), Captain's Quarters (narrative events). Each is a discrete screen.

**Port:** our hub is structurally the same. Different scenes (medbay, armory, mission board, captain's quarters, crew lounge). NSiR's camp-as-scene approach inherited via this pattern.

### Travel + time

BT has a Star Map with travel times in days. You burn credits on the way. Time passes. Pilots heal. Rumors develop. Gives time a weight that "instant travel" games don't have.

**Port consideration:** tbd. Worth considering for pacing — it slows the contract churn and gives "heal timer" + "rep decay" mechanics meaning.

## What we DON'T port

- **Turn-based tactical combat with full player control.** We are autobattler. BT's battles take 20–40 minutes each. Ours are 60–90 seconds, autonomous.
- **Massive mech-scale combat.** Our unit scale is infantry with support gear (Q3-A pending).
- **Hex-grid with cover flanking math.** Our combat is a painted top-down terrain with abstract positioning — Firefight-visual, not BT-tactical.
- **BT's narrative (Kamea Arano, Restoration of House Arano).** Our setting is our own (Q4 pending).

## Key tension to solve: attachment vs run-based roguelite

BT is a long campaign (40–80 hours). You carry named pilots for that whole time. The emotional weight of losing someone at hour 50 is enormous.

We are run-based. Runs are 45–75 min. How do you get BT-level attachment in 45 min?

Options:
1. **Accept shallower attachment** — Bazaar-style; you're fond of the build, not the people
2. **Metaprogression via Hall of the Fallen** — named operators who died in previous runs persist as legendary ghosts, their stories remembered
3. **Roster carries over across runs** — a dangerous choice (breaks roguelite variety) but gives BT-style persistence
4. **Named operators pooled globally** — same 80 operators cycle through different runs; their fates accumulate

Recommendation: **2 + variation of 4.** Operators are drawn from a global pool. Their histories persist — "Glitch (4 runs, 17 contracts, KIA vs Nightshade Syndicate)" — shown on their dossier card. Each new run they're rolled fresh stats, but the legend carries.
