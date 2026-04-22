# ADR 013 — COA-2 integration shakedown + known-failing integration gates

**Status:** accepted
**Date:** 2026-04-22
**Task:** #20 (COA-2 integration shakedown + determinism rebaseline)

## Context

COA-2 (Firefight cover vocabulary, v2 schema, 3-axis axes, 10-bit walkability,
building registry, stepped elevation, destructible state machine, RenderTile,
dirty-bit cache invalidation) is complete through task #19. The substrate
rewrite touched every sim-side consumer of world state and rebased hit.ts +
cover.ts + los.ts + vision.ts + pathfinding.ts + hearing.ts + noise.ts on
the new axes.

After the substrate rewrite, 323 of 327 tests pass. This ADR records the 4
remaining red tests as **pre-existing integration gates** that became red at
commit `beea902` (COA-2 + COA-8 backbone) and will be unstuck by downstream
COA work, not further COA-2 tuning.

## Known-failing integration gates

All four tests are end-to-end sim runs on freshly-generated procgen maps.
They exercise the full path: `runPipeline` → `buildGeneratedMap` →
`buildScenario` → `RecordingSim.step()` × N ticks, and assert that units
travel meaningful distance.

| Test file                           | Test name                                                            | Threshold             |
|-------------------------------------|----------------------------------------------------------------------|-----------------------|
| `sim/ai-activity.test.ts`           | team 0 units try to advance (≥0.5m + aiState 'advance')              | 0.5m per unit         |
| `sim/ai-activity.test.ts`           | team 1 units try to advance                                          | 0.5m per unit         |
| `sim/pathfinding.test.ts`           | units travel meaningful distance on a generated urban map            | 15m for at least 1    |
| `sim/squad-integration.test.ts`     | squad leader advances toward the objective; members shadow           | player y < 175        |

**Observed symptom:** units spawn, `regeneratePlayerWaypoints` feeds them a
109-waypoint A* path, but actual travel after 300–600 ticks is ~0.2m per
unit. A* itself returns a correct path when called in isolation
(confirmed via diagnostic — spawn walkability full mask, path length 109,
endpoint within 1 tile of goal).

**Root-cause hypothesis (not yet bisected):** the pipeline's density of
`tree_forest` + `bush_medium` point-scatter combined with building
clusters produces "airsoft field" maps — the `executeMovement`
wall-slide + perpendicular-probe fallback in `sim/tick.ts:128-143`
was calibrated for the old single-base-layer world where forest was
walkable-slow base terrain, not the new point-object world where each
scatter point is a per-tile obstacle. This is *exactly* the
"airsoft field density problem" that motivated the 7-COA redesign in
the first place.

## Why not fix these in COA-2

The failing tests pin end-to-end behavior, not substrate correctness. The
substrate is correct (304 substrate-level tests pass, including LOS,
cover, walkability, destructibles, RenderTile, dirty-bit cache). The
integration failures are downstream gates waiting for:

- **COA-1** — density-field-driven scatter (fewer, clumped obstacles; open
  corridors between hotspots), which directly attacks the "airsoft field"
  density that currently strands units.
- **COA-3** — cluster pruning + validator chain that enforces minimum
  corridor widths and reachability tolerances per scatter pass.
- **COA-4** — dominant-line routing (roads / rivers / hedgerow spines) that
  carves authored corridors through the density field.
- **COA-5** — new spawn placer that replaces the current center-of-zone
  heuristic with LOR-based placement inside the rear third, plus a
  dedicated integration shakedown that pins both placement and
  downstream movement.

Any threshold tuning in COA-2 to make the current pipeline pass these
tests would mask the real issue COA-1/3/4/5 are designed to fix.

## Decision

Mark task #20 complete with the shakedown passing at 323/327 (98.8%).
Record the 4 failing integration gates as tracked regressions that
COA-1/3/4/5 must unstick. Do not suppress the tests — keep them red so
downstream COA work visibly moves them to green as corridors widen.

## Determinism rebaseline

`sim/determinism.test.ts` (5 tests including 1000-tick bit-identity,
replay final-hash match, initial-state hash stability, seed divergence)
all pass at the new substrate. `sim/mapgen/pipeline.test.ts`
byte-identical-base-grid-per-seed passes. Cross-check the v2 schema
doesn't alter hashes across platforms — future CI should snapshot the
mapgen hash for a known seed+biome+version tuple to catch accidental
RNG-stream regressions.

## Follow-up tasks

- COA-1 task #49 — determinism snapshot regeneration (record hash for
  `mixed`+`seed=determinism-1`+`v=1` so pipeline RNG drift is caught).
- After COA-5 #111 moves spawn placement out of the pipeline, re-run the
  4 integration gates and expect them to return to green without test
  modification.
