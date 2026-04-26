// COA-4 tasks #85-#89 — linear barrier stamping + damage state machine.
//
// Dominant lines of kind `hedgerow-spine` + landmark borders call into
// stampBarrierLine to write LinearBarrierKind bytes into edgeN / edgeW
// along an authored route. Damage mutators live in world.ts
// (applyBarrierDamage) since they mutate the World struct directly.
// This file owns the pure data (per-kind props, HP base tables) and
// the line rasterization + pipeline-level stampers.

import type { LinearBarrierKind } from '@schema/map';
import {
  BARRIER_MAX_HP,
  encodeBarrier,
  type World,
} from '../world';

export type BarrierProps = {
  readonly kind: LinearBarrierKind;
  // Visual weight at render scale: thin = 1 tile edge, thick = 2-tile
  // dilation perpendicular to the line (bocage). Used by stampBarrierLine
  // to decide whether to stamp a neighbor tile's edge too.
  readonly thick: boolean;
  // Soldier ease of crossing. Foot = can always step over it (maybe slowed).
  // Mech = mechs and up can plow through intact instances (tank_trap style).
  readonly crossingMode: 'foot' | 'mech' | 'vehicle-blocked-intact';
};

export const BARRIER_PROPS: Record<LinearBarrierKind, BarrierProps> = {
  hedge: { kind: 'hedge', thick: false, crossingMode: 'foot' },
  bocage: { kind: 'bocage', thick: true, crossingMode: 'foot' },
  stone_wall_low: { kind: 'stone_wall_low', thick: false, crossingMode: 'foot' },
  wood_fence: { kind: 'wood_fence', thick: false, crossingMode: 'foot' },
  bamboo_fence: { kind: 'bamboo_fence', thick: false, crossingMode: 'foot' },
  rail_fence: { kind: 'rail_fence', thick: false, crossingMode: 'foot' },
  berm: { kind: 'berm', thick: true, crossingMode: 'foot' },
  wire_light: { kind: 'wire_light', thick: false, crossingMode: 'foot' },
  wire_dense: { kind: 'wire_dense', thick: false, crossingMode: 'foot' },
  wire_razor: { kind: 'wire_razor', thick: false, crossingMode: 'foot' },
  rubble_strip: { kind: 'rubble_strip', thick: false, crossingMode: 'foot' },
};

// Hedgerow walker (#86) — writes barriers along a path of tile waypoints.
// Chooses which side (N or W) to stamp based on segment direction so the
// barrier lives on the downslope of a hedgerow run.
export function stampBarrierLine(
  world: World,
  waypoints: readonly { x: number; y: number }[],
  kind: LinearBarrierKind,
): number {
  if (waypoints.length < 2) return 0;
  let stamped = 0;
  const maxHp = BARRIER_MAX_HP[kind] ?? 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const steps = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(a.x + dx * t);
      const y = Math.round(a.y + dy * t);
      if (x < 0 || y < 0 || x >= world.width || y >= world.height) continue;
      // Pick side from primary movement direction: horizontal → N edge
      // (stamps the top of the tile), vertical → W edge.
      const side = Math.abs(dx) >= Math.abs(dy) ? 'N' : 'W';
      const idx = y * world.width + x;
      const byte = encodeBarrier(kind, false);
      if (side === 'N') {
        world.edgeN[idx] = byte;
        world.hpN[idx] = maxHp;
      } else {
        world.edgeW[idx] = byte;
        world.hpW[idx] = maxHp;
      }
      stamped++;
    }
  }
  return stamped;
}

// #89 — Rebuild walkability for all barrier-carrying tiles. Called after
// stampBarrierLine to propagate new barrier bytes into the walkability
// mask. Thin wrapper; the actual per-tile rebake logic lives in world.ts
// (markTileDirty + flushDirtyTiles), so we just mark everything touched.
import { flushDirtyTiles, markTileDirty } from '../world';

export function rebakeBarrierTiles(
  world: World,
  waypoints: readonly { x: number; y: number }[],
): number {
  for (const p of waypoints) markTileDirty(world, p.x, p.y);
  return flushDirtyTiles(world);
}
