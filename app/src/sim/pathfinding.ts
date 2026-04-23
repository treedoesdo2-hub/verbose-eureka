import type { Vec2 } from './unit';
import {
  type MovementMode,
  WALK_FOOT,
  elevationMeters,
  inBounds,
  terrainAxesAt,
  walkBitFor,
  type World,
} from './world';

// Pillar A pathfinding. 8-connected A* with Chebyshev heuristic on the
// walkability grid (or terrain.axes.move fallback on authored maps).
// Range-limited so generated 4096² maps don't explode the open set.
//
// Determinism: no RNG. Given identical (world.walkability, world.base, from,
// to), identical path out. Tie-break uses the deterministic insertion order
// of the binary heap (stable for equal f-scores via insertion ordinal).

const MAX_NODES_EXPANDED = 4000;

// Slope cost (COA-8). P3.12 — no charge for 1-step; each additional step
// adds +0.5 to base cost. This lets minor undulations pass-through freely
// while steeper slopes still bias pathing.
const SLOPE_COST_PER_STEP = 0.5;
// Cliff guard — per movement mode. P3.12: wheeled vehicles can't cross a
// single-step elevation delta > 1 (steep for a car). Tracked vehicles
// tolerate up to 3 (tanks climb). Infantry / mechs / PA: 2 (standard).
const MAX_STEP_ELEV_BY_MODE: Record<MovementMode, number> = {
  foot: 2,
  prone: 2,
  mech: 2,
  power_armor: 2,
  wheeled: 1,
  tracked: 3,
};

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy);
}

export function isPassableForUnit(
  world: World,
  x: number,
  y: number,
  mode: MovementMode,
): boolean {
  if (!inBounds(world, x, y)) return false;
  const bit = walkBitFor(mode);
  if (world.walkability && world.walkability.length > 0) {
    return (world.walkability[y * world.width + x] & bit) !== 0;
  }
  // Fallback for authored-only maps or untested fixtures — use the base
  // axis move effect.
  const axes = terrainAxesAt(world, x, y);
  if (axes.move === 'blocked-all') return false;
  if (axes.move === 'blocked-vehicle') {
    return mode === 'foot' || mode === 'prone' || mode === 'mech' || mode === 'power_armor';
  }
  if (axes.move === 'blocked-foot') return mode === 'mech' || mode === 'power_armor';
  return true;
}

export function tileMoveSpeedMult(world: World, x: number, y: number): number {
  if (!inBounds(world, x, y)) return 1.0;
  return terrainAxesAt(world, x, y).moveSpeedMult || 1.0;
}

function isPassableTile(world: World, x: number, y: number): boolean {
  return isPassableForUnit(world, x, y, 'foot');
}

// Diagonal movement is disallowed when it would cut the corner of an
// impassable cell (standard grid A* rule — otherwise units squeeze through
// 1-tile gaps between walls). Also enforces the cliff guard per COA-8.
function canStep(
  world: World,
  fx: number,
  fy: number,
  tx: number,
  ty: number,
  mode: MovementMode,
): boolean {
  if (!isPassableForUnit(world, tx, ty, mode)) return false;

  // Cliff guard — per-mode. P3.12 replaces the old scalar MAX with
  // MAX_STEP_ELEV_BY_MODE so tracked vehicles climb further than wheeled.
  if (inBounds(world, fx, fy)) {
    const dElev = Math.abs(
      world.elevationStep[ty * world.width + tx] - world.elevationStep[fy * world.width + fx],
    );
    if (dElev > MAX_STEP_ELEV_BY_MODE[mode]) return false;
  }

  const isDiagonal = fx !== tx && fy !== ty;
  if (!isDiagonal) return true;
  return (
    isPassableForUnit(world, tx, fy, mode) && isPassableForUnit(world, fx, ty, mode)
  );
}

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

export type FindPathOptions = {
  readonly maxNodes?: number;
  readonly partial?: boolean;
  readonly mode?: MovementMode;
};

export function findPathTiles(
  world: World,
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  options: FindPathOptions = {},
): readonly { x: number; y: number }[] {
  const maxNodes = options.maxNodes ?? MAX_NODES_EXPANDED;
  const partial = options.partial ?? true;
  const mode: MovementMode = options.mode ?? 'foot';

  if (startX === goalX && startY === goalY) return [];
  if (!isPassableForUnit(world, goalX, goalY, mode) && !partial) return [];

  const W = world.width;
  const H = world.height;
  const N = W * H;
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
        if (!canStep(world, cx, cy, nx, ny, mode)) continue;
        const nIdx = ny * W + nx;
        if (closed[nIdx]) continue;
        // Base step cost: 1 for cardinal, sqrt(2) for diagonal.
        let stepCost = dx !== 0 && dy !== 0 ? 1.41421356 : 1;
        // Slope cost (COA-8 / P3.12). 1-step delta is free; each
        // additional step adds +0.5 multiplier.
        const dElev = Math.abs(
          world.elevationStep[nIdx] - world.elevationStep[currentIdx],
        );
        stepCost *= 1 + Math.max(0, dElev - 1) * SLOPE_COST_PER_STEP;
        // Terrain speed modifier — slow tiles cost more to traverse.
        const speedMult = tileMoveSpeedMult(world, nx, ny);
        if (speedMult > 0 && speedMult < 1) stepCost *= 1 / speedMult;
        const tentativeG = gScore[currentIdx] + stepCost;
        if (tentativeG >= gScore[nIdx]) continue;
        gScore[nIdx] = tentativeG;
        cameFrom[nIdx] = currentIdx;
        const f = tentativeG + heuristic(nx, ny, goalX, goalY);
        open.push(nIdx, f);
      }
    }
  }

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
    reverse.push({ x: (x + 0.5) * ts, y: (y + 0.5) * ts });
    cur = cameFrom[cur];
  }
  reverse.reverse();
  return reverse;
}

export function findPathMeters(
  world: World,
  from: Vec2,
  to: Vec2,
  options: FindPathOptions = {},
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
    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) > 1e-6) out.push(cur);
  }
  out.push(path[path.length - 1]);
  return out;
}

// Lint appeasement — elevationMeters + WALK_FOOT kept as module-level
// imports in case callers later want them for step-cost override plumbing.
void elevationMeters;
void WALK_FOOT;
