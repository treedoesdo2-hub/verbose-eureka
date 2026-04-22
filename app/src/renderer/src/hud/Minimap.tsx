import type { SnapshotUnit, WorldSnapshot } from '@shared/snapshot';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { computeMinimapProjection, projectUnit, unprojectPoint } from './minimap-math';

const TERRAIN_COLORS: Record<number, string> = {
  0: '#1a2b1a',
  1: '#3a342b',
  2: '#4a3e2f',
  3: '#1b3a1f',
  4: '#193352',
  5: '#342c26',
};

const TEAM_COLORS: Record<number, string> = {
  0: '#55aaff',
  1: '#ff5a4a',
};

type Props = {
  world: WorldSnapshot;
  units: readonly SnapshotUnit[];
  selectedUnitId?: number | null;
  onSelectUnit?: (id: number | null) => void;
  sizePx?: number;
};

function MinimapImpl({
  world,
  units,
  selectedUnitId = null,
  onSelectUnit,
  sizePx = 160,
}: Props): React.JSX.Element {
  const terrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const unitsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const proj = useMemo(() => computeMinimapProjection(world, sizePx), [world, sizePx]);

  useEffect(() => {
    const c = terrainCanvasRef.current;
    if (!c) return;
    c.width = sizePx;
    c.height = sizePx;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(0, 0, sizePx, sizePx);
    // Draw terrain as rectangles scaled into the minimap.
    const tile = proj.scale * world.tileSizeMeters;
    for (let ty = 0; ty < world.height; ty++) {
      for (let tx = 0; tx < world.width; tx++) {
        const idx = ty * world.width + tx;
        const t = world.terrain[idx] ?? 0;
        ctx.fillStyle = TERRAIN_COLORS[t] ?? '#1a2b1a';
        ctx.fillRect(
          proj.offsetX + tx * world.tileSizeMeters * proj.scale,
          proj.offsetY + ty * world.tileSizeMeters * proj.scale,
          Math.max(1, tile),
          Math.max(1, tile),
        );
      }
    }
  }, [world, proj, sizePx]);

  useEffect(() => {
    const c = unitsCanvasRef.current;
    if (!c) return;
    c.width = sizePx;
    c.height = sizePx;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, sizePx, sizePx);
    for (const u of units) {
      const { px, py } = projectUnit(u, proj);
      const dead = u.actionKind === 'dead';
      const downed = u.actionKind === 'downed';
      ctx.fillStyle = dead ? '#555555' : downed ? '#884444' : (TEAM_COLORS[u.teamId] ?? '#ffffff');
      ctx.globalAlpha = dead ? 0.4 : downed ? 0.7 : 1;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
      if (u.id === selectedUnitId) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }, [units, proj, sizePx, selectedUnitId]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onSelectUnit) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const world = unprojectPoint(cx, cy, proj);
      if (!world) {
        onSelectUnit(null);
        return;
      }
      let nearestId: number | null = null;
      let nearestDistSq = 3 * 3; // 3 world meters selection radius
      for (const u of units) {
        if (u.actionKind === 'dead') continue;
        const dx = u.x - world.wx;
        const dy = u.y - world.wy;
        const d2 = dx * dx + dy * dy;
        if (d2 < nearestDistSq) {
          nearestDistSq = d2;
          nearestId = u.id;
        }
      }
      onSelectUnit(nearestId);
    },
    [onSelectUnit, proj, units],
  );

  return (
    <div
      className="hud-panel hud-minimap"
      style={{ width: sizePx, height: sizePx, position: 'relative' }}
    >
      <canvas ref={terrainCanvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      <canvas
        ref={unitsCanvasRef}
        onClick={handleClick}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
    </div>
  );
}

export const Minimap = React.memo(MinimapImpl);
