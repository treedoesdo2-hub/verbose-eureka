import type {
  BuildingFamily,
  LinearBarrierKind,
  PointObjectKind,
  TerrainBase,
} from '@schema/map';

// ADR 012 — mapgen grid encoding for 4096² maps.
//
// World state is split across multiple typed-array grids plus a buildings
// registry. Every grid is indexed y * width + x. Linear barriers are stored
// on the north + west edges of each tile; south + east lookups redirect to
// the neighbor's N / W via the `getEdge` helper — never access edge grids
// directly.

// ---------------------------------------------------------------------------
// Elevation encoding (COA-8) — stepped 8-level Uint8 at 1.5 m per step.
// Integer-exact under determinism; minimap contours fall out of step changes.

export const ELEVATION_STEPS = 8;
export const ELEVATION_STEP_METERS = 1.5;

export function elevationMeters(step: number): number {
  return step * ELEVATION_STEP_METERS;
}

export function quantizeElevationMeters(meters: number): number {
  const raw = Math.round(meters / ELEVATION_STEP_METERS);
  if (raw < 0) return 0;
  if (raw >= ELEVATION_STEPS) return ELEVATION_STEPS - 1;
  return raw;
}

export function quantizeElevationNorm(n: number): number {
  // n in [0,1] → integer 0..ELEVATION_STEPS-1.
  const raw = Math.floor(n * ELEVATION_STEPS);
  if (raw < 0) return 0;
  if (raw >= ELEVATION_STEPS) return ELEVATION_STEPS - 1;
  return raw;
}

// ---------------------------------------------------------------------------
// 3-axis cover model (Firefight-derived). Each terrain / barrier / object /
// building-wall contributor to a tile has three orthogonal properties.

export type LosBlock = 'none' | 'thin' | 'full';
export type CoverLevel = 'none' | 'light' | 'heavy' | 'full';
export type HeightProfile = 'flat' | 'low' | 'chest' | 'tall' | 'full';
export type MoveEffect =
  | 'walkable-free'
  | 'walkable-slow'
  | 'blocked-foot'
  | 'blocked-vehicle'
  | 'blocked-all';

export type CoverAxes = {
  readonly los: LosBlock;
  readonly cover: CoverLevel;
  readonly move: MoveEffect;
  readonly heightProfile: HeightProfile;
  readonly heightMeters: number;
  readonly moveSpeedMult: number;
};

// ---------------------------------------------------------------------------
// Walkability bit layout. Uint16 per tile — 10 bits used, 6 reserved.
// Tank traps + dragons-teeth per user: block wheeled + tracked, pass foot /
// prone / mech / power-armor.

export const WALK_FOOT = 1 << 0;
export const WALK_PRONE = 1 << 1;
export const WALK_MECH = 1 << 2;
export const WALK_POWER_ARMOR = 1 << 3;
export const WALK_WHEELED = 1 << 4;
export const WALK_TRACKED = 1 << 5;
export const WALK_SLOW = 1 << 6;
export const WALK_CUT_REQUIRED = 1 << 7;
export const WALK_CLIMB_ONLY = 1 << 8;
export const WALK_DOOR = 1 << 9;

// Convenience — "any infantry" (foot, prone-capable, mech, PA). Tank trap
// passability reference.
export const WALK_INFANTRY_MASK = WALK_FOOT | WALK_PRONE | WALK_MECH | WALK_POWER_ARMOR;
// Wheeled + tracked together — chassis-on-wheels that get caught on traps.
export const WALK_CHASSIS_VEHICLE_MASK = WALK_WHEELED | WALK_TRACKED;

export type MovementMode = 'foot' | 'prone' | 'mech' | 'power_armor' | 'wheeled' | 'tracked';

const MODE_BIT: Record<MovementMode, number> = {
  foot: WALK_FOOT,
  prone: WALK_PRONE,
  mech: WALK_MECH,
  power_armor: WALK_POWER_ARMOR,
  wheeled: WALK_WHEELED,
  tracked: WALK_TRACKED,
};

export function walkBitFor(mode: MovementMode): number {
  return MODE_BIT[mode];
}

// ---------------------------------------------------------------------------
// Terrain-byte codes. Exported because the mapgen pipeline writes directly
// into the typed-array grids.

export const BASE_KINDS: readonly TerrainBase[] = [
  'open',
  'road',
  'water_shallow',
  'water_deep',
  'mud',
  'rubble_ground',
  'snow',
  'sand',
] as const;

const BASE_TO_BYTE = new Map<TerrainBase, number>(BASE_KINDS.map((k, i) => [k, i]));
export function baseToByte(k: TerrainBase): number {
  const i = BASE_TO_BYTE.get(k);
  if (i === undefined) throw new Error(`unknown base terrain: ${k}`);
  return i;
}
export function byteToBase(b: number): TerrainBase {
  const k = BASE_KINDS[b];
  if (!k) throw new Error(`invalid base byte: ${b}`);
  return k;
}

// Point-object byte codes. Byte 0 = none; 1..N = POINT_KINDS[N-1].
export const POINT_KINDS: readonly PointObjectKind[] = [
  'barrel',
  'bush_small',
  'bush_medium',
  'bush_large',
  'car',
  'cart_empty',
  'cart_full',
  'dragons_teeth',
  'garden_shed',
  'grave',
  'gravestone',
  'haystack',
  'oil_drums',
  'rubble_pile',
  'signpost',
  'storage_tank',
  'tank_trap',
  'telegraph_pole',
  'trough',
  'tyres',
  'well',
  'tree_forest',
  'tree_fruit',
  'tree_jungle',
  'tree_oak',
  'tree_poplar',
  'tree_snow',
] as const;

const POINT_TO_BYTE = new Map<PointObjectKind, number>(POINT_KINDS.map((k, i) => [k, i + 1]));
export function pointToByte(k: PointObjectKind): number {
  const i = POINT_TO_BYTE.get(k);
  if (i === undefined) throw new Error(`unknown point: ${k}`);
  return i;
}
export function byteToPoint(b: number): PointObjectKind | null {
  if (b === 0) return null;
  const k = POINT_KINDS[b - 1];
  if (!k) throw new Error(`invalid point byte: ${b}`);
  return k;
}

// Linear-barrier byte codes. Byte 0 = none; 1..N = BARRIER_KINDS[N-1].
// The high 4 bits encode state (0 = intact, 1 = damaged) and 2-bit material
// skin. Kind occupies bits 0..3.
export const BARRIER_KINDS: readonly LinearBarrierKind[] = [
  'hedge',
  'bocage',
  'stone_wall_low',
  'wood_fence',
  'bamboo_fence',
  'rail_fence',
  'berm',
  'wire_light',
  'wire_dense',
  'wire_razor',
  'rubble_strip',
] as const;

const BARRIER_TO_BYTE = new Map<LinearBarrierKind, number>(BARRIER_KINDS.map((k, i) => [k, i + 1]));
export const BARRIER_STATE_BIT = 1 << 4; // damaged flag

export function barrierKindOf(edgeByte: number): LinearBarrierKind | null {
  const k = edgeByte & 0x0f;
  if (k === 0) return null;
  const out = BARRIER_KINDS[k - 1];
  if (!out) throw new Error(`invalid barrier byte: ${edgeByte}`);
  return out;
}
export function barrierIsDamaged(edgeByte: number): boolean {
  return (edgeByte & BARRIER_STATE_BIT) !== 0;
}
export function encodeBarrier(kind: LinearBarrierKind, damaged: boolean, variant = 0): number {
  const k = BARRIER_TO_BYTE.get(kind);
  if (k === undefined) throw new Error(`unknown barrier: ${kind}`);
  return (k & 0x0f) | (damaged ? BARRIER_STATE_BIT : 0) | ((variant & 0x03) << 6);
}

// Edge overrides (door / window). Byte 0 = none. 1..4 = closed/open door,
// intact/broken window.
export const EDGE_OVERRIDE_NONE = 0;
export const EDGE_OVERRIDE_DOOR_CLOSED = 1;
export const EDGE_OVERRIDE_DOOR_OPEN = 2;
export const EDGE_OVERRIDE_WINDOW_INTACT = 3;
export const EDGE_OVERRIDE_WINDOW_BROKEN = 4;

// ---------------------------------------------------------------------------
// Axis tables — the authoritative 3-axis data per kind.

export const BASE_AXES: Record<TerrainBase, CoverAxes> = {
  open: axes('none', 'none', 'walkable-free', 'flat', 0, 1.0),
  road: axes('none', 'none', 'walkable-free', 'flat', 0, 1.1),
  water_shallow: axes('none', 'none', 'walkable-slow', 'flat', 0, 0.5),
  water_deep: axes('none', 'none', 'blocked-all', 'flat', 0, 0),
  mud: axes('none', 'none', 'walkable-slow', 'flat', 0, 0.7),
  rubble_ground: axes('none', 'light', 'walkable-slow', 'flat', 0, 0.8),
  snow: axes('none', 'none', 'walkable-slow', 'flat', 0, 0.85),
  sand: axes('none', 'none', 'walkable-slow', 'flat', 0, 0.9),
};

export const POINT_AXES: Record<PointObjectKind, CoverAxes> = {
  barrel: axes('thin', 'heavy', 'blocked-foot', 'chest', 1.5, 0),
  bush_small: axes('thin', 'light', 'walkable-free', 'low', 1.0, 1.0),
  bush_medium: axes('thin', 'light', 'walkable-slow', 'chest', 1.5, 0.7),
  bush_large: axes('full', 'heavy', 'walkable-slow', 'tall', 2.2, 0.6),
  car: axes('full', 'heavy', 'blocked-foot', 'tall', 2.2, 0),
  cart_empty: axes('thin', 'light', 'blocked-foot', 'chest', 1.5, 0),
  cart_full: axes('full', 'heavy', 'blocked-foot', 'tall', 2.2, 0),
  dragons_teeth: axes('none', 'none', 'blocked-vehicle', 'low', 1.0, 0),
  garden_shed: axes('full', 'full', 'blocked-foot', 'full', 4.0, 0),
  grave: axes('none', 'light', 'walkable-slow', 'flat', 0.2, 0.85),
  gravestone: axes('thin', 'light', 'walkable-slow', 'low', 1.0, 0.7),
  haystack: axes('thin', 'light', 'walkable-slow', 'chest', 1.8, 0.6),
  oil_drums: axes('thin', 'heavy', 'blocked-foot', 'chest', 1.5, 0),
  rubble_pile: axes('thin', 'heavy', 'walkable-slow', 'chest', 1.5, 0.55),
  signpost: axes('none', 'none', 'walkable-free', 'tall', 2.5, 1.0),
  storage_tank: axes('full', 'full', 'blocked-foot', 'full', 4.5, 0),
  tank_trap: axes('none', 'light', 'blocked-vehicle', 'low', 1.0, 0),
  telegraph_pole: axes('none', 'light', 'blocked-foot', 'full', 6.0, 0),
  trough: axes('none', 'heavy', 'blocked-foot', 'low', 1.0, 0),
  tyres: axes('thin', 'heavy', 'blocked-foot', 'chest', 1.5, 0),
  well: axes('full', 'full', 'blocked-foot', 'tall', 2.2, 0),
  tree_forest: axes('thin', 'heavy', 'walkable-slow', 'tall', 2.5, 0.7),
  tree_fruit: axes('thin', 'light', 'walkable-slow', 'chest', 1.8, 0.75),
  tree_jungle: axes('full', 'heavy', 'walkable-slow', 'tall', 2.6, 0.55),
  tree_oak: axes('thin', 'heavy', 'walkable-slow', 'tall', 3.0, 0.7),
  tree_poplar: axes('thin', 'light', 'walkable-slow', 'tall', 3.2, 0.8),
  tree_snow: axes('thin', 'heavy', 'walkable-slow', 'tall', 2.7, 0.7),
};

export const BARRIER_AXES: Record<LinearBarrierKind, CoverAxes> = {
  hedge: axes('thin', 'light', 'walkable-slow', 'chest', 1.5, 0.5),
  bocage: axes('full', 'heavy', 'blocked-foot', 'tall', 2.2, 0),
  stone_wall_low: axes('full', 'heavy', 'blocked-foot', 'low', 1.0, 0),
  wood_fence: axes('full', 'light', 'blocked-foot', 'tall', 2.0, 0),
  bamboo_fence: axes('full', 'light', 'blocked-foot', 'tall', 2.0, 0),
  rail_fence: axes('thin', 'light', 'walkable-slow', 'chest', 1.3, 0.8),
  berm: axes('full', 'heavy', 'walkable-slow', 'low', 1.2, 0.6),
  wire_light: axes('none', 'none', 'blocked-foot', 'low', 0.6, 0),
  wire_dense: axes('none', 'none', 'blocked-foot', 'low', 0.7, 0),
  wire_razor: axes('none', 'none', 'blocked-foot', 'low', 0.8, 0),
  rubble_strip: axes('thin', 'light', 'walkable-slow', 'low', 0.8, 0.7),
};

// Damaged-state overrides — half cover, lower LOS floor, easier to cross.
// Entries only for destructibles that actually transition through a damaged
// state (HP > 0 but < maxHp). Destroyed barriers either vanish (wire, fences)
// or transition to `rubble_strip` (hedge, walls, sandbags) — handled in
// mutation code, not a lookup.
export const DAMAGED_AXES: Partial<Record<LinearBarrierKind | PointObjectKind, CoverAxes>> = {
  hedge: axes('none', 'light', 'walkable-slow', 'low', 0.6, 0.7),
  bocage: axes('thin', 'heavy', 'walkable-slow', 'chest', 1.3, 0.4),
  stone_wall_low: axes('thin', 'heavy', 'walkable-slow', 'low', 0.7, 0.3),
  wood_fence: axes('thin', 'light', 'walkable-slow', 'chest', 1.2, 0.5),
  bamboo_fence: axes('thin', 'light', 'walkable-slow', 'chest', 1.2, 0.5),
  rail_fence: axes('none', 'light', 'walkable-slow', 'low', 0.8, 1.0),
  wire_light: axes('none', 'none', 'walkable-slow', 'flat', 0.2, 0.6),
  wire_dense: axes('none', 'none', 'walkable-slow', 'flat', 0.3, 0.55),
  wire_razor: axes('none', 'none', 'walkable-slow', 'flat', 0.4, 0.5),
  barrel: axes('thin', 'light', 'walkable-slow', 'low', 0.8, 0.7),
  car: axes('thin', 'heavy', 'walkable-slow', 'chest', 1.3, 0.4),
  cart_empty: axes('none', 'light', 'walkable-slow', 'low', 0.8, 0.7),
  cart_full: axes('thin', 'heavy', 'walkable-slow', 'chest', 1.3, 0.5),
  garden_shed: axes('thin', 'heavy', 'walkable-slow', 'chest', 1.5, 0.5),
  oil_drums: axes('thin', 'light', 'walkable-slow', 'low', 0.8, 0.7),
  rubble_pile: axes('thin', 'light', 'walkable-slow', 'low', 0.7, 0.8),
  storage_tank: axes('thin', 'heavy', 'walkable-slow', 'chest', 1.5, 0.5),
  telegraph_pole: axes('none', 'none', 'walkable-free', 'flat', 0, 1.0),
  tyres: axes('thin', 'light', 'walkable-slow', 'low', 0.8, 0.7),
  well: axes('thin', 'heavy', 'walkable-slow', 'chest', 1.5, 0.5),
  haystack: axes('none', 'light', 'walkable-slow', 'low', 0.6, 0.8),
  gravestone: axes('none', 'light', 'walkable-slow', 'flat', 0.4, 0.9),
  tree_forest: axes('thin', 'light', 'walkable-slow', 'low', 1.0, 0.9),
  tree_fruit: axes('none', 'light', 'walkable-slow', 'low', 0.8, 1.0),
  tree_jungle: axes('thin', 'heavy', 'walkable-slow', 'chest', 1.5, 0.7),
  tree_oak: axes('thin', 'heavy', 'walkable-slow', 'chest', 1.8, 0.7),
  tree_poplar: axes('thin', 'light', 'walkable-slow', 'low', 1.2, 0.9),
  tree_snow: axes('thin', 'light', 'walkable-slow', 'low', 1.2, 0.9),
};

// Max HP per destructible kind. Zero (or absent) = indestructible. Used by
// stampBarrier / stampPoint at mapgen time to populate hpN / hpW / pointHp.
export const BARRIER_MAX_HP: Partial<Record<LinearBarrierKind, number>> = {
  hedge: 40,
  bocage: 120,
  stone_wall_low: 80,
  wood_fence: 20,
  bamboo_fence: 15,
  rail_fence: 10,
  wire_light: 5,
  wire_dense: 10,
  wire_razor: 15,
  // berm + rubble_strip are effectively indestructible.
};

export const POINT_MAX_HP: Partial<Record<PointObjectKind, number>> = {
  barrel: 20,
  bush_small: 5,
  bush_medium: 10,
  bush_large: 15,
  car: 60,
  cart_empty: 25,
  cart_full: 40,
  garden_shed: 35,
  gravestone: 20,
  haystack: 30,
  oil_drums: 15,
  rubble_pile: 0, // indestructible rubble
  storage_tank: 60,
  telegraph_pole: 15,
  tyres: 20,
  well: 50,
  tree_forest: 30,
  tree_fruit: 15,
  tree_jungle: 40,
  tree_oak: 55,
  tree_poplar: 25,
  tree_snow: 30,
};

// Whether a destroyed destructible leaves a rubble_strip/rubble_pile remnant
// (vs vanishing). Used by applyBarrierDamage / applyPointDamage mutators.
export const RUBBLE_ON_DESTROY: Partial<Record<LinearBarrierKind | PointObjectKind, boolean>> = {
  hedge: true,
  bocage: true,
  stone_wall_low: true,
  wood_fence: true,
  bamboo_fence: true,
  rail_fence: false,
  wire_light: false,
  wire_dense: false,
  wire_razor: false,
  car: true,
  cart_full: true,
  garden_shed: true,
  storage_tank: true,
  well: true,
  tree_oak: true,
  tree_jungle: true,
};

// ---------------------------------------------------------------------------
// Building registry.

export type BuildingRecord = {
  readonly id: number;
  readonly family: BuildingFamily;
  readonly floors: number;
  readonly footprintTiles: readonly { x: number; y: number }[];
  readonly wallHpInitial: number;
};

// ---------------------------------------------------------------------------
// Edge helpers — ALWAYS read edges via these, never raw-access edgeN/edgeW.

export type EdgeSide = 'N' | 'S' | 'E' | 'W';

export function getEdge(world: World, x: number, y: number, side: EdgeSide): number {
  switch (side) {
    case 'N':
      return world.edgeN[y * world.width + x];
    case 'W':
      return world.edgeW[y * world.width + x];
    case 'S':
      // South edge of (x, y) == north edge of (x, y+1).
      if (y + 1 >= world.height) return 0;
      return world.edgeN[(y + 1) * world.width + x];
    case 'E':
      if (x + 1 >= world.width) return 0;
      return world.edgeW[y * world.width + (x + 1)];
  }
}

export function setEdge(world: World, x: number, y: number, side: EdgeSide, b: number): void {
  switch (side) {
    case 'N':
      world.edgeN[y * world.width + x] = b;
      return;
    case 'W':
      world.edgeW[y * world.width + x] = b;
      return;
    case 'S':
      if (y + 1 >= world.height) return;
      world.edgeN[(y + 1) * world.width + x] = b;
      return;
    case 'E':
      if (x + 1 >= world.width) return;
      world.edgeW[y * world.width + (x + 1)] = b;
      return;
  }
}

// The side from whose direction a ray came into tile (tx, ty). Used by cover
// directional lookups — a stone_wall on edgeN gives cover from a north-side
// shooter, not south.
export function sideFromBearing(bearing: number): EdgeSide {
  // Bearing = atan2(dy, dx). Discretize into N/E/S/W by angle.
  // East = 0, North = -π/2 (since y increases downward in screen coords),
  // but we keep math-convention here: north = +y, south = -y. The callers
  // feed atan2 with (shooter.y - target.y, shooter.x - target.x), which
  // points from target toward shooter. That's the "incoming" direction.
  const twoPi = Math.PI * 2;
  const normalized = ((bearing % twoPi) + twoPi) % twoPi;
  const deg = (normalized * 180) / Math.PI;
  if (deg >= 45 && deg < 135) return 'N';
  if (deg >= 135 && deg < 225) return 'W';
  if (deg >= 225 && deg < 315) return 'S';
  return 'E';
}

// ---------------------------------------------------------------------------
// World struct + constructors.

export type World = {
  readonly width: number;
  readonly height: number;
  readonly tileSizeMeters: number;
  // Per-tile grids — see ADR 012.
  readonly base: Uint8Array;
  readonly point: Uint8Array;
  readonly edgeN: Uint8Array;
  readonly edgeW: Uint8Array;
  readonly edgeOverrideN: Uint8Array;
  readonly edgeOverrideW: Uint8Array;
  readonly buildingId: Uint16Array;
  readonly walkability: Uint16Array;
  readonly coverProfile: Uint8Array;
  readonly elevationStep: Uint8Array;
  readonly structureHeight: Uint8Array;
  // Destructible HP — one value per destructible slot. `hpN` applies to the
  // edgeN barrier on this tile; `hpW` to the edgeW barrier; `pointHp` to the
  // point object. Building-wall HP lives in the edge that carries the wall
  // (wall-adjacent edge bytes are stamped at pipeline time).
  readonly hpN: Uint16Array;
  readonly hpW: Uint16Array;
  readonly hpPoint: Uint16Array;
  readonly buildings: readonly BuildingRecord[];
};

export type WorldInit = {
  readonly width: number;
  readonly height: number;
  readonly tileSizeMeters: number;
  readonly base?: Uint8Array;
  readonly point?: Uint8Array;
  readonly edgeN?: Uint8Array;
  readonly edgeW?: Uint8Array;
  readonly edgeOverrideN?: Uint8Array;
  readonly edgeOverrideW?: Uint8Array;
  readonly buildingId?: Uint16Array;
  readonly walkability?: Uint16Array;
  readonly coverProfile?: Uint8Array;
  readonly elevationStep?: Uint8Array;
  readonly structureHeight?: Uint8Array;
  readonly hpN?: Uint16Array;
  readonly hpW?: Uint16Array;
  readonly hpPoint?: Uint16Array;
  readonly buildings?: readonly BuildingRecord[];
};

export function makeWorld(
  width: number,
  height: number,
  tileSizeMeters: number,
  fill: TerrainBase = 'open',
): World {
  const N = width * height;
  const base = new Uint8Array(N);
  base.fill(baseToByte(fill));
  return {
    width,
    height,
    tileSizeMeters,
    base,
    point: new Uint8Array(N),
    edgeN: new Uint8Array(N),
    edgeW: new Uint8Array(N),
    edgeOverrideN: new Uint8Array(N),
    edgeOverrideW: new Uint8Array(N),
    buildingId: new Uint16Array(N),
    walkability: new Uint16Array(N),
    coverProfile: new Uint8Array(N),
    elevationStep: new Uint8Array(N),
    structureHeight: new Uint8Array(N),
    hpN: new Uint16Array(N),
    hpW: new Uint16Array(N),
    hpPoint: new Uint16Array(N),
    buildings: [],
  };
}

export function makeWorldFromBuffers(init: WorldInit): World {
  const N = init.width * init.height;
  return {
    width: init.width,
    height: init.height,
    tileSizeMeters: init.tileSizeMeters,
    base: init.base ?? new Uint8Array(N),
    point: init.point ?? new Uint8Array(N),
    edgeN: init.edgeN ?? new Uint8Array(N),
    edgeW: init.edgeW ?? new Uint8Array(N),
    edgeOverrideN: init.edgeOverrideN ?? new Uint8Array(N),
    edgeOverrideW: init.edgeOverrideW ?? new Uint8Array(N),
    buildingId: init.buildingId ?? new Uint16Array(N),
    walkability: init.walkability ?? new Uint16Array(N),
    coverProfile: init.coverProfile ?? new Uint8Array(N),
    elevationStep: init.elevationStep ?? new Uint8Array(N),
    structureHeight: init.structureHeight ?? new Uint8Array(N),
    hpN: init.hpN ?? new Uint16Array(N),
    hpW: init.hpW ?? new Uint16Array(N),
    hpPoint: init.hpPoint ?? new Uint16Array(N),
    buildings: init.buildings ?? [],
  };
}

export function tileIndex(world: World, x: number, y: number): number {
  return y * world.width + x;
}

export function inBounds(world: World, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < world.width && y < world.height;
}

// Thin foot-passable check used by non-pathfinding callers (movement bias,
// scatter validators, waypoint regen). Reads the pre-baked walkability mask;
// authored maps without a baked mask fall back to the base axes.
export function isFootPassable(world: World, x: number, y: number): boolean {
  if (!inBounds(world, x, y)) return false;
  if (world.walkability && world.walkability.length > 0) {
    return (world.walkability[y * world.width + x] & WALK_FOOT) !== 0;
  }
  const axes = BASE_AXES[byteToBase(world.base[y * world.width + x])];
  return axes.move !== 'blocked-all' && axes.move !== 'blocked-foot';
}

// ---------------------------------------------------------------------------
// Axis lookup — resolves what (if any) cover a tile provides.
//
// Base surface is always present. Point object, if any, stacks atop base.
// Building walls (buildingId > 0 on a tile adjacent to a non-building tile
// via an edge) are authoritative for that edge in cover reads.

export function baseAxesAt(world: World, x: number, y: number): CoverAxes {
  if (!inBounds(world, x, y)) return BASE_AXES.open;
  return BASE_AXES[byteToBase(world.base[tileIndex(world, x, y)])];
}

export function pointAxesAt(world: World, x: number, y: number): CoverAxes | null {
  if (!inBounds(world, x, y)) return null;
  const b = world.point[tileIndex(world, x, y)];
  const kind = byteToPoint(b);
  if (!kind) return null;
  const damaged = world.hpPoint[tileIndex(world, x, y)] > 0 &&
    world.hpPoint[tileIndex(world, x, y)] < (POINT_MAX_HP[kind] ?? 0);
  if (damaged) {
    const d = DAMAGED_AXES[kind];
    if (d) return d;
  }
  return POINT_AXES[kind];
}

// Picks the strongest axis contributor at a tile, considering base + point +
// crossed edge (if a bearing is specified). For MVP cover scoring we take the
// "worst for the shooter" (most LOS-blocking, most cover).
function stronger(a: CoverAxes, b: CoverAxes | null): CoverAxes {
  if (!b) return a;
  const rankLos = (x: LosBlock): number => (x === 'full' ? 2 : x === 'thin' ? 1 : 0);
  const rankCover = (x: CoverLevel): number =>
    x === 'full' ? 3 : x === 'heavy' ? 2 : x === 'light' ? 1 : 0;
  const aScore = rankLos(a.los) * 10 + rankCover(a.cover);
  const bScore = rankLos(b.los) * 10 + rankCover(b.cover);
  return bScore > aScore ? b : a;
}

// Non-directional read — used by cover pre-bake, minimap rendering, etc.
// Directional reads (which edge does a ray cross?) go through
// terrainAxesDirectional.
export function terrainAxesAt(world: World, x: number, y: number): CoverAxes {
  let best: CoverAxes = baseAxesAt(world, x, y);
  best = stronger(best, pointAxesAt(world, x, y));
  // Any edge barrier that's present contributes at least as much cover as
  // itself from a direction that crosses it — we consume the max of N + W
  // since those are the authoritative edges for this tile.
  best = stronger(best, edgeBarrierAxesFor(world, x, y, 'N'));
  best = stronger(best, edgeBarrierAxesFor(world, x, y, 'W'));
  return best;
}

export function edgeBarrierAxesFor(
  world: World,
  x: number,
  y: number,
  side: EdgeSide,
): CoverAxes | null {
  const b = getEdge(world, x, y, side);
  const kind = barrierKindOf(b);
  if (!kind) return null;
  const damaged = barrierIsDamaged(b);
  if (damaged) {
    const d = DAMAGED_AXES[kind];
    if (d) return d;
  }
  return BARRIER_AXES[kind];
}

// Directional read — bearing points from target toward the observer (the
// direction a ray comes from). The crossed edge on the target's tile
// determines cover.
export function terrainAxesDirectional(
  world: World,
  x: number,
  y: number,
  incomingBearing: number,
): CoverAxes {
  let best: CoverAxes = baseAxesAt(world, x, y);
  best = stronger(best, pointAxesAt(world, x, y));
  const side = sideFromBearing(incomingBearing);
  best = stronger(best, edgeBarrierAxesFor(world, x, y, side));
  return best;
}

// ---------------------------------------------------------------------------
// Simple setters for authored-map load + pipeline writes.

export function setBase(world: World, x: number, y: number, k: TerrainBase): void {
  world.base[tileIndex(world, x, y)] = baseToByte(k);
}

export function setPoint(
  world: World,
  x: number,
  y: number,
  k: PointObjectKind | null,
  damaged = false,
): void {
  const idx = tileIndex(world, x, y);
  if (!k) {
    world.point[idx] = 0;
    world.hpPoint[idx] = 0;
    return;
  }
  world.point[idx] = pointToByte(k);
  const maxHp = POINT_MAX_HP[k] ?? 0;
  world.hpPoint[idx] = damaged ? Math.floor(maxHp / 2) : maxHp;
}

export function setBarrier(
  world: World,
  x: number,
  y: number,
  side: 'N' | 'W',
  k: LinearBarrierKind | null,
  damaged = false,
): void {
  const idx = tileIndex(world, x, y);
  if (!k) {
    if (side === 'N') {
      world.edgeN[idx] = 0;
      world.hpN[idx] = 0;
    } else {
      world.edgeW[idx] = 0;
      world.hpW[idx] = 0;
    }
    return;
  }
  const byte = encodeBarrier(k, damaged);
  const maxHp = BARRIER_MAX_HP[k] ?? 0;
  if (side === 'N') {
    world.edgeN[idx] = byte;
    world.hpN[idx] = damaged ? Math.floor(maxHp / 2) : maxHp;
  } else {
    world.edgeW[idx] = byte;
    world.hpW[idx] = damaged ? Math.floor(maxHp / 2) : maxHp;
  }
}

// ---------------------------------------------------------------------------
// Compact axis constructor — keeps the tables above readable.

function axes(
  los: LosBlock,
  cover: CoverLevel,
  move: MoveEffect,
  heightProfile: HeightProfile,
  heightMeters: number,
  moveSpeedMult: number,
): CoverAxes {
  return { los, cover, move, heightProfile, heightMeters, moveSpeedMult };
}
