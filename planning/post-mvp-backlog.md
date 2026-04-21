# Post-MVP Backlog

Ideas and gaps surfaced during the MVP build that didn't make the slice. Organized by priority and size.

## Tier 1 — Ship-blocker for 1.0

- **Real pathfinder.** Tile-grid A* with cached precompute. Swap out hand-authored waypoints once we have >1 map.
- **Powered armor unit type.** First test of the chassis-overlay model on top of the infantry paradigm (`CombatProfile` extension point).
- **Death + meta-progression loop.** Dwarfs-model glory on death, next-campaign advantage.
- **Save system.** Single autosave is enough for 1.0; multi-slot later.
- **Replay playback UI.** Foundation is built; wire the scrub bar + tick step controls into Debrief.
- **Audio.** SFX for gunfire, impact, death; minimal ambient in combat view. No music required for 1.0.
- **Manual 10-min demo test.** Run it, capture verbal feedback, fix inline-annotation density.

## Tier 2 — Pillar expansion

- **Multi-engagement contracts.** BT-style deployment layer; contract decomposes into multiple engagements across multiple maps.
- **Legwork phase.** Shadowrun-style pre-contract prep. Deferred per spec/08.
- **Faction reputation.** Multi-axis rep, faction politics. Shape of "what content is available" over a campaign.
- **Narrative events.** NSiR-style skill checks between contracts.
- **Mechs / vehicles / drones.** Remaining unit types on chassis model.

## Tier 3 — Polish and legibility

- **Kill feed / event ticker in Deploy.** Rolling log of `unit-fired` / `unit-hit` / `unit-died` events with timestamps. Right now the HUD shows state but the history is hidden until you pause.
- **Wound detail panel.** Click a unit → zone-by-zone wound list with type + severity + bleed rate + treatment state. Source for "what just killed my operator".
- **Operator dossier screen.** Separate from Armory. History: contracts completed, injuries, callsign origin. Builds attachment.
- **Roster screen.** Hire/fire from available pool; recruit pool rotation over time.
- **Shop screen.** Browse + buy gear to stockpile. Economy pressure reintroduced.
- **Briefing map preview.** Minimap + visible spawn points + objective markers. Currently briefing is text-only.
- **Loadout validation warnings in UI.** Surface tonnage overruns and missing-stockpile states.

## Tier 4 — Nice-to-have UX

- **Diff view when swapping templates.** Show what changes per-zone DR / tonnage / mobility before you confirm.
- **Keyboard shortcuts everywhere.** Space = play/pause, arrows = speed, tab = cycle unit focus, R = replay.
- **Color-blind-safe team palette.** Audit blue/red team colors; add pattern fills as a second channel.
- **Settings screen.** Volume, speed default, theme (if we ever add a light theme — currently out of scope).
- **Localization infrastructure.** English-only for MVP; i18n plumbing deferred.

## Tier 5 — Sim improvements

- **Unit-unit collision.** Units currently overlap. Add separation force and blocking.
- **Waypoint regeneration per contract.** Currently enemies use player routes reversed. Author per-side route sets.
- **Alerted-state propagation.** One unit spotting an enemy should alert teammates in a radius (squad comms). Currently per-unit only.
- **Suppression effect.** High-volume fire on a target reduces its accuracy / triggers panic state.
- **Cover-seeking behavior.** Units currently advance on waypoints without considering cover along the route. Add "reach cover" micro-state.
- **Ammo conservation.** LMG spam at long range is wasteful; utility should score ammo-remaining as a factor.
- **Stance system.** Prone/crouched/standing with eye-height + movement impact. Schema already supports it via `eyeHeightFor`.

## Tier 6 — Engineering

- **Pixi rendering: delta-based updates.** Currently we `removeChildren()` and redraw every snapshot. Use object pooling + diff.
- **Worker→renderer diffs instead of full snapshots.** At scale, sending every unit every tick is wasteful.
- **Component tests (React Testing Library).** No React component tests yet; sim is well-covered, UI not.
- **E2E tests (Playwright).** Launch Electron, run through the full menu→deploy→debrief flow, assert visual checkpoints.
- **Bundle size audit.** Main chunk 1.48MB. Check if Pixi can be lazy-loaded (it's only used in Deploy).
- **Rust/WASM sim port.** Escape hatch in ADR 010. Not needed yet but the sim is structured to port cleanly.

## Bugs / rough edges to fix

- **Equip service is lenient.** If stockpile is short, loadout gets set anyway via fallback. Either enforce or surface the state.
- **Medic BT uses substring match.** `id.includes('medkit')`. Move to `kind`-based check via content lookup.
- **Bleed event never emits 'unit-downed'.** Current code sets `action = 'downed'` inline but the event emission path has a subtle conditional bug — the `if (isDowned(...))` check happens against a partially-updated unit. Needs a second look.
- **Content glob is duplicated between renderer and worker.** Both have their own `loadContent` / `loadWorkerContent`. DRY this into a shared module once I figure out Vite's worker import constraints.
- **No back button from Deploy.** You're trapped in combat until match ends. Add "abort contract" option.

## Spec / ADR items to write post-MVP

- **ADR 011 — Save format schema versioning.** Save file format + migration policy.
- **ADR 012 — Campaign turn resolution.** When do contracts expire, roster rotations happen, etc.
- **spec/09 — UI component library.** The design tokens + component set. Currently ad-hoc.
- **spec/10 — Audio strategy.** What sound sources, when to trigger, SFX vs music budget.

## Research loose ends

- **CL pathfinding RE didn't yield the precise waypoint graph structure.** Reverse-engineer further; see refs/clutch-legend.md for starting point.
- **Firefight damage falloff curve.** We estimated `exp(-d/500)` for penetration falloff. Check against the Firefight RE notes for a closer fit.
- **Never Second in Rome information density.** Inventory the density techniques (stat clusters, inline sparklines, etc) and write a checklist.
