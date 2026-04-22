# ADR 012 — Mapgen grid encoding (COA-2)

**Status:** Accepted
**Date:** 2026-04-22

## Context

The Firefight-redesign of mapgen (per `planning/mapgen-firefight-redesign.md` work) requires a far richer per-tile terrain vocabulary than the current 6-kind `TerrainKind`. The new vocabulary is authoritative from Firefight's design language:

- **8 base surfaces** (open, road, water_shallow, water_deep, mud, rubble_ground, snow, sand)
- **11 linear barriers** stored on edges (hedge, bocage, stone_wall_low, wood_fence, bamboo_fence, rail_fence, berm, wire_light/dense/razor, rubble_strip)
- **21 point-obstacle families** (bushes, haystack, barrels, cars, dragons_teeth, tank_trap, etc.)
- **10 building families** (church, factory, house_grey_slate, house_red_tiles, mud_hut, oil_refinery, shed, tower, villa, windmill)
- **6 tree families** (forest, fruit, jungle, oak, poplar, snow) as specialised point objects
- **Destructible state** per barrier/point/building wall (intact → damaged → destroyed; non-persistent — reset per mission)
- **Per-tile structure height** (building floor count as meters)
- **Stepped elevation** (8 levels × 1.5 m/step = 0–10.5 m, supports Firefight's shoot-over-low-cover-from-high-ground tactical model; COA-8)
- **Smoke** as a dynamic LOS primitive (dynamicOccluders list on the ray query; COA-2)

This cannot fit into a single `Uint8Array terrain` grid. ADR 011 established **4096² as the map-scale target** (Pillar A, "at least 4× current area as floor, ~16× as ceiling"). All grid-encoding decisions must accommodate 4096² without hedging.

## Decision

### Ship dense grids at 4096²

Every terrain layer is a dense typed-array grid sized `width × height`. Memory is not a primary constraint for MVP; per the user directive, performance/memory work is deferred until the full feature vision is in place.

### Grid layout (per `World`)

| Grid | Element type | Role | Size at 4096² |
|---|---|---|---|
| `base` | `Uint8Array` | base surface kind (3 bits) + biome-skin variant (2 bits) + prone-walk flag (1 bit) + reserved (2 bits) | 16 MB |
| `point` | `Uint8Array` | point-object kind (0 = none, 1..n = family) bits 0–4; variant bits 5–6; damaged bit 7 | 16 MB |
| `edgeN` | `Uint8Array` | linear-barrier on tile's north edge — kind bits 0–3, damaged bit 4, material-skin bits 5–7 | 16 MB |
| `edgeW` | `Uint8Array` | linear-barrier on tile's west edge (south/east reached via neighbor redirect — halves storage) | 16 MB |
| `buildingId` | `Uint16Array` | 0 = no building, else index into `world.buildings[]` | 32 MB |
| `walkability` | `Uint16Array` | **10 bits** per tile (see below) | 32 MB |
| `coverProfile` | `Uint8Array` | pre-baked 3-axis cover summary (LOS-block 2b + cover-level 2b + height-profile 3b + dirty 1b) | 16 MB |
| `elevationStep` | `Uint8Array` | 8 levels × 1.5 m stepped elevation (COA-8); integer-exact under determinism | 16 MB |
| `structureHeight` | `Uint8Array` | per-tile building-wall/feature height in meters (0..255) | 16 MB |
| `barrierHp` | `Uint16Array` | destructible HP per tile, non-persistent (reset per mission) | 32 MB |
| `elevation` (float, retained on `MapGenResult` for debug / contour overlay) | `Float32Array` | continuous 0..1 noise field | 64 MB |

**Dense total per `World` at 4096²: ~208 MB.** `elevation` (the continuous debug field) lives on `MapGenResult`, not `World` — so in-sim memory is ~144 MB.

### Walkability bit layout (Uint16, 10 bits used)

Expansion from the current 3-bit `WALK_FOOT` / `WALK_WHEELED` / `WALK_PRONE_ONLY` layout.

```
bit  0: WALK_FOOT          — regular infantry, standing/crouched
bit  1: WALK_PRONE         — crawling (under tangled wire, low rubble)
bit  2: WALK_MECH          — mech chassis (walks on legs, stomps stuff)
bit  3: WALK_POWER_ARMOR   — power armor (infantry with PA strength boost)
bit  4: WALK_WHEELED       — jeep/APC-on-wheels
bit  5: WALK_TRACKED       — tank/tracked APC
bit  6: WALK_SLOW          — speed multiplier present; read moveSpeedMult from coverProfile
bit  7: WALK_CUT_REQUIRED  — wire: foot may pass after cutting (N ticks)
bit  8: WALK_CLIMB_ONLY    — peek-over/step-over a low wall (not a true A* path)
bit  9: WALK_DOOR          — door edge — passable only when open
```

Infantry / mech / power-armor all walk over **tank traps** and **dragons teeth** (per user: "mechs and power armor infantry should have no problem with them"); wheeled and tracked chassis are blocked. Tank-trap walkability = `FOOT | PRONE | MECH | POWER_ARMOR`.

### Edge ownership

Linear barriers live on **edges**, not tiles:

- `edgeN[y * W + x]` owns the **north edge** of tile (x, y) — shared with the **south edge** of tile (x, y-1).
- `edgeW[y * W + x]` owns the **west edge** of tile (x, y) — shared with the **east edge** of tile (x-1, y).

Readers always go through `getEdge(world, x, y, side)` which redirects S→`edgeN[(x, y+1)]` and E→`edgeW[(x+1, y)]`. Never raw-access the arrays; the helper prevents N/S + W/E confusion.

### Building registry

`World.buildings: readonly BuildingRecord[]`. `buildingId = 0` means "no building here". Each tile inside a footprint has `kind = building_interior`; edge tiles of the footprint are `kind = building_wall_<family>`. Doors and windows are **edge-level overrides**: `door_closed`, `door_open`, `window_intact`, `window_broken`.

### Destructible state + HP

Barriers, point objects, and building walls are destructible. Per tile, the HP grid (`barrierHp: Uint16Array`) tracks current HP; the state machine is:

- `intact` — HP == maxHp; full cover + LOS values
- `damaged` — 0 < HP < maxHp; interpolated cover (floor 40% base) + stepped LOS height
- `destroyed` — HP == 0; transitions to `rubble_strip` kind (if barrier sets `rubbleOnDestroy`) or is cleared (wire, fence)

**No cross-mission persistence.** HP resets at mission start. This is a deliberate decision: all maps are procedurally generated, so playing the "same map twice" is not a real outcome. The simulation's HP state is per-mission.

### Per-wall cover

Each building wall tile tracks HP individually. When a ray enters a building, the wall tile it crosses determines cover — not the building as a whole. Interior coverage from external shots is full (≈ 95 cover) as long as the wall between shooter and target is intact; as walls are damaged, their contribution falls proportionally.

### Smoke as dynamic LOS

Smoke is an in-sim primitive, not a terrain kind. `castRayAxes(world, from, fromStance, to, toStance, { dynamicOccluders })` consults a list of smoke volumes:

```ts
type SmokeVolume = {
  readonly center: Vec2;
  readonly radius: number;
  readonly opacityTop: number;   // meters above ground
  readonly opacityPerMeter: number; // thin-LOS accumulation
  readonly tMsExpires: number;
};
```

Volumes decay over time (diffusion tick); they contribute to the thin-LOS accumulator the same way thin-cover terrain does.

### Determinism

All grids are deterministic under seed replay. The determinism hash covers every grid buffer, not just `terrain`. `coverProfile` is a pre-baked cache (dirty bit 7 → slow-path re-read from base + point + edges + building); its hash input is `(dirty bits cleared) ∨ (source grids hashed)`.

## Consequences

- Roughly 144 MB resident per in-sim `World` at 4096². Multiple concurrent worlds are not a current use case; this is acceptable.
- `makeWorldFromBuffers` signature expands to accept all grids. Authored-map path materializes them on load.
- Existing consumers (`los.ts`, `cover.ts`, `pathfinding.ts`, `hearing.ts`, `hit.ts`, `vision.ts`) all migrate to the new schema. Tests rebaseline in lockstep.
- No v1 compatibility shim — authored map fixtures mass-edit to v2 in one pass.
- The `Uint16` walkability bump is a breaking change to the current `WALK_FOOT | WALK_WHEELED | WALK_PRONE_ONLY` Uint8 encoding; every callsite that reads walkability gets updated.

## Related work

- ADR 011 — Firefight-tier gap closers (this ADR is the Pillar A implementation substrate).
- COA-8 scope (elevation LOS) depends on this ADR for `elevationStep` + `structureHeight` grids.
- COAs 1, 3, 4, 5, 7 all read grids defined here.
