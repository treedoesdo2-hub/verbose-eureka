import type { SimSnapshot, SnapshotUnit, WorldSnapshot } from '@shared/snapshot';
import { Application, Container, Graphics } from 'pixi.js';
import { useEffect, useRef } from 'react';

const TERRAIN_COLORS: Record<number, number> = {
  0: 0x1a2b1a, // open
  1: 0x3a342b, // road
  2: 0x4a3e2f, // building
  3: 0x1b3a1f, // forest
  4: 0x193352, // water
  5: 0x342c26, // rubble
};

const TEAM_COLORS: Record<number, number> = {
  0: 0x55aaff,
  1: 0xff5a4a,
};

type Props = {
  world: WorldSnapshot;
  snapshot: SimSnapshot | null;
};

type Scene = {
  app: Application;
  worldLayer: Container;
  terrainLayer: Graphics;
  visionLayer: Container;
  unitsLayer: Container;
  fxLayer: Container;
};

export function CombatView({ world, snapshot }: Props): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const host = containerRef.current;
    let destroyed = false;

    const app = new Application();

    app
      .init({
        background: 0x0b0d10,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
      })
      .then(() => {
        if (destroyed) {
          app.destroy(true);
          return;
        }
        host.innerHTML = '';
        host.appendChild(app.canvas);
        app.canvas.style.display = 'block';
        app.canvas.style.width = '100%';
        app.canvas.style.height = '100%';

        const worldLayer = new Container();
        const terrainLayer = new Graphics();
        const visionLayer = new Container();
        const unitsLayer = new Container();
        const fxLayer = new Container();
        worldLayer.addChild(terrainLayer);
        worldLayer.addChild(visionLayer);
        worldLayer.addChild(unitsLayer);
        worldLayer.addChild(fxLayer);
        app.stage.addChild(worldLayer);

        sceneRef.current = {
          app,
          worldLayer,
          terrainLayer,
          visionLayer,
          unitsLayer,
          fxLayer,
        };

        relayout();
        drawTerrain(terrainLayer, world);
      })
      .catch((err) => {
        console.error('[CombatView] Pixi init failed:', err);
        host.innerHTML = `<div style="color:#d9534f;padding:20px;font-family:monospace">Pixi init failed: ${String(err)}</div>`;
      });

    function relayout(): void {
      const scene = sceneRef.current;
      if (!scene) return;
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      scene.app.renderer.resize(w, h);
      const scale = computeScale(world, w, h);
      const worldW = world.width * world.tileSizeMeters;
      const worldH = world.height * world.tileSizeMeters;
      const offsetX = (w - worldW * scale) / 2;
      const offsetY = (h - worldH * scale) / 2;
      scene.worldLayer.position.set(offsetX, offsetY);
      scene.worldLayer.scale.set(scale);
    }

    const ro = new ResizeObserver(() => relayout());
    ro.observe(host);

    return () => {
      destroyed = true;
      ro.disconnect();
      if (sceneRef.current) {
        sceneRef.current.app.destroy(true, { children: true, texture: true });
        sceneRef.current = null;
      }
    };
  }, [world]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !snapshot) return;

    scene.unitsLayer.removeChildren();
    scene.visionLayer.removeChildren();
    scene.fxLayer.removeChildren();

    for (const u of snapshot.units) drawUnit(scene.unitsLayer, scene.visionLayer, u);
    drawFx(scene.fxLayer, snapshot);
  }, [snapshot]);

  return <div ref={containerRef} className="combat-view" />;
}

function computeScale(world: WorldSnapshot, w: number, h: number): number {
  const worldW = world.width * world.tileSizeMeters;
  const worldH = world.height * world.tileSizeMeters;
  if (worldW <= 0 || worldH <= 0) return 1;
  return Math.min(w / worldW, h / worldH) * 0.95;
}

function drawTerrain(terrain: Graphics, world: WorldSnapshot): void {
  terrain.clear();
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const i = y * world.width + x;
      const color = TERRAIN_COLORS[world.terrain[i]] ?? 0x1a2b1a;
      terrain.rect(
        x * world.tileSizeMeters,
        y * world.tileSizeMeters,
        world.tileSizeMeters,
        world.tileSizeMeters,
      );
      terrain.fill({ color });
    }
  }
}

function drawUnit(units: Container, vision: Container, u: SnapshotUnit): void {
  const alive = u.actionKind !== 'dead';

  if (alive) {
    const visionG = new Graphics();
    visionG.position.set(u.x, u.y);
    const coneRange = 30;
    const coneHalf = (20 * Math.PI) / 180;
    visionG.moveTo(0, 0);
    visionG.arc(0, 0, coneRange, u.facing - coneHalf, u.facing + coneHalf);
    visionG.lineTo(0, 0);
    visionG.fill({ color: TEAM_COLORS[u.teamId] ?? 0xffffff, alpha: 0.1 });
    if (u.alerted) {
      visionG.circle(0, 0, 25);
      visionG.stroke({ color: TEAM_COLORS[u.teamId] ?? 0xffffff, alpha: 0.25, width: 0.3 });
    }
    vision.addChild(visionG);
  }

  const g = new Graphics();
  g.position.set(u.x, u.y);
  const radius = 1.5;
  const color = alive ? (TEAM_COLORS[u.teamId] ?? 0xffffff) : 0x333333;
  g.circle(0, 0, radius);
  g.fill({ color });
  g.stroke({ color: 0x000000, width: 0.15 });

  if (alive) {
    g.moveTo(0, 0);
    g.lineTo(Math.cos(u.facing) * radius * 1.6, Math.sin(u.facing) * radius * 1.6);
    g.stroke({ color: 0xffffff, width: 0.3 });
  }

  if (u.actionKind === 'firing') {
    g.circle(Math.cos(u.facing) * radius * 2, Math.sin(u.facing) * radius * 2, 0.5);
    g.fill({ color: 0xffdd55 });
  }

  const bloodPct = Math.max(0, Math.min(1, u.blood / 100));
  const barW = radius * 2;
  const barH = 0.3;
  g.rect(-radius, radius + 0.4, barW, barH);
  g.fill({ color: 0x222222 });
  g.rect(-radius, radius + 0.4, barW * bloodPct, barH);
  g.fill({ color: bloodPct > 0.5 ? 0x4caf50 : bloodPct > 0.25 ? 0xff9800 : 0xf44336 });

  units.addChild(g);
}

function drawFx(fx: Container, snapshot: SimSnapshot): void {
  const byId = new Map<number, SnapshotUnit>();
  for (const u of snapshot.units) byId.set(u.id, u);

  for (const e of snapshot.events) {
    if (e.kind === 'unit-fired') {
      const s = byId.get(e.shooter);
      const t = byId.get(e.target);
      if (!s || !t) continue;
      const g = new Graphics();
      g.moveTo(s.x, s.y);
      g.lineTo(t.x, t.y);
      g.stroke({ color: 0xffdd55, alpha: 0.7, width: 0.15 });
      fx.addChild(g);
    }
    if (e.kind === 'unit-hit') {
      const t = byId.get(e.target);
      if (!t) continue;
      const g = new Graphics();
      g.circle(t.x, t.y, 1.0);
      g.stroke({ color: 0xff4040, alpha: 0.9, width: 0.25 });
      fx.addChild(g);
    }
  }
}
