# 01 — Core Loop

## The three nested loops

### Inner loop: the contract (~2–4 min)

```
 ┌──────────────────────────────────────────────────────────────┐
 │                   CONTRACT BRIEFING                          │
 │                                                              │
 │   Shown: payout, risk tier, faction rep consequences,        │
 │          enemy intel, terrain preview, modifiers             │
 └────────────┬─────────────────────────────────────────────────┘
              │
              ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                   PREP PHASE                                 │
 │                                                              │
 │   • Recruit / swap operators from current roster             │
 │   • Equip gear + cyberware + consumables                     │
 │   • Place operators on deployment zone                       │
 │   • Set behavior tags (aggressive / defensive / flanker /    │
 │     medic-priority / sniper-overwatch / etc.)                │
 │                                                              │
 │   No time pressure. All agency lives here.                   │
 └────────────┬─────────────────────────────────────────────────┘
              │   [GO]
              ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                   COMBAT (autonomous)                        │
 │                                                              │
 │   ~60–90 seconds of Firefight-tier top-down tactical         │
 │   engagement. Units act per their stats + behavior tags.     │
 │   Zero player input. Spectate only.                          │
 │                                                              │
 │   Speed controls: 1× / 2× / 3× / skip-to-result               │
 └────────────┬─────────────────────────────────────────────────┘
              │
              ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                   RESOLUTION                                 │
 │                                                              │
 │   • Win/loss + payout                                        │
 │   • Per-operator: kills, damage, wounds, new scars           │
 │   • Loot drops (gear, consumables)                           │
 │   • Faction rep shifts                                       │
 │   • Narrative event chance (NSiR-style skill check)          │
 └──────────────────────────────────────────────────────────────┘
```

### Middle loop: the run (~45–75 min)

One run = one mercenary campaign, ~25–30 contracts.

```
 Run start
   │
   ▼
 Starting crew (3–4 low-tier operators, bare gear, seed credits)
   │
   ▼
 Contract 1 → 2 → 3 → ... → N-1 → Final contract (boss)
   │          │        │                          │
   │          │        │                          └── Run-ending
   │          │        │                              showpiece fight
   │          │        │
   │          │        └── Between most contracts: hub scene,
   │          │            optional shop visits, narrative events,
   │          │            downtime actions (R&R, training, medical)
   │          │
   │          └── Occasional "rest" beats every ~5 contracts
   │              (bigger shop refresh, faction-rep milestones,
   │               crew-drama events)
   ▼
 Run ends: win (defeat boss) or lose (roster wipes / bankrupt)
   │
   ▼
 Metaprogression payout → feed into next run
```

### Outer loop: metaprogression (multi-run, persists forever)

- Unlocks: new operator classes, gear tiers, faction contacts, contract types, map biomes
- Persistent records: best run, longest campaign, legendary mercs (Hall of the Fallen)
- Difficulty tiers: each completed run unlocks a harder tier (Slay the Spire Ascension model)
- No gear/operator carry-over between runs — only unlocks

## Time budget per run

Rough target: **45–75 minutes per run**, skewing toward the short end once players are fluent.

| Phase | Time per contract | Total across 25 contracts |
|------:|:------------------|:--------------------------|
| Briefing     | 15–30 s   | ~8 min  |
| Prep         | 45–90 s   | ~25 min |
| Combat       | 45–90 s   | ~25 min |
| Resolution   | 15–30 s   | ~8 min  |
| Hub/events   | avg 20 s  | ~8 min  |
| **Total**    |           | **~60 min**|

This is the design budget. If prep creeps past 2 min per contract on average, the run becomes a chore. Tight prep UX is a hard requirement.

## Pacing texture

Not all contracts are equal. Variety comes from:

- **Easy contracts** — quick money, minor rep, bulk of the run
- **Elite contracts** — harder, juicier loot, optional (Slay-the-Spire elite floor pattern)
- **Faction contracts** — rep-heavy, chain together if you honor the faction
- **Rest beats** — every ~5 contracts, a hub scene with bigger decisions, roster management, narrative events, faction politics
- **Boss contract** — run-ending set-piece; unique arena, unique enemies, unique rewards

## What the player is actually optimizing during a run

1. **Credits** — hire/upgrade/gear budget
2. **Roster health** — keeping operators alive and unwounded
3. **Synergy density** — building a squad where traits/gear combo into something greater than sum of parts
4. **Faction rep** — choosing whose contracts to take, whose to burn
5. **Scar/injury load** — long-term consequences accumulating across the run
6. **Intel** — scouting future contracts to prep specific loadouts

Autobattler tension = "my build vs the next unknown fight." Meta-roguelite tension = "this run's losses are permanent to the run."
