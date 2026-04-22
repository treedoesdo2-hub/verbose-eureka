import type { Vec2 } from './unit';
import { inBounds, terrainAt, type World } from './world';

// Pillar A pathfinding. 8-connected A* with Chebyshev heuristic on the
// walkability grid (or terrain.passable fallback on authored maps).
// Range-limited so generated 4096² maps don't explode the open set.
//
// Determinism: no RNG. Given identical (world.walkability, world.terrain,
// from, to), identical path out. Tie-break uses the deterministic insertion
// order of the binary heap (stable for equal f-scores via insertion ordinal).

const WALK_FOOT = 1 << 0;

// Max nodes expanded per search. On a 512² map in practice A* touches
// a few hundred to a few thousand nodes for realistic squad movement.
// Cap prevents pathological pathological pathfinding on fully blocked maps
// from stalling a tick.
const MAX_NODES_EXPANDED = 4000;

// Chebyshev distance (max of |dx|, |dy|) matches 8-connected movement cost
// at uniform tile cost. Admissible and consistent — guarantees optimality.
function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy);
}

function isPassableTile(world: World, x: number, y: number): boolean {
  if (!inBounds(world, x, y)) return false;
  if (world.walkability) {
    return (world.walkability[y * world.width + x] & WALK_FOOT) !== 0;
  }
  return terrainAt(world, x, y).passable;
}

// Diagonal movement is disallowed when it would cut the corner of an
// impassable cell (standard grid A* rule — otherwise units squeeze through
// 1-tile gaps between walls).
function canStep(world: World, fx: number, fy: number, tx: number, ty: number): boolean {
  if (!isPassableTile(world, tx, ty)) return false;
  const isDiagonal = fx !== tx && fy !== ty;
  if (!isDiagonal) return true;
  return isPassableTile(world, tx, fy) && isPassableTile(world, fx, ty);
}

// Simple binary min-heap keyed on fScore. The ordinal breaks ties so two
// nodes with identical f land in deterministic order.
class MinHeap {
  private nodes: { idx: number; f: number; ordinal: number }[] = [];
  private counter = 0;

  push(idx: number, f: number): void {
    const ord = this.counter++;
    this.nodes.push({ idx, f, ordinal: ord });
    this.bubbleUp(this.nodes.length - 1);
  }

  pop(): number | null {
    if (this.nodes.length === 0) return null;
    const top = this.nodes[0];
    const last = this.nodes.pop();
    if (!last) return top.idx;
    if (this.nodes.length > 0) {
      this.nodes[0] = last;
      this.sinkDown(0);
    }
    return top.idx;
  }

  get size(): number {
    return this.nodes.length;
  }

  private less(a: { f: number; ordinal: number }, b: { f: number; ordinal: number }): boolean {
    if (a.f !== b.f) return a.f < b.f;
    return a.ordinal < b.ordinal;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(this.nodes[i], this.nodes[parent])) return;
      [this.nodes[i], this.nodes[parent]] = [this.nodes[parent], this.nodes[i]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.nodes.length;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < n && this.less(this.nodes[l], this.nodes[smallest])) smallest = l;
      if (r < n && this.less(this.nodes[r], this.nodes[smallest])) smallest = r;
      if (smallest === i) return;
      [this.nodes[i], this.nodes[smallest]] = [this.nodes[smallest], this.nodes[i]];
      i = smallest;
    }
  }
}

// Find a path from start to goal tiles (not meters). Returns a list of
// tile-center Vec2s in meters, excluding the start tile, ending at the
// goal (or the nearest reachable tile if goal is unreachable and `partial`).
// Returns [] when no route exists and partial is false.
export function findPathTiles(
  world: World,
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  options: { maxNodes?: number; partial?: boolean } = {},
): readonly { x: number; y: number }[] {
  const maxNodes = options.maxNodes ?? MAX_NODES_EXPANDED;
  const partial = options.partial ?? true;

  if (startX === goalX && startY === goalY) return [];
  if (!isPassableTile(world, startX, startY)) {
    // Start tile itself is impassable (unit standing on rubble that just
    // rolled in, say). Treat start as passable — the unit is already there.
  }
  if (!isPassableTile(world, goalX, goalY) && !partial) return [];

  const W = world.width;
  const H = world.height;
  const N = W * H;
  // Dense arrays keep the hot path numeric; N=256² is 65k, 512² is 262k,
  // 1024² is 1M. At 1024+ consider sparse maps instead.
  const gScore = new Float32Array(N);
  const cameFrom = new Int32Array(N);
  const closed = new Uint8Array(N);
  gScore.fill(Number.POSITIVE_INFINITY);
  cameFrom.fill(-1);

  const startIdx = startY * W + startX;
  const goalIdx = goalY * W + goalX;
  gScore[startIdx] = 0;

  const open = new MinHeap();
  open.push(startIdx, heuristic(startX, startY, goalX, goalY));

  let bestReached = startIdx;
  let bestReachedH = heuristic(startX, startY, goalX, goalY);
  let expanded = 0;

  while (open.size > 0 && expanded < maxNodes) {
    const currentIdx = open.pop();
    if (currentIdx === null) break;
    if (closed[currentIdx]) continue;
    closed[currentIdx] = 1;
    expanded++;

    if (currentIdx === goalIdx) {
      return reconstruct(cameFrom, currentIdx, startIdx, world);
    }

    const cx = currentIdx % W;
    const cy = (currentIdx - cx) / W;
    const hRemaining = heuristic(cx, cy, goalX, goalY);
    if (hRemaining < bestReachedH) {
      bestReachedH = hRemaining;
      bestReached = currentIdx;
    }

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (!canStep(world, cx, cy, nx, ny)) continue;
        const nIdx = ny * W + nx;
        if (closed[nIdx]) continue;
        // Diagonal step costs sqrt(2) ≈ 1.4142; cardinal 1. This keeps
        // paths tight against walls instead of zig-zagging.
        const stepCost = dx !== 0 && dy !== 0 ? 1.41421356 : 1;
        const tentativeG = gScore[currentIdx] + stepCost;
        if (tentativeG >= gScore[nIdx]) continue;
        gScore[nIdx] = tentativeG;
        cameFrom[nIdx] = currentIdx;
        const f = tentativeG + heuristic(nx, ny, goalX, goalY);
        open.push(nIdx, f);
      }
    }
  }

  // Goal unreachable (or budget blown). Return the closest-approached
  // tile's path if partial is allowed; otherwise empty.
  if (partial && bestReached !== startIdx) {
    return reconstruct(cameFrom, bestReached, startIdx, world);
  }
  return [];
}

function reconstruct(
  cameFrom: Int32Array,
  endIdx: number,
  startIdx: number,
  world: World,
): { x: number; y: number }[] {
  const W = world.width;
  const ts = world.tileSizeMeters;
  const reverse: { x: number; y: number }[] = [];
  let cur = endIdx;
  while (cur !== -1 && cur !== startIdx) {
    const x = cur % W;
    const y = (cur - x) / W;
    // Tile-center in meters — the +0.5 offset puts the waypoint in the
    // middle of the tile so the unit doesn't try to hug the exact corner.
    reverse.push({ x: (x + 0.5) * ts, y: (y + 0.5) * ts });
    cur = cameFrom[cur];
  }
  reverse.reverse();
  return reverse;
}

// Public helper: pathfind from meters to meters. Converts to tile coords,
// runs A*, returns a list of waypoints in meters. Empty list means no
// route — caller should fall back to straight-line steering.
export function findPathMeters(
  world: World,
  from: Vec2,
  to: Vec2,
  options: { maxNodes?: number; partial?: boolean } = {},
): readonly Vec2[] {
  const sx = Math.floor(from.x / world.tileSizeMeters);
  const sy = Math.floor(from.y / world.tileSizeMeters);
  const gx = Math.floor(to.x / world.tileSizeMeters);
  const gy = Math.floor(to.y / world.tileSizeMeters);
  const tilePath = findPathTiles(world, sx, sy, gx, gy, options);
  return tilePath;
}

// Bresenham-style walkability raycast. Returns true when every tile between
// (and including) the two meter-space points is passable. Cheap enough to
// use per-unit per-tick as a "do I need to pathfind?" precheck — followers
// in open terrain skip the A* call and just steer straight at the leader.
export function hasLineOfWalk(world: World, from: Vec2, to: Vec2): boolean {
  const ts = world.tileSizeMeters;
  let x0 = Math.floor(from.x / ts);
  let y0 = Math.floor(from.y / ts);
  const x1 = Math.floor(to.x / ts);
  const y1 = Math.floor(to.y / ts);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  // Cap iterations so a pathological input can't hang the tick.
  const maxSteps = dx + dy + 1;
  let steps = 0;
  while (steps++ < maxSteps) {
    if (!isPassableTile(world, x0, y0)) return false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return true;
}

// Simplify a path by removing collinear intermediate waypoints. Cuts the
// waypoint count roughly in half for straight corridors and makes the
// unit's movement visually smoother (fewer micro-corrections).
export function simplifyPath(path: readonly Vec2[]): Vec2[] {
  if (path.length <= 2) return [...path];
  const out: Vec2[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = path[i];
    const next = path[i + 1];
    const dx1 = cur.x - prev.x;
    const dy1 = cur.y - prev.y;
    const dx2 = next.x - cur.x;
    const dy2 = next.y - cur.y;
    // Cross product — zero means collinear, drop cur.
    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) > 1e-6) out.push(cur);
  }
  out.push(path[path.length - 1]);
  return out;
}
