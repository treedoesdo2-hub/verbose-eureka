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
  // P3.3 — baked hill-shading (Uint8ClampedArray, 128 = neutral).
  // Populated at mapgen time; authored-map fixtures default to an
  // all-128 buffer.
  readonly shadingBake: Uint8ClampedArray;
  // P3.5b — per-tile contour flag (1 where tile sits on an elevation
  // step boundary).
  readonly contours: Uint8Array;
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
  readonly shadingBake?: Uint8ClampedArray;
  readonly contours?: Uint8Array;
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
  const walkability = new Uint16Array(N);
  const coverProfile = new Uint8Array(N);
  const fillMask = walkMaskFromMove(BASE_AXES[fill].move);
  const fillCover = coverByteFromAxes(BASE_AXES[fill]);
  walkability.fill(fillMask);
  coverProfile.fill(fillCover);
  const shadingBake = new Uint8ClampedArray(N);
  shadingBake.fill(128);
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
    walkability,
    coverProfile,
    elevationStep: new Uint8Array(N),
    structureHeight: new Uint8Array(N),
    hpN: new Uint16Array(N),
    hpW: new Uint16Array(N),
    hpPoint: new Uint16Array(N),
    buildings: [],
    shadingBake,
    contours: new Uint8Array(N),
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
    shadingBake:
      init.shadingBake ??
      (() => {
        const a = new Uint8ClampedArray(N);
        a.fill(128);
        return a;
      })(),
    contours: init.contours ?? new Uint8Array(N),
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

// Edge-barrier movement gate (#276).
//
// A tile-by-tile walkability mask captures *what's standing on this tile*,
// but not *what's standing between this tile and its neighbor*. Hedgerows,
// stone walls, fences, and bocage are all per-edge data — a unit on an
// open tile next to an open tile is still blocked from stepping if a
// stone wall sits on the shared edge. Without this check, infantry walk
// through walls.
//
// Returns true when the move from (fromX, fromY) to (toX, toY) is blocked
// by an edge barrier (or by an EDGE_OVERRIDE that gates passage — closed
// door, intact window). Diagonal moves clear if EITHER L-shaped path
// clears (matches the standard A* corner rule). Cardinal moves are exact.
//
// The MovementMode argument lets vehicles vs. infantry get different
// blocking — bocage walks-slow for tracked but blocks-foot for infantry.
//
// Damaged barriers and damaged points use DAMAGED_AXES; the move axis
// there is more permissive (most degrade to walkable-slow).
export function edgeBlocksMovement(
  world: World,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  mode: MovementMode,
): boolean {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dx === 0 && dy === 0) return false;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    // Multi-tile leap — caller should be stepping one tile at a time.
    // Be safe and treat as blocked.
    return true;
  }
  // Cardinal: read the one shared edge.
  if (dx === 0 || dy === 0) {
    return cardinalEdgeBlocks(world, fromX, fromY, toX, toY, mode);
  }
  // Diagonal: must be able to take at least one of the two L-shaped
  // paths. Path A: (fromX,fromY) → (toX,fromY) → (toX,toY). Path B:
  // (fromX,fromY) → (fromX,toY) → (toX,toY).
  const pathA =
    !cardinalEdgeBlocks(world, fromX, fromY, toX, fromY, mode) &&
    !cardinalEdgeBlocks(world, toX, fromY, toX, toY, mode);
  const pathB =
    !cardinalEdgeBlocks(world, fromX, fromY, fromX, toY, mode) &&
    !cardinalEdgeBlocks(world, fromX, toY, toX, toY, mode);
  return !(pathA || pathB);
}

function cardinalEdgeBlocks(
  world: World,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  mode: MovementMode,
): boolean {
  // Pick which tile owns the shared edge:
  //   moving east  (dx=+1):  edgeW of (toX, toY)
  //   moving west  (dx=-1):  edgeW of (fromX, fromY)
  //   moving south (dy=+1):  edgeN of (toX, toY)
  //   moving north (dy=-1):  edgeN of (fromX, fromY)
  const dx = toX - fromX;
  const dy = toY - fromY;
  let edgeByte: number;
  let overrideByte: number;
  if (dx === 1) {
    const i = tileIndex(world, toX, toY);
    edgeByte = world.edgeW[i];
    overrideByte = world.edgeOverrideW[i];
  } else if (dx === -1) {
    const i = tileIndex(world, fromX, fromY);
    edgeByte = world.edgeW[i];
    overrideByte = world.edgeOverrideW[i];
  } else if (dy === 1) {
    const i = tileIndex(world, toX, toY);
    edgeByte = world.edgeN[i];
    overrideByte = world.edgeOverrideN[i];
  } else if (dy === -1) {
    const i = tileIndex(world, fromX, fromY);
    edgeByte = world.edgeN[i];
    overrideByte = world.edgeOverrideN[i];
  } else {
    return false;
  }
  // Override (door / window) takes priority over the underlying barrier.
  // Open door + broken window: passable. Closed door + intact window:
  // foot-blocked. Vehicles can't fit through a doorway either.
  if (overrideByte === EDGE_OVERRIDE_DOOR_OPEN) return false;
  if (overrideByte === EDGE_OVERRIDE_WINDOW_BROKEN) {
    // Foot/prone can climb through; vehicles cannot.
    return mode === 'wheeled' || mode === 'tracked';
  }
  if (overrideByte === EDGE_OVERRIDE_DOOR_CLOSED) {
    return mode === 'wheeled' || mode === 'tracked' || mode === 'mech' || mode === 'power_armor';
  }
  if (overrideByte === EDGE_OVERRIDE_WINDOW_INTACT) return true;
  // No override — read the barrier kind. Empty edge: passable.
  const kindIdx = edgeByte & 0x0f;
  if (kindIdx === 0) return false;
  const kind = BARRIER_KINDS[kindIdx - 1];
  if (!kind) return false;
  // Damaged barriers fall back to DAMAGED_AXES if defined; otherwise
  // intact axes apply.
  let axesEntry: CoverAxes;
  if (barrierIsDamaged(edgeByte)) {
    const damaged = DAMAGED_AXES[kind];
    axesEntry = damaged ?? BARRIER_AXES[kind];
  } else {
    axesEntry = BARRIER_AXES[kind];
  }
  switch (axesEntry.move) {
    case 'walkable-free':
    case 'walkable-slow':
      return false;
    case 'blocked-all':
      return true;
    case 'blocked-foot':
      // Mechs and power armor can step over chest-height walls / fences;
      // wheeled and tracked are blocked too unless they break it.
      return mode !== 'mech' && mode !== 'power_armor';
    case 'blocked-vehicle':
      // Tank traps / dragon's teeth — infantry pass freely.
      return mode === 'wheeled' || mode === 'tracked';
  }
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
export function stronger(a: CoverAxes, b: CoverAxes | null): CoverAxes {
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
  rebakeTile(world, x, y);
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
    rebakeTile(world, x, y);
    return;
  }
  world.point[idx] = pointToByte(k);
  const maxHp = POINT_MAX_HP[k] ?? 0;
  world.hpPoint[idx] = damaged ? Math.floor(maxHp / 2) : maxHp;
  rebakeTile(world, x, y);
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
    rebakeTile(world, x, y);
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
  rebakeTile(world, x, y);
}

// Destructible state machine (COA-2 task #13). Damage transitions
// intact → damaged (at half HP) → destroyed (at 0 HP). Destroyed items
// either vanish or leave rubble per RUBBLE_ON_DESTROY. State is derived
// from current HP vs max HP — the edge / point byte's damaged flag is
// kept in sync by applyBarrierDamage / applyPointDamage below.
export type DestructibleState = 'intact' | 'damaged' | 'destroyed';

function stateFromHp(hp: number, maxHp: number): DestructibleState {
  if (maxHp <= 0) return 'intact';
  if (hp <= 0) return 'destroyed';
  if (hp * 2 <= maxHp) return 'damaged';
  return 'intact';
}

export type DamageResult = {
  readonly consumed: number;
  readonly remainingHp: number;
  readonly prevState: DestructibleState;
  readonly nextState: DestructibleState;
  readonly destroyed: boolean;
  readonly leftRubble: boolean;
};

export function applyBarrierDamage(
  world: World,
  x: number,
  y: number,
  side: 'N' | 'W',
  damage: number,
): DamageResult | null {
  if (!inBounds(world, x, y)) return null;
  const idx = tileIndex(world, x, y);
  const edgeByte = side === 'N' ? world.edgeN[idx] : world.edgeW[idx];
  const kind = barrierKindOf(edgeByte);
  if (!kind) return null;
  const maxHp = BARRIER_MAX_HP[kind] ?? 0;
  if (maxHp <= 0) {
    // Indestructible barrier (berm, rubble_strip) — no-op but still valid.
    return {
      consumed: 0,
      remainingHp: 0,
      prevState: 'intact',
      nextState: 'intact',
      destroyed: false,
      leftRubble: false,
    };
  }
  const hpArr = side === 'N' ? world.hpN : world.hpW;
  const prevHp = hpArr[idx];
  const actualPrevHp = prevHp === 0 && !barrierIsDamaged(edgeByte) ? maxHp : prevHp;
  const nextHp = Math.max(0, actualPrevHp - Math.max(0, damage));
  const prevState = stateFromHp(actualPrevHp, maxHp);
  const nextState = stateFromHp(nextHp, maxHp);

  if (nextHp === 0) {
    // Destroyed — either vanish or leave rubble_strip.
    const leavesRubble = RUBBLE_ON_DESTROY[kind] ?? false;
    if (leavesRubble) {
      const rubble = encodeBarrier('rubble_strip', false);
      if (side === 'N') world.edgeN[idx] = rubble;
      else world.edgeW[idx] = rubble;
      hpArr[idx] = 0;
    } else {
      if (side === 'N') world.edgeN[idx] = 0;
      else world.edgeW[idx] = 0;
      hpArr[idx] = 0;
    }
    rebakeTile(world, x, y);
    return {
      consumed: actualPrevHp - nextHp,
      remainingHp: 0,
      prevState,
      nextState: 'destroyed',
      destroyed: true,
      leftRubble: leavesRubble,
    };
  }

  hpArr[idx] = nextHp;
  const damagedFlag = nextState === 'damaged';
  const repackByte = encodeBarrier(kind, damagedFlag);
  if (side === 'N') world.edgeN[idx] = repackByte;
  else world.edgeW[idx] = repackByte;
  if (prevState !== nextState) rebakeTile(world, x, y);
  return {
    consumed: actualPrevHp - nextHp,
    remainingHp: nextHp,
    prevState,
    nextState,
    destroyed: false,
    leftRubble: false,
  };
}

export function applyPointDamage(
  world: World,
  x: number,
  y: number,
  damage: number,
): DamageResult | null {
  if (!inBounds(world, x, y)) return null;
  const idx = tileIndex(world, x, y);
  const pointByte = world.point[idx];
  const kind = byteToPoint(pointByte);
  if (!kind) return null;
  const maxHp = POINT_MAX_HP[kind] ?? 0;
  if (maxHp <= 0) {
    return {
      consumed: 0,
      remainingHp: 0,
      prevState: 'intact',
      nextState: 'intact',
      destroyed: false,
      leftRubble: false,
    };
  }
  const prevHp = world.hpPoint[idx];
  const actualPrevHp = prevHp === 0 ? maxHp : prevHp;
  const nextHp = Math.max(0, actualPrevHp - Math.max(0, damage));
  const prevState = stateFromHp(actualPrevHp, maxHp);
  const nextState = stateFromHp(nextHp, maxHp);

  if (nextHp === 0) {
    const leavesRubble = RUBBLE_ON_DESTROY[kind] ?? false;
    if (leavesRubble) {
      world.point[idx] = pointToByte('rubble_pile');
      world.hpPoint[idx] = 0; // indestructible rubble
    } else {
      world.point[idx] = 0;
      world.hpPoint[idx] = 0;
    }
    rebakeTile(world, x, y);
    return {
      consumed: actualPrevHp - nextHp,
      remainingHp: 0,
      prevState,
      nextState: 'destroyed',
      destroyed: true,
      leftRubble: leavesRubble,
    };
  }

  world.hpPoint[idx] = nextHp;
  if (prevState !== nextState) rebakeTile(world, x, y);
  return {
    consumed: actualPrevHp - nextHp,
    remainingHp: nextHp,
    prevState,
    nextState,
    destroyed: false,
    leftRubble: false,
  };
}

export function barrierStateAt(
  world: World,
  x: number,
  y: number,
  side: 'N' | 'W',
): DestructibleState {
  if (!inBounds(world, x, y)) return 'intact';
  const idx = tileIndex(world, x, y);
  const edgeByte = side === 'N' ? world.edgeN[idx] : world.edgeW[idx];
  const kind = barrierKindOf(edgeByte);
  if (!kind) return 'intact';
  const maxHp = BARRIER_MAX_HP[kind] ?? 0;
  if (maxHp <= 0) return 'intact';
  const hp = side === 'N' ? world.hpN[idx] : world.hpW[idx];
  return stateFromHp(hp === 0 && !barrierIsDamaged(edgeByte) ? maxHp : hp, maxHp);
}

export function pointStateAt(world: World, x: number, y: number): DestructibleState {
  if (!inBounds(world, x, y)) return 'intact';
  const idx = tileIndex(world, x, y);
  const kind = byteToPoint(world.point[idx]);
  if (!kind) return 'intact';
  const maxHp = POINT_MAX_HP[kind] ?? 0;
  if (maxHp <= 0) return 'intact';
  const hp = world.hpPoint[idx];
  return stateFromHp(hp === 0 ? maxHp : hp, maxHp);
}

// Rebake walkability + coverProfile for a single tile. Called from all
// mutation paths so tests and authored-map loaders don't have to call a
// separate bake sweep. Pipeline callers also rebake at the end, but this
// keeps incremental edits consistent.
//
// Reads base + point + N/W edge barriers (mirrors terrainAxesAt) so a
// tile's coverProfile and walkability stay consistent with directional
// cover lookups at runtime — COA-4 #88/#89.
function rebakeTile(world: World, x: number, y: number): void {
  if (!inBounds(world, x, y)) return;
  const idx = tileIndex(world, x, y);
  const baseAxes = BASE_AXES[byteToBase(world.base[idx])];
  const pAxes = pointAxesAt(world, x, y);
  const eNAxes = edgeBarrierAxesFor(world, x, y, 'N');
  const eWAxes = edgeBarrierAxesFor(world, x, y, 'W');
  const isBuilding = world.buildingId[idx] !== 0;

  let mask = walkMaskFromMove(baseAxes.move);
  if (pAxes) mask &= walkMaskFromMove(pAxes.move);
  if (eNAxes) mask &= walkMaskFromMove(eNAxes.move);
  if (eWAxes) mask &= walkMaskFromMove(eWAxes.move);
  if (isBuilding) mask &= WALK_INFANTRY_MASK;
  const effMult = Math.min(
    pAxes?.moveSpeedMult ?? baseAxes.moveSpeedMult,
    eNAxes?.moveSpeedMult ?? 1.0,
    eWAxes?.moveSpeedMult ?? 1.0,
  );
  if (effMult < 1.0) mask |= WALK_SLOW;
  world.walkability[idx] = mask;

  let strongest: CoverAxes = baseAxes;
  if (pAxes) strongest = stronger(strongest, pAxes);
  if (eNAxes) strongest = stronger(strongest, eNAxes);
  if (eWAxes) strongest = stronger(strongest, eWAxes);
  world.coverProfile[idx] = coverByteFromAxes(strongest);
}

export function walkMaskFromMove(move: MoveEffect): number {
  switch (move) {
    case 'walkable-free':
      return (
        WALK_FOOT |
        WALK_PRONE |
        WALK_MECH |
        WALK_POWER_ARMOR |
        WALK_WHEELED |
        WALK_TRACKED
      );
    case 'walkable-slow':
      return (
        WALK_FOOT |
        WALK_PRONE |
        WALK_MECH |
        WALK_POWER_ARMOR |
        WALK_WHEELED |
        WALK_TRACKED |
        WALK_SLOW
      );
    case 'blocked-foot':
      return WALK_MECH | WALK_POWER_ARMOR;
    case 'blocked-vehicle':
      return WALK_INFANTRY_MASK;
    case 'blocked-all':
      return 0;
  }
}

export function coverByteFromAxes(axes: CoverAxes): number {
  const losBits = axes.los === 'full' ? 2 : axes.los === 'thin' ? 1 : 0;
  const coverBits =
    axes.cover === 'full' ? 3 : axes.cover === 'heavy' ? 2 : axes.cover === 'light' ? 1 : 0;
  const heightBits =
    axes.heightProfile === 'full'
      ? 4
      : axes.heightProfile === 'tall'
        ? 3
        : axes.heightProfile === 'chest'
          ? 2
          : axes.heightProfile === 'low'
            ? 1
            : 0;
  return losBits | (coverBits << 2) | (heightBits << 4);
}

// Dirty-bit cache invalidation (COA-2 task #15).
//
// Default mutation paths (setBase/setPoint/setBarrier/apply*Damage) eagerly
// rebake the touched tile. Bulk stampers (stampBarrierLine, building walls,
// forest scatter) can flip the dirty bit instead, defer rebakes, then
// flushDirtyTiles at the end of the stamp pass to amortize cost.

export const COVER_PROFILE_DIRTY_BIT = 1 << 7;

export function coverProfileDirty(byte: number): boolean {
  return (byte & COVER_PROFILE_DIRTY_BIT) !== 0;
}

export function markTileDirty(world: World, x: number, y: number): void {
  if (!inBounds(world, x, y)) return;
  const idx = tileIndex(world, x, y);
  world.coverProfile[idx] |= COVER_PROFILE_DIRTY_BIT;
}

export function flushDirtyTiles(world: World): number {
  const W = world.width;
  const H = world.height;
  let flushed = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (coverProfileDirty(world.coverProfile[y * W + x])) {
        rebakeTile(world, x, y);
        flushed++;
      }
    }
  }
  return flushed;
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

// ---------------------------------------------------------------------------
// RenderTile contract (COA-2 task #16).
//
// The renderer needs a flat read-only view of a tile that combines base +
// point + edges + building + elevation. getRenderTile is the single entry
// point — renderers must never read raw grids directly; any grid layout
// change should be fully absorbed here.

export type RenderTileEdge = {
  readonly kind: LinearBarrierKind | null;
  readonly damaged: boolean;
  readonly doorOpen: boolean;
  readonly windowIntact: boolean;
  readonly windowBroken: boolean;
};

export type RenderTile = {
  readonly x: number;
  readonly y: number;
  readonly base: TerrainBase;
  readonly point: PointObjectKind | null;
  readonly pointDamaged: boolean;
  readonly buildingId: number;
  readonly building: BuildingRecord | null;
  readonly elevationStep: number;
  readonly elevationMeters: number;
  readonly structureHeightMeters: number;
  readonly edgeN: RenderTileEdge;
  readonly edgeW: RenderTileEdge;
  readonly walkability: number; // raw Uint16 bitmask
  readonly coverProfile: number; // raw Uint8 pre-baked byte
  readonly strongestAxes: CoverAxes;
};

function readEdge(byte: number, overrideByte: number): RenderTileEdge {
  const kind = barrierKindOf(byte);
  const damaged = barrierIsDamaged(byte);
  return {
    kind,
    damaged,
    doorOpen: overrideByte === EDGE_OVERRIDE_DOOR_OPEN,
    windowIntact: overrideByte === EDGE_OVERRIDE_WINDOW_INTACT,
    windowBroken: overrideByte === EDGE_OVERRIDE_WINDOW_BROKEN,
  };
}

export function getRenderTile(world: World, x: number, y: number): RenderTile | null {
  if (!inBounds(world, x, y)) return null;
  const idx = tileIndex(world, x, y);
  const base = byteToBase(world.base[idx]);
  const point = byteToPoint(world.point[idx]);
  const pointDamaged = point ? pointStateAt(world, x, y) === 'damaged' : false;
  const bId = world.buildingId[idx];
  const building = bId !== 0 ? world.buildings.find((b) => b.id === bId) ?? null : null;
  const step = world.elevationStep[idx];
  const baseAxes = BASE_AXES[base];
  const pAxes = pointAxesAt(world, x, y);
  const strongest = pAxes ? stronger(baseAxes, pAxes) : baseAxes;

  return {
    x,
    y,
    base,
    point,
    pointDamaged,
    buildingId: bId,
    building,
    elevationStep: step,
    elevationMeters: elevationMeters(step),
    structureHeightMeters: world.structureHeight[idx],
    edgeN: readEdge(world.edgeN[idx], world.edgeOverrideN[idx]),
    edgeW: readEdge(world.edgeW[idx], world.edgeOverrideW[idx]),
    walkability: world.walkability[idx],
    coverProfile: world.coverProfile[idx],
    strongestAxes: strongest,
  };
}
