# ADR 017 — Buildings as structures (#275)

**Date:** 2026-04-25
**Status:** Accepted (initial scope; see deferred notes for follow-on work)

## Context

User feedback 2026-04-23: the current procedural building model is one-bit
("buildingId != 0 means inside"). Buildings have no doorways, windows, or
interior layout. Two consequences:

1. **Infantry walk through walls.** ADR 012 already specifies edge barriers
   (hedge, bocage, stone walls, fences, wire) and an edge-override slot for
   doors and windows. The schema for procedural buildings populates none of
   them — every building is a flat rectangle of `buildingId` with no perimeter
   barriers, so tick + pathfinding just step in/out freely. (Edge-barrier
   movement gates exist as of #276; they need barrier data to gate against.)

2. **No tactical interior.** Player squads in Firefight read the building as
   a tactical room (cover lines, doorway choke, window apertures for ranged
   shots). Our renderer has no interior view, so even if the building had
   interior layout there's no way to see it during play.

The user named windows specifically as load-bearing — windows are the reason
the climbing-mechanic exists in their design (climb-into-window = entry that
doesn't use the door). Removing them would break a core ROE expectation.

Schema-side, `BuildingRecord` already has `doorEdges` and `windowEdges`
arrays (see `app/src/schema/map.ts:148`). They're authored-only — the
procedural mapgen never populates them. ADR 012 reserved
`edgeOverrideN` / `edgeOverrideW` byte slots and the `EDGE_OVERRIDE_DOOR_*`
/ `EDGE_OVERRIDE_WINDOW_*` constants. The plumbing exists; the data
doesn't.

## Decision

Ship buildings-as-structures in three increments. This ADR commits to
increment 1 now and leaves 2 + 3 as named follow-ons (NOT deferred — to
be picked up in order once 1 lands).

### Increment 1 — Perimeter walls + doorway + windows (this commit)

For every procedurally-placed building (both `scatterAroundHotspots` and
`scatterBuildingClusters`):

- **Perimeter walls.** Stamp `stone_wall_low` (intact) on every external
  edge of the building footprint. Internal edges (between adjacent
  building tiles of the same building) stay clear. This is a hard
  edge barrier — combined with the #276 gate, infantry can no longer
  walk through external walls.
- **One doorway per building.** Pick a perimeter edge weighted toward
  the long-axis side of the rectangle. Stamp `EDGE_OVERRIDE_DOOR_CLOSED`
  there; foot units that adjacent-tile-step through that edge will treat
  it as a door, not a wall (per #276's edge-blocker logic).
- **Windows on remaining perimeter edges (sparse).** Pick 1-2 additional
  perimeter edges and stamp `EDGE_OVERRIDE_WINDOW_INTACT`. Foot units
  cannot walk through (intact), but the schema is in place so increment 2
  can add a climb-action that consumes a window and sets it to broken.

This is enough to (a) make buildings opaque to one-tick walk-through bugs,
(b) make a doorway a real choke point, (c) preserve windows as a
schema-stamped feature ready for the climbing mechanic.

### Increment 2 — Climbing mechanic + window break (follow-on)

- BT action: `climb-window`. Triggered when a foot unit's path goal is
  inside a building it isn't already in, and the nearest perimeter edge
  is a window. Climbing takes ~3 seconds; on completion, sets the window
  to `EDGE_OVERRIDE_WINDOW_BROKEN`.
- Movement gate already permits foot crossing of broken windows (#276).

### Increment 3 — Interior view (follow-on)

- Renderer: when any selected unit is inside a building, hide the roof
  layer for that building only. Show interior tile contents (floor base,
  furniture once added). Other buildings stay roof-on.
- Furniture is a future task — interior is initially empty floor.

### Out of scope (this ADR does not bind)

- Multi-room interiors with internal walls. Increment 1 ships buildings
  as one room. Internal partitioning is a separate redesign.
- Door state machine beyond closed/open. No locked doors; no breaching.
- Furniture and per-room layout authoring tools.
- Vehicle-specific door geometry.

## Consequences

**Positive.**
- Movement bug class disappears: walking-through-walls is gone for
  procedurally-generated maps. The data the #276 gate needs now exists.
- Doorways become tactical choke points. Squad AI naturally bunches at
  the doorway (BT pathfinding already routes the cheapest open edge).
- Windows preserved as a schema feature so increment 2 can land cleanly.

**Negative / risks.**
- Doorway selection on procedural buildings is heuristic (long-axis
  bias). Some buildings will get a door on the side facing an obstacle,
  forcing units to walk around. Acceptable for v1 — squad AI already
  handles "the obvious door is blocked, find another route" via A*.
- Stone-wall perimeter is one barrier kind; biome variation (mud_hut
  needs mud-walls, oil_refinery wants steel) is post-MVP.
- A* now has to walk around buildings that previously could be cut
  through, increasing path length and node-expansion budget. Risk
  acceptable — `MAX_NODES_EXPANDED = 4000` already accommodates 4096²
  detours.

## Implementation notes

- `pipeline.ts`: introduce `stampBuildingPerimeter(buildings, edgeN,
  edgeW, hpN, hpW, edgeOverrideN, edgeOverrideW, W, H, rng)` after both
  building-scatter passes complete.
- For each building, walk its `footprintTiles`. For each tile, an edge
  is "external" if the neighboring tile is NOT in the same building's
  footprint. Stamp stone_wall_low on those edges, EXCEPT pick one
  edge for the door + 1-2 for windows.
- Door selection: prefer edges on the longest perimeter side (reads
  cleanly in screen-space). Roll RNG once for vertical-vs-horizontal
  side, then once for which edge along that side.
- Window selection: 0-2 windows per building, on perimeter edges
  excluding the door edge.
- Pruner sweep already runs after barrier stamping; per-tile barrier
  counts in BARRIER_THRESHOLDS won't kill our perimeters because each
  building generates a contiguous wall run >= minSize.
