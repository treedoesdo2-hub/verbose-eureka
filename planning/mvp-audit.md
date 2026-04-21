# MVP Audit — 5-Agent Swarm Findings

Dispatched five Haiku agents to audit the MVP against spec/05, spec/06, spec/07, spec/08, ADR 001, 002, 006, 009, 010. Each covered one axis. Merged findings below.

## Headline

- **Thesis test passes.** All 6 spec/08 non-negotiables honored. All content minimums met. No out-of-scope leakage.
- **Spec surface area coverage is ~50–60%.** The specs are richer than the MVP slice acknowledges. Most deferred items are correctly deferred per spec/08's "in scope" list, but a non-trivial portion are quiet gaps we should name.
- **Biggest real debt:** sim depth (spec/07), loadout packing constraints (spec/06), and UI accessibility (ADR 009 §6) — all under-implemented but not "wrong."

## Critical deviations (fix before demo)

1. **Default sim speed is 1×, ADR 006 says 4×.** `stores/settings.ts:18`. Single-line fix.
2. **No pause button in UI.** Worker accepts `pause`/`resume` messages; nothing in `deploy.tsx` sends them. Speed controls exist but can't be stopped mid-match.
3. **`tick.ts:325` has `void input;`** — SimInput is declared in the signature but never consumed. Pause/retreat/hold commands wouldn't route through the sim. Currently speed/pause live in the worker loop instead; that's fine for MVP but the `SimInput` type is a lie.
4. **Armory "equip" is lenient.** If stockpile is short, loadout still gets set via fallback. Stockpile budget is effectively advisory.
5. **Medic detection uses substring match.** `bt.ts` checks `id.includes('medkit')`. Fragile; any future item id containing "med" would trigger.

## Sim depth gaps (spec/07 surface)

Scope of spec/07 is broader than I implemented. These are honest half-implementations, not bugs:

- **Alerted state never decays.** `lastAlertedTick` is stored but no cleanup. Spec: 1–2 min decay, veteran units decay slower.
- **Stance is hardcoded to `'standing'`.** `vision.ts:20`. No crouched/prone, so stance-based eye-height and zone weighting don't apply.
- **Wound severity is a 4-enum** (graze/light/serious/critical). Spec asks for continuous 0–100 with aggregation (two zone-30 wounds = zone-60).
- **Treatment states incomplete.** Bandage and tourniquet are enum values but `processStabilize` flips untreated → stabilized directly. No bandage degradation, no tourniquet tissue damage timeout.
- **Blood thresholds collapsed.** Spec has 5 (100-70 / 70-40 / 40-20 / 20-10 / <10); code has one (≤30 = downed).
- **BT is lean.** Missing Panic, Suppressed, Reacting, Patrolling sub-states. No Battle Drill 1A sequence (return fire → take cover → locate → suppress → assault).
- **Last-seen memory absent.** Units don't remember where they saw an enemy; each tick re-acquires from scratch.
- **`'dragging'` action exists in `UnitAction` but is never produced.** Drag-to-cover recovery not wired.
- **`REPOSITION_COOLDOWN_TICKS` in `bt.ts:8` is dead code** (`void`'d on line 194).
- **Sound propagation** deferred (spec/07 §open questions).

## Loadout gaps (spec/06 surface)

- **No hand-occupancy rule.** Rifles should consume both hands, pistols one. No `Weapon.hands` field; nothing prevents "two primaries."
- **No back-mount exclusivity.** Spec: one large item (ruck / LAW / case). Utilities are flat list.
- **No zone-grid drag-drop.** Advanced mode is a stat printout + flat selectors; spec wanted spatial packing.
- **Hardpoint types collapsed.** Code has `primary/secondary/sidearm/utility/melee`; spec has `Energy/Ballistic/Missile/Support/Melee` for non-infantry (correctly deferred — but the schema name hints at drift).
- **No encumbrance system.** `mobilityPenalty` is a static per-armor number; spec wanted weight × volume → progressive penalty.
- **No item quality** (Stock / Refurbished / Mint / Custom-tuned).
- **Stockpile is count-only.** No per-instance tracking, no rarity/quality, no reservation.

## UI / ADR 009 gaps

- **Zero keyboard accelerators.** No `onKeyDown`, no hotkey overlays, no tooltips-on-hover listing the hotkey. ADR 009 §6 is unambiguous about this being a ship requirement.
- **No tooltips anywhere.** `AIM MOV GRT AWR MED` abbreviations in briefing have no hover legend. `DR` in armory has no definition.
- **No density-mode setting.** ADR 009 §8 calls for compact / normal / spacious.
- **No light theme.** ADR 009 §9 says both must be fully supported; only dark exists.
- **No component library.** Buttons/lists/panels are inline-styled divs. Fine for MVP but will calcify if we keep building on it.
- **Debrief is narrative-empty.** Win/loss banner + list of names. P2 (pilot legend) is invisible — no kill counts, no "X took 3 wounds and kept fighting," no highlight moments.
- **Advanced-mode feels like a stat dump, not revealed depth.** Armory's toggle adds selectors + zone DR table; it doesn't narrate the reveal.
- **Combat HUD shows state, not interpretation.** Blood bar + action name, but no "this unit has 40m LOS vs enemy's 15m — that's why it sees first."

## Non-agent-caught items I want to add

- **First-launch didn't actually happen in this session.** I never ran `pnpm dev` inside Electron. Build succeeds; the first visual run could surface Pixi init bugs, StrictMode double-mount issues, or CSP errors.
- **No integration test launches a real worker.** All sim tests run synchronously; the renderer-worker round-trip is only ping-tested.
- **Bundle size 1.48MB main chunk.** Pixi is the bulk; could be lazy-loaded only in Deploy.

## Sorted priority for fix-before-first-demo

1. Change default `simSpeed` to `4` (1 line)
2. Add pause button to deploy HUD + wire to bridge (~15 lines)
3. Add hotkeys: space=pause, 1–5=speed, tab=cycle unit, R=replay (toward ADR 009 §6)
4. Add abbreviation tooltips on `AIM/MOV/GRT/AWR/MED` and `DR`
5. Wire a kill-feed/event-ticker in deploy HUD (P5 density win)
6. Remove `void input` from `tick.ts` and actually route `pause`/`setSpeed`/commands through it, OR drop `SimInput` from the type and admit it's unused
7. Tighten `equipLoadout` to fail-hard on insufficient stockpile or plumb a "short" UI state
8. Kill substring match in `hasMedkit` — use utility `kind` lookup

## Honest coverage estimate

- **spec/08 (MVP scope):** ~90%. The non-negotiables are all in, the content is all there, the cuts are intentional.
- **spec/07 (combat sim):** ~50%. The bones are right, but suppression, panic, stance, last-seen, alert decay, drag-to-cover, 5 blood thresholds, wound aggregation, battle drill 1A — all absent.
- **spec/06 (loadout):** ~60%. Body-zone + tonnage + crit budgets work, but zone-grid packing, hand rule, back-mount, encumbrance, item quality all missing.
- **ADR 009 (UI):** ~55%. Flat aesthetic shipped; keyboard nav, tooltips, density modes, light theme, component library all deferred.
- **ADR 010 (stack):** ~95%. Everything listed is present, except `pnpm` in scripts — they now use `npm run` under `play.bat`.
- **ADR 001/002/006 (purity / progressive / pacing):** ~85%. Purity honored. Progressive disclosure wired. Pacing: speed works, default is wrong, pause UI missing.
