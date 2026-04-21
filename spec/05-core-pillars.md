# 05 — Core Gameplay Pillars

## Purpose

Pillars are **tiebreakers**. When a design question has no obvious answer, check it against the pillars. If a proposed feature advances a pillar, it earns consideration. If it conflicts with a pillar, it's cut. If two pillars conflict, we fall back to the hierarchy in §Tiebreaker rules.

This is the single most-referenced doc in the project. Every future ADR and spec is checked against this file.

---

## The pillars

### P1 — Loadout is the primary agency

Every fight is a test of loadout decisions. RNG can and does swing individual fights — that's the genre — but across a campaign, loadout decisions dominate outcomes. The player's depth of control lives **between** fights, not during them. If a player consistently loses, the diagnosis is in the armory, not the die roll.

**Cuts:**
- In-fight decision gates ("press / fall back" during combat) — already killed by ADR 001
- Twitch-input mechanics of any kind
- "Lucky clutch save" systems that reward input unrelated to prep
- RNG mitigation that the player couldn't have planned for via loadout

**Keeps:**
- Deep customization trees per unit type (per ADR 002)
- Gear, cyberware, chassis modifications, component-level tuning
- Behavior tags and stance settings applied pre-combat
- Meaningful per-engagement pre-deploy staging (ADR 007)

---

### P2 — Pilots earn legend through performance, not through scripts

No operator is anointed. A sniper becomes legendary because she has 40 confirmed kills across 6 contracts, not because a narrative event assigned her a backstory. Attachment is earned, tracked, and displayed.

**Cuts:**
- Pre-written pilot backstories that give a unit structural importance
- Scripted hero moments guaranteed by the plot
- "This pilot cannot die" plot armor
- Mandatory named-character tutorials or cutscenes
- Legend-pilot meta-returns across campaigns (already cut by ADR 005)

**Keeps:**
- Full kill/contract/deployment tracking per named operator
- Visible performance dossiers on every pilot
- Campaign-statistic screens showing who achieved what
- Emergent attachment through mechanical performance

---

### P3 — Casualty is a spectrum. Death, when it happens, is final.

Combat-ineffective ≠ dead. A downed pilot can be recovered by medics, dragged behind cover by teammates, extracted under fire, treated, and may return to duty. They can also bleed out in the open, be abandoned under fire, or die from critical wounds. Recovery behaviors are themselves a gameplay layer — investing in medics, specialist recovery gear, CASEVAC-capable vehicles, and AI that attempts to retrieve fallen comrades is a real choice with real mechanical weight. When death comes, it's final (per ADR 005).

**Cuts:**
- Mid-fight resurrects / revives
- Post-fight "lucky survivor" reveals that overturn confirmed deaths
- Save-scumming (ironman enforced, per ADR 008)

**Keeps:**
- Down / wounded / critical / dead state progression
- Medic and medevac unit roles with real loadout/stat surface
- Combat-recovery AI behaviors (units attempt retrieval of fallen, with cost)
- Abandonment as a player choice (expensive retrieval vs cutting losses)

---

### P4 — Dwarf Fortress simulation fidelity at CL-tier graphical fidelity

Units behave like real trained operators, modulated by training level and equipment. Veterans execute Battle Drill 1A cleanly — return fire, take cover, locate enemy, suppress with fires, assault or break contact. Green troops find the nearest cover and spray at anything that moves. **Vision is as important as firepower:** heavy armor is near-blind to infantry without external spotting; light scouts carry the observation packages that make them worth their price; EW and stealth gear have real perceptual effect. Equipment affects what a unit can *perceive*, not just what damage it deals. Graphics stay minimal; the simulation underneath stays deep.

**Cuts:**
- Simplified "both sides see everything" tactical AI
- Universal damage stats without per-unit resolution modifiers
- Visual-fidelity expansion that doesn't serve simulation (shaders, particle systems)
- AI shortcuts that produce the same outcome regardless of training level

**Keeps:**
- Per-unit training level, morale, suppression, and behavioral state
- Vision/perception as a tracked resource, not a free global
- Battle-drill-level behavior scripting per training tier
- Equipment-driven perception (sensor packages, night-vision, EW)
- Investment in combat-AI work over art pipeline work

---

### P5 — Management-sim first. Combat is the reward, not the point.

This is a management sim. Combat is the dessert. When a design choice improves management depth at the cost of combat flair, management wins. When it adds combat flair at the cost of management clarity, combat loses. Scope discipline flows from this pillar.

**Cuts:**
- Features that require the player to interact with combat live
- Combat-side complexity that doesn't surface in the armory
- Visual combat flair that bloats perf or crowds information
- Gameplay systems that only matter during a fight

**Keeps:**
- Every combat-side mechanic has a management-side surface
- UI effort concentrates on management screens (armory, roster, contracts)
- Combat view serves *analysis* as much as *spectacle*
- Between-contract layers (hiring, gear, intel) get first-class attention

---

### P6 — The game respects the player's time

No forced tutorials, no unskippable cutscenes, no 30-round autobattler replays, no modal chains, no "wait 3 seconds" padding. Playback scales (0.5x–8x per ADR 006), contracts are skippable, everything is keyboard-navigable.

**Cuts:**
- Intro cinematics (unless fully skippable)
- "Click to continue" UX
- Full-page tutorial modal takeovers (already cut by ADR 009)
- Animations that block input without purpose
- Padded pacing that exists for "weight" rather than function

**Keeps:**
- Keyboard hotkeys for every action, visible on hover
- Variable playback speed as first-class feature
- Auto-resolve always available (per ADR 006)
- Density modes (compact / normal / spacious) per ADR 009

---

## Hierarchy: soul vs game

Two pillars carry extra weight but in different ways.

**P4 is the soul.** It's what the game *is*. It shapes what we build, where effort goes, how the combat engine is architected. The commercial hook — "management sim with BattleTech-depth loadouts and Dwarf-Fortress-depth simulation in a format most players can actually parse" — lives here. If P4 is fake, the game is a cosmetic exercise.

**P5 is the game.** It's what the player *does*. Most hours in-game are spent in management screens, not watching combat. When pillars conflict, P5 wins, even though P4 is the identity. The player experiences the game through its management clarity. The simulation depth is the trust foundation underneath that clarity.

Both are load-bearing. Neither is negotiable.

## Tiebreaker rules

Applied in order when a design question triggers pillar conflict:

1. **P5 wins unconditionally.** If the management-sim surface suffers, the proposal is rejected regardless of other pillar support. If a realism/sim feature (P4) bloats the management UI, the feature must either be hidden via progressive disclosure (ADR 002) or cut.
2. **P4 guides what to build.** Absent P5 conflict, prefer the option that better realizes simulation fidelity. This governs where dev hours go.
3. **P6 is a discipline pillar.** It applies to every pillar equally — any feature that adds friction without purpose loses.
4. **P1 is the commercial pillar.** When writing marketing copy, Steam page, or pitching to reviewers, lead with loadout depth.
5. **P2 and P3 are content pillars.** They govern roster, casualty, and narrative-adjacent design but rarely conflict with others.

## Effort allocation implication

- **Most engineering hours → combat sim.** P4 is the hardest pillar and the most technically risky. It's where the moat lives.
- **Most UI polish → management surfaces.** P5 is what the player sees most. Armory, roster, contract board, legwork screens — these carry the product.
- **Most writing hours → pilot-performance UI + emergent-stats screens.** P2 is an emergent property of good tracking. It needs solid exposure in the UI.
- **Minimal hours → cinematics, intro sequences, static narrative content.** P6 (and implicitly P2) cut these.

## Explicitly not pillars

Called out so future drift back toward them gets caught:

- **"Transparency / no blackboxes."** Rejected in /clarify round 4. Blackboxes support discovery, wiki culture, and game-feel. Hidden modifiers are fine. Players can infer and reverse-engineer.
- **"Diegetic material-metaphor UI."** Rejected in ADR 009. Flat web UI is the brief.
- **"Distinctive tone / flavor / voice."** Personality work deferred. Gritty-procedural register is committed as tone, not as pillar.
- **"Genre innovation."** We're making a better CL, not reinventing the autobattler. Cut anything that drifts into "but what if we also..."

## Tone — committed, not elevated

**Gritty / procedural.** Professional-military-noir register. Not operatic, not comic, not pulpy, not melancholic-existential. Everyone is tired, rent is due, deaths are ugly.

**Personality work deferred.** No flavor text commitments, no character voices, no narrative voice. When we get to it, it will respect this tone stake.

## Worked examples

Hypothetical design questions, resolved against the pillars. These are reference patterns for future decisions.

### Example 1 — "Should we add twitch-dodging to combat?"

- P1 (loadout agency): **cuts** — combat agency belongs in the armory
- P5 (management first): **cuts** — management players don't want twitch
- P4 (sim fidelity): neutral — real soldiers don't twitch-dodge
- **Verdict: cut.** Consistent across pillars.

### Example 2 — "Should vehicles have realistic vision packages, adding 8 stats per vehicle to manage?"

- P4 (sim fidelity): **supports** — vision realism is explicitly called out
- P5 (management first): **against** — 8 new stats bloats armory clarity
- **Tiebreaker: P5 wins.** Resolution: vision system must exist in the sim because P4 demands it, but the default armory UI abstracts it to a single "sensor tier" summary. Expert players can expand to see all 8 via advanced-mode toggle (per ADR 002's progressive disclosure).

### Example 3 — "Should fallen pilots have an RNG-based death chance post-fight?"

- P3 (casualty spectrum): **supports** — mechanical depth to wound states
- P4 (sim fidelity): **supports** — realistic wound attrition
- P1 (loadout agency): **partially supports** — medic gear and CASEVAC loadouts affect odds
- **Verdict: include.** Mitigation via recovery mechanics (P3's "keeps" list) is already the design.

### Example 4 — "Should the campaign open with a cinematic introducing your crew?"

- P6 (respect time): **cuts** — unskippable intros violate directly
- P2 (no anointed heroes): **cuts** — intro cinematic scripts attachment before performance earns it
- **Verdict: cut.** A skippable text briefing is fine. A cinematic is not.

### Example 5 — "Should we render combat animations at 60fps with smooth interpolation?"

- P4 (sim fidelity): neutral — visual smoothness is orthogonal to sim fidelity
- P5 (management first): **weak against** — 60fps animation spend competes against management-UI polish budget
- P6 (respect time): neutral
- **Verdict: don't.** CL-tier visual fidelity is the standing commitment (ADR 004). Concentrate visual spend on legibility, not smoothness.

### Example 6 — "Should player be able to disable a blackbox randomness system for determinism-seeking replayers?"

- (rejected "transparency" non-pillar): would support
- P4 (sim fidelity): **cuts** — disabling sim components breaks the game
- P5 (management first): neutral
- **Verdict: cut.** Blackboxes are part of the design. A "debug mode" may eventually exist as dev tooling, not a shipped feature.

---

## Status

**Accepted.** This document is the anchor for every downstream design decision. Update it only via deliberate revision with a changelog note.

## Related

- All existing ADRs (001–009) — pillars are consistent with every current decision
- Future ADRs must cite which pillars they advance or reconcile against
- Future spec docs reference pillars explicitly where design tension exists
