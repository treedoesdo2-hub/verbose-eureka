# ADR 014 — Marching-order spawn model (deploy zones deprecated)

**Status:** accepted
**Date:** 2026-04-23
**Task:** mapgen post-rework — user flagged two large deploy zones eating 2/3 of the map

## Context

The COA-5 spawn placer produced a `DeployZone` per team — two rectangles
sized ~1/3 of the map each, positioned at north/south edges in the
meeting regime (or asymmetrically in assault/defence). The `runPipeline`
code then explicitly suppressed terrain generation inside these rects
(`maskZoneInDensity(coverDensity, W, team0, 2)` in pipeline.ts, plus
building-scatter skipping any tile whose `buildingId` would land in a
zone) so units could spawn on clear ground.

**Result:** two of the map's three horizontal thirds render as empty
fields, regardless of biome. The middle third does the visual work.
Player sees a procedurally-generated field sandwiched between two empty
fields. Reads as "the mapgen is broken."

Separately: the game's interaction model is pure autobattler. The player
**does not manually place units on the deploy screen.** Clicking on a
squad + clicking on the zone does nothing. The large deploy zones have
no gameplay purpose — they're just reserved empty terrain.

User directive (2026-04-23): "one team will be entering from a map edge
(so, in the order the squads are entered on the deploy screen, they
will enter from a given road in 'marching order') and one will be
deployed around a defensive objective. Nearly all scenarios will use
this format."

## Decision

**Deprecate `DeployZone` as a terrain-generation gate.** Deploy zones
remain as a data shape for backward compatibility (authored maps still
use them; the deploy-screen UI still needs something to render "your
spawn location") but the pipeline no longer masks terrain around them.

**Team 0 (player) spawn model — Road Marching Order:**
1. Pipeline picks one map edge that a dominant road connects to. This
   becomes the entry point.
2. Squads spawn in deploy-screen order, stacked along the road starting
   from the edge tile.
3. Within a squad, members form a column / staggered march pattern.
4. Units start facing map-inward along the road.
5. Marching-order stagger: squad 0 closest to map edge, squad N furthest
   inland. Gives the player a visual "your column marches on." No
   manual placement.

**Team 1 (enemy) spawn model — Objective Defense Ring:**
1. Pipeline picks the highest-scoring objective anchor (prefer `defend`
   kind, fallback to `secure`, fallback to hero landmark center).
2. Enemy squads spawn in a loose ring around that anchor (radius scales
   with unit count; minimum 3 tiles, maximum 8).
3. Units face outward from the objective center.
4. If the anchor is inside a building, spawn in tiles adjacent to the
   building's footprint, still facing outward.

**Terrain-generation changes:**
- Remove `maskZoneInDensity(coverDensity, W, team0, 2)` + matching
  team1 call. Density field now spans the whole map.
- Hotspot filtering still excludes deploy zones post-extraction (we
  don't want a building to spawn on top of a unit). But the `coverDensity`
  field itself is no longer zeroed.
- Building scatter similarly doesn't avoid deploy zones — instead, the
  spawn placer is responsible for picking spawn tiles that aren't
  inside a building footprint.

**Scenarios:**
- `meeting`: legacy only. Pre-authored fixtures keep using it. Procgen
  contracts default to the new split.
- `assault`: player marches in from a road edge; enemy defends an
  objective. Direct mapping to new model.
- `defence`: inverted — player is the defender. Player squad spawns
  near the defensive objective; enemy marches in from a road edge.
- `storming` + `custom`: not scoped; maintain current behavior until
  contract authoring needs them.

## Consequences

**Positive:**
- Map is fully terrain-generated edge-to-edge. No empty-field thirds.
- Squad ordering on the deploy screen becomes meaningful — it determines
  marching order. The deploy screen UI can show "Squad 1 leads, Squad
  2 follows..." instead of a ghost zone.
- Enemy placement is diegetic: they're defending an objective, not
  standing in a rectangle.

**Negative:**
- `DeployZone.squadRects` from the placer is now vestigial for procgen
  maps. Code that reads `squadRects` for per-squad spawn math needs to
  read from the new `MarchEntry` / `ObjectiveRing` structures instead.
- Any contract assuming "player has a big rectangular spawn area" needs
  updating. Authored-map fixtures for tests need a migration pass.
- Ties to the LOS + pathfinding work (ADR P3.11 / P3.12): spawning on
  roads means units start on terrain the ridge rule + cliff guard
  haven't audited. Need a smoke test that spawn tiles are always
  foot-passable.

**Defer:**
- Per-squad "marching in" animation (units walk on from off-map). Not
  required for MVP — spawning directly on the entry-road tiles is fine.
- Multi-axis defend (enemy holding two objectives). Single-anchor is
  sufficient for "nearly all scenarios" per user directive.
- Extraction-style player-exit zones (for `extract` objectives). Can
  reuse the entry-road edge or pick a different edge at authoring time.

## Migration plan

1. Author new types: `MarchEntry { edge, roadTile, direction, squadSlots[] }`
   and `ObjectiveRing { anchorTile, radius, slots[] }` in
   `src/sim/mapgen/spawn-placer.ts`.
2. Add them to `MapGenResult` alongside existing `deployZones` (keep
   both during transition).
3. Update `sampleSpawns` in `scenario.ts` to prefer `MarchEntry` for
   team 0 and `ObjectiveRing` for team 1 when present.
4. Remove the `maskZoneInDensity(coverDensity, ...)` calls in
   `pipeline.ts`.
5. Remove deploy-zone exclusion from building-scatter pre-filters.
6. Update tests that assert `DeployZone` geometry — shift to asserting
   spawn-point geometry instead.

## References

- `src/sim/mapgen/spawn-placer.ts` — current COA-5 zone placement
- `src/sim/mapgen/pipeline.ts:~583` — density-masking calls
- `src/sim/scenario.ts:sampleSpawns` — current spawn grid
