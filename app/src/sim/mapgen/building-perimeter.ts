// Building perimeter stamper (#275 / ADR 017 increment 1).
//
// Walks each procedurally-generated BuildingRecord's footprint, finds
// every external edge (an edge between a building tile and a non-
// building tile of the same building), and stamps stone_wall_low onto
// it. One edge per building is picked as the doorway (closed-door
// override); 0-2 additional perimeter edges become window apertures.
//
// External edges are derived from buildingId by walking each footprint
// tile and checking its 4 neighbors against the building's id. This
// way, two adjacent buildings (different ids) get walls between them
// rather than melting into one big rectangle.
//
// Combined with the #276 edge-blocker gate in pathfinding + tick, this
// turns procedural buildings into structures with a real doorway choke
// instead of a one-bit "inside" flag that infantry can step through.

import type { BuildingRecord } from '../world';
import {
  BARRIER_KINDS,
  BARRIER_MAX_HP,
  EDGE_OVERRIDE_DOOR_CLOSED,
  EDGE_OVERRIDE_WINDOW_INTACT,
} from '../world';
import { makeRng } from './noise';

const STONE_WALL_KIND_IDX = BARRIER_KINDS.indexOf('stone_wall_low') + 1;
const STONE_WALL_BYTE = STONE_WALL_KIND_IDX & 0x0f;
const STONE_WALL_HP = BARRIER_MAX_HP.stone_wall_low ?? 80;

export type PerimeterInput = {
  readonly W: number;
  readonly H: number;
  readonly buildings: readonly BuildingRecord[];
  readonly buildingId: Uint16Array;
  readonly edgeN: Uint8Array;
  readonly edgeW: Uint8Array;
  readonly hpN: Uint16Array;
  readonly hpW: Uint16Array;
  readonly edgeOverrideN: Uint8Array;
  readonly edgeOverrideW: Uint8Array;
  readonly seed: number;
};

// One edge of a tile, expressed as (tile-index, side). For 'N' the edge
// belongs to (x, y); for 'W' the same. 'S' and 'E' redirect — see
// world.ts:getEdge — so we normalize to N + W during enumeration.
type PerimeterEdge = {
  readonly side: 'N' | 'W';
  readonly tileIdx: number;
};

export function stampBuildingPerimeter(input: PerimeterInput): void {
  const { W, H, buildings, buildingId, edgeN, edgeW, hpN, hpW,
    edgeOverrideN, edgeOverrideW, seed } = input;
  const rng = makeRng(seed ^ 0xb0c89e);

  for (const b of buildings) {
    // Collect every external edge for this building. An edge is external
    // when the tile on the OTHER side of it isn't part of this same
    // building (different building id, off-map, or empty).
    const edges: PerimeterEdge[] = [];
    for (const t of b.footprintTiles) {
      const i = t.y * W + t.x;
      // Sanity: footprint claims ownership; if buildingId doesn't agree
      // (e.g. road network bulldozed it post-scatter), skip — the
      // building has been carved out and shouldn't get a perimeter that
      // floats on cleared tiles.
      if (buildingId[i] !== b.id) continue;
      // North edge — neighbor is (x, y-1).
      if (t.y === 0 || buildingId[(t.y - 1) * W + t.x] !== b.id) {
        edges.push({ side: 'N', tileIdx: i });
      }
      // West edge — neighbor is (x-1, y).
      if (t.x === 0 || buildingId[t.y * W + (t.x - 1)] !== b.id) {
        edges.push({ side: 'W', tileIdx: i });
      }
      // South edge of (x, y) is the N edge of (x, y+1) — own that one
      // when neighbor isn't us.
      if (t.y < H - 1 && buildingId[(t.y + 1) * W + t.x] !== b.id) {
        edges.push({ side: 'N', tileIdx: (t.y + 1) * W + t.x });
      }
      // East edge of (x, y) is the W edge of (x+1, y).
      if (t.x < W - 1 && buildingId[t.y * W + (t.x + 1)] !== b.id) {
        edges.push({ side: 'W', tileIdx: t.y * W + (t.x + 1) });
      }
    }
    if (edges.length === 0) continue;

    // Stamp stone_wall_low on every perimeter edge first.
    for (const e of edges) {
      if (e.side === 'N') {
        edgeN[e.tileIdx] = STONE_WALL_BYTE;
        hpN[e.tileIdx] = STONE_WALL_HP;
      } else {
        edgeW[e.tileIdx] = STONE_WALL_BYTE;
        hpW[e.tileIdx] = STONE_WALL_HP;
      }
    }

    // Pick one edge for the doorway. EDGE_OVERRIDE_DOOR_CLOSED takes
    // priority over the wall byte at the gate-check level, so the door
    // is the only foot-passable perimeter slot.
    const doorIdx = Math.floor(rng() * edges.length);
    const door = edges[doorIdx];
    if (door.side === 'N') {
      edgeOverrideN[door.tileIdx] = EDGE_OVERRIDE_DOOR_CLOSED;
    } else {
      edgeOverrideW[door.tileIdx] = EDGE_OVERRIDE_DOOR_CLOSED;
    }

    // 0-2 windows on the remaining perimeter edges. Buildings smaller
    // than 4 tiles get 0; 4-8 tiles get 1; 9+ get 2.
    const windowCount = b.footprintTiles.length >= 9 ? 2 : b.footprintTiles.length >= 4 ? 1 : 0;
    const remaining = edges.filter((_, k) => k !== doorIdx);
    for (let w = 0; w < windowCount && remaining.length > 0; w += 1) {
      const pickIdx = Math.floor(rng() * remaining.length);
      const win = remaining.splice(pickIdx, 1)[0];
      if (win.side === 'N') {
        edgeOverrideN[win.tileIdx] = EDGE_OVERRIDE_WINDOW_INTACT;
      } else {
        edgeOverrideW[win.tileIdx] = EDGE_OVERRIDE_WINDOW_INTACT;
      }
    }
  }
}
