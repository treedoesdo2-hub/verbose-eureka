# ADR 005 — Meta-persistence: capital + narrative unlocks, hard permadeath

**Status:** Accepted
**Date:** 2026-04-20

## Context

Clarify round 1 (Q5 + Q9) established:
- **Within a campaign:** hard ironman permadeath. One campaign, one roster, one life. Dead pilots do not return.
- **Between campaigns:** roguelike meta-progression in the Dwarfs: Glory, Death and Loot lineage. Death unlocks things for the next campaign.
- **What carries:** starting capital/reputation bonuses (B) and narrative achievement unlocks (D). **NOT** named-pilot legend returns (C explicitly rejected).

The rejection of C is meaningful: the user wants death to be emotionally final. No "she returns in your next campaign as a ghost recruit." When a pilot dies in Campaign 3, she's gone forever. Her legend can influence future campaigns only through narrative achievement tracks and statistics, not through mechanical resurrection.

## Decision

### Campaign-level (ironman)
- One campaign per save. Standard-ish save slots allowed for system-level quit/restart, but no save-scumming within a campaign (no reload-on-death). Technical enforcement TBD — probably autosave + single-slot, with a meta-save for campaign-end state.
- Hard permadeath for every unit. Destroyed mechs are scrap. Dead pilots are dead.
- Campaign ends when either the win condition is hit (TBD — see Q12 below) OR the roster cannot field a minimum contract force (economic failure, not just TPK).

### Meta-level (roguelike)
Two persistent tracks between campaigns:

**Starting-capital bonuses (B).** Each completed campaign (success or failure) awards meta-currency based on what was achieved: contracts completed, credits earned, enemy units destroyed, named-pilot kill counts, etc. Spent on:
- Starting credit bonus for next campaign
- Starting reputation with chosen faction
- Unlocking specific starting unit slots (e.g., "start with a mech" instead of "start with 3 infantry")
- Unlocking equipment/chassis pools (advanced gear only available in Campaign N+ after unlock)

**Narrative achievement tracks (D).** Named accomplishments that alter future campaigns' flavor/events:
- "Slayer of the Kraken Syndicate" — Syndicate contracts pay more in future campaigns
- "Fallen at Chernaya Gate" — special memorial event chain available in future campaigns if you return to that planet
- "The Accord-Breaker" — corpo contracts are rarer but higher-stakes in future campaigns
- Achievements serve as run-specific achievement-rack decoration AND as gameplay modifiers

### Explicitly not in scope
- **No legend-pilot returns.** A pilot who died in Campaign 3 is gone. Forever. Their dossier may appear in a Hall of the Fallen archive for flavor, but they cannot be recruited in Campaign 4.
- **No experience/skill transfer between campaigns.** Every campaign starts fresh in terms of individual pilot progression.
- **No persistent crew continuity.** "Your veteran lance from last run" doesn't exist.

## Consequences

**Positive:**
- Death stays emotionally terminal — the primary attachment-stakes mechanic works
- Each campaign feels structurally complete and self-contained
- Meta-unlocks give mechanical reason to replay after a TPK without softening the loss
- Narrative achievement tracks are cheap to author relative to their replay-value payoff

**Negative / deferred:**
- **Meta-currency tuning is delicate.** Too generous = new campaigns trivially easy; too stingy = no reason to replay after failure.
- **Narrative achievements must be authored individually.** Each one is writing work. Budget accordingly.
- **Campaign length / run time implications** — if a campaign takes 40+ hours, replay frequency drops and meta-unlocks feel slow. If it takes 6 hours, meta-unlocks feel rapid. This depends on Q12 (win condition) and campaign pacing design.
- **Hall of the Fallen** — rejected mechanically but maybe still exists as a pure flavor archive (viewable roster of all dead pilots across all campaigns). Cheap to implement. Emotional payoff. No gameplay effect.

## Related

- ADR 001 — autobattler purity (attachment is emotional, not mechanical — this ADR confirms death is the engine of attachment)
- ADR 003 — scale (meta-unlocks can include starting-force-size bonuses)
- Spec 02 Q5 + Q9 — answered
