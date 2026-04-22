import type { WorldSnapshot } from '@shared/snapshot';
import type { MinimapProjection } from './hud-types';

export function computeMinimapProjection(
  world: WorldSnapshot,
  targetPx: number,
): MinimapProjection {
  const worldW = world.width * world.tileSizeMeters;
  const worldH = world.height * world.tileSizeMeters;
  if (worldW <= 0 || worldH <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0, width: targetPx, height: targetPx };
  }
  const scale = Math.min(targetPx / worldW, targetPx / worldH);
  const width = worldW * scale;
  const height = worldH * scale;
  const offsetX = (targetPx - width) / 2;
  const offsetY = (targetPx - height) / 2;
  return { scale, offsetX, offsetY, width, height };
}

export function projectUnit(
  u: { readonly x: number; readonly y: number },
  proj: MinimapProjection,
): { px: number; py: number } {
  return {
    px: proj.offsetX + u.x * proj.scale,
    py: proj.offsetY + u.y * proj.scale,
  };
}

export function unprojectPoint(
  canvasX: number,
  canvasY: number,
  proj: MinimapProjection,
): { wx: number; wy: number } | null {
  if (proj.scale <= 0) return null;
  const wx = (canvasX - proj.offsetX) / proj.scale;
  const wy = (canvasY - proj.offsetY) / proj.scale;
  return { wx, wy };
}

export function terrainIndex(world: WorldSnapshot, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return 0;
  return world.base[ty * world.width + tx] ?? 0;
}
