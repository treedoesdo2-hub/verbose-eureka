import type { TerrainKind } from '@schema/map';

export const TERRAIN_KINDS: readonly TerrainKind[] = [
  'open',
  'road',
  'building',
  'forest',
  'water',
  'rubble',
];

export type TerrainProps = {
  kind: TerrainKind;
  fullOcclusionHeight: number;
  concealmentHeight: number;
  coverValue: number;
  passable: boolean;
  movementCost: number;
};

const OPEN: TerrainProps = {
  kind: 'open',
  fullOcclusionHeight: 0,
  concealmentHeight: 0,
  coverValue: 0,
  passable: true,
  movementCost: 1,
};

const ROAD: TerrainProps = {
  kind: 'road',
  fullOcclusionHeight: 0,
  concealmentHeight: 0,
  coverValue: 0,
  passable: true,
  movementCost: 0.8,
};

const BUILDING: TerrainProps = {
  kind: 'building',
  fullOcclusionHeight: 3,
  concealmentHeight: 3,
  coverValue: 70,
  passable: false,
  movementCost: Number.POSITIVE_INFINITY,
};

const FOREST: TerrainProps = {
  kind: 'forest',
  fullOcclusionHeight: 0,
  concealmentHeight: 2,
  coverValue: 30,
  passable: true,
  movementCost: 1.4,
};

const WATER: TerrainProps = {
  kind: 'water',
  fullOcclusionHeight: 0,
  concealmentHeight: 0,
  coverValue: 0,
  passable: false,
  movementCost: Number.POSITIVE_INFINITY,
};

const RUBBLE: TerrainProps = {
  kind: 'rubble',
  fullOcclusionHeight: 0,
  concealmentHeight: 1,
  coverValue: 20,
  passable: true,
  movementCost: 1.5,
};

export const TERRAIN: Record<TerrainKind, TerrainProps> = {
  open: OPEN,
  road: ROAD,
  building: BUILDING,
  forest: FOREST,
  water: WATER,
  rubble: RUBBLE,
};

const TERRAIN_INDEX: TerrainKind[] = [...TERRAIN_KINDS];
const TERRAIN_TO_INDEX = new Map<TerrainKind, number>(TERRAIN_KINDS.map((k, i) => [k, i]));

export function terrainToByte(k: TerrainKind): number {
  const idx = TERRAIN_TO_INDEX.get(k);
  if (idx === undefined) throw new Error(`unknown terrain: ${k}`);
  return idx;
}

export function byteToTerrain(b: number): TerrainKind {
  const k = TERRAIN_INDEX[b];
  if (!k) throw new Error(`invalid terrain byte: ${b}`);
  return k;
}

export type World = {
  readonly width: number;
  readonly height: number;
  readonly tileSizeMeters: number;
  readonly terrain: Uint8Array;
  readonly groundHeight: Float32Array;
  // Pillar A pathfinding — bit 0 is WALK_FOOT. Null on authored maps (the
  // pathfinder falls back to terrainAt().passable when null). Populated
  // from MapGenResult.walkability on procedurally-generated maps.
  readonly walkability: Uint8Array | null;
};

export function makeWorld(
  width: number,
  height: number,
  tileSizeMeters: number,
  fill: TerrainKind = 'open',
): World {
  const terrain = new Uint8Array(width * height);
  terrain.fill(terrainToByte(fill));
  const groundHeight = new Float32Array(width * height);
  return { width, height, tileSizeMeters, terrain, groundHeight, walkability: null };
}

// Build a World from a mapgen pipeline result — consumes the pre-baked
// Uint8Array terrain without per-tile iteration.
export function makeWorldFromBuffers(
  width: number,
  height: number,
  tileSizeMeters: number,
  terrain: Uint8Array,
  walkability: Uint8Array | null = null,
): World {
  const groundHeight = new Float32Array(width * height);
  return { width, height, tileSizeMeters, terrain, groundHeight, walkability };
}

export function tileIndex(world: World, x: number, y: number): number {
  return y * world.width + x;
}

export function inBounds(world: World, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < world.width && y < world.height;
}

export function terrainAt(world: World, x: number, y: number): TerrainProps {
  return TERRAIN[byteToTerrain(world.terrain[tileIndex(world, x, y)])];
}

export function setTerrain(world: World, x: number, y: number, k: TerrainKind): void {
  world.terrain[tileIndex(world, x, y)] = terrainToByte(k);
}
