# ADR 008 — Campaign structure: endless until death, no victory condition

**Status:** Accepted
**Date:** 2026-04-20

## Context

Clarify round 3 (Q12) asked what ends a campaign *victoriously*. User chose **E — no victory condition, endless; death is the only end; meta-unlocks come from achievement/duration.** Explicit reference: Dwarfs: Glory, Death and Loot.

This is a significant commitment. It means:
- No endgame boss contract to push toward
- No retirement-at-$X financial win condition
- No rank/reputation capstone
- The only states a campaign can end in are: TPK (total roster wipe), economic collapse (can't field a minimum force), or player voluntarily quits the campaign

## Decision

**Campaigns are endless. Progression is the arc; death is the ending.**

Consequences of this commitment, which define the shape of the game:

### Progression curve instead of narrative arc
- No scripted climactic finale. The "story" of a campaign is emergent — which factions you rose with, which pilots became legends, which deployments went sideways.
- Early campaign = milk runs, scraping credits, 3-unit rosters
- Mid campaign = standard contracts, roster growth, reputation consolidation
- Late campaign = deep deployments, battalion-scale, legendary pilots, multi-faction politics
- No hard ceiling — pushing into contract tiers 8, 9, 10+ gets fractally harder while returns diminish

### Death must be *survivable* mechanically for the campaign to continue
- A TPK ends the campaign
- A partial wipe does not — the campaign continues with whoever survived
- "Economic failure" is a real campaign-ending condition: if you can't field a minimum force (e.g., 3 units) and can't afford to hire more, the campaign is over
- This creates a secondary failure mode: not just death, but bankruptcy-by-attrition

### Meta-unlocks are the replay hook
- Each campaign earns "glory" (meta-currency) based on duration + achievements (see ADR 005)
- Glory spent on next-campaign starting bonuses / unlocks
- Incentive to push deeper (more glory earned) balanced against risk (TPK resets)
- The "right time to die" becomes a player decision — take another contract or call the campaign and cash out the glory?

### Voluntary retirement mechanic
- Player can voluntarily end a campaign at any staging point (between contracts)
- "Retirement" converts remaining assets to glory at some rate (maybe 1:10 credit-to-glory or similar)
- This gives a graceful off-ramp — you don't have to get wiped to end a good run
- Matches how long-running ironman players in Battle Brothers decide to "call it" when they've had enough

## Consequences

**Positive:**
- No need to author a scripted endgame — saves massive narrative-writing budget
- Pure progression game; each campaign feels fresh because the state builds organically
- Emergent storytelling is the meat — players will share "the run where..." stories naturally
- Matches the roguelike audience's expectations (Dwarfs, Battle Brothers ironman, Caves of Qud)

**Negative:**
- No cinematic "you won" moment — some players will bounce off
- Harder to market — "you cannot beat this game" is a counter-intuitive pitch
- Campaign-duration tuning is delicate: how long before diminishing returns set in? Too short = shallow; too long = fatigue
- Risk that late-campaign play becomes grindy without a goalpost

**Mitigations:**
- Narrative achievements (ADR 005) serve as mini-goalposts throughout the campaign
- Tier progression through contract difficulty acts as an implicit "how deep did you get" scoreboard
- Leaderboard-style best-runs screen (local, not online) gives players a personal record to beat

## Explicit non-goals

- **No endgame boss.** If we add one later it's a mistake per this ADR.
- **No "true ending" / hidden victory path.** The ending is death or retirement. Full stop.
- **No campaign-length timer / auto-end.** The player chooses when to stop.

## Related

- ADR 005 — meta-persistence (endless campaigns make meta-unlocks the replay hook)
- ADR 003 — scale (endless campaigns require the scale ceiling to be high enough for late-game to feel different)
