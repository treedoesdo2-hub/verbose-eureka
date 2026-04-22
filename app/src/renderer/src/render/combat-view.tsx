import 'pixi.js/unsafe-eval';
import type { SimSnapshot, SnapshotUnit, WorldSnapshot } from '@shared/snapshot';
import { Application, Container, Graphics } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { FxEmitter } from './fx-emitter';

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
  fx: FxEmitter;
};

export function CombatView({ world, snapshot }: Props): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const lastTickRef = useRef<number>(-1);

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

        const fx = new FxEmitter(fxLayer, app.ticker);

        sceneRef.current = {
          app,
          worldLayer,
          terrainLayer,
          visionLayer,
          unitsLayer,
          fxLayer,
          fx,
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
        sceneRef.current.fx.dispose();
        sceneRef.current.app.destroy(true, { children: true, texture: true });
        sceneRef.current = null;
      }
      lastTickRef.current = -1;
    };
  }, [world]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !snapshot) return;

    scene.unitsLayer.removeChildren();
    scene.visionLayer.removeChildren();

    const byId = new Map<number, SnapshotUnit>();
    for (const u of snapshot.units) byId.set(u.id, u);
    for (const u of snapshot.units) drawUnit(scene.unitsLayer, scene.visionLayer, u);

    // Snapshots arrive on the render clock; the same tick can arrive twice in
    // a dev fast-refresh or if React re-runs the effect — de-dupe by tick so
    // we don't double-ingest events.
    if (snapshot.tick !== lastTickRef.current) {
      scene.fx.ingestEvents(snapshot.events, byId);
      lastTickRef.current = snapshot.tick;
    }
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
  const downed = u.actionKind === 'downed';
  const teamColor = TEAM_COLORS[u.teamId] ?? 0xffffff;

  if (alive && !downed) {
    const visionG = new Graphics();
    visionG.position.set(u.x, u.y);
    const coneRange = u.alerted ? 40 : 30;
    const coneHalf = (20 * Math.PI) / 180;
    visionG.moveTo(0, 0);
    visionG.arc(0, 0, coneRange, u.facing - coneHalf, u.facing + coneHalf);
    visionG.lineTo(0, 0);
    visionG.fill({ color: teamColor, alpha: 0.1 });
    if (u.alerted) {
      visionG.circle(0, 0, 25);
      visionG.stroke({ color: teamColor, alpha: 0.25, width: 0.3 });
    }
    vision.addChild(visionG);
  }

  const g = new Graphics();
  g.position.set(u.x, u.y);
  const baseRadius = 1.5;
  // Stance changes silhouette footprint.
  const stanceScale = u.stance === 'prone' ? 1.35 : u.stance === 'crouched' ? 0.9 : 1.0;
  const stanceSquash = u.stance === 'prone' ? 0.55 : u.stance === 'crouched' ? 0.85 : 1.0;
  const radius = baseRadius * stanceScale;

  // Suppression halo — pulse ring around suppressed units.
  if (alive && !downed && u.suppression > 0.3) {
    g.circle(0, 0, radius + 0.8);
    g.stroke({
      color: 0xffaa22,
      alpha: Math.min(0.8, u.suppression * 0.9),
      width: 0.25,
    });
  }

  const color = alive
    ? downed
      ? 0x553333
      : u.aiState === 'panic'
        ? 0xaa4488
        : teamColor
    : 0x333333;

  // Body — ellipse if prone for lying-down read.
  g.ellipse(0, 0, radius, radius * stanceSquash);
  g.fill({ color });
  g.stroke({ color: 0x000000, width: 0.15 });

  if (alive && !downed) {
    g.moveTo(0, 0);
    g.lineTo(Math.cos(u.facing) * radius * 1.6, Math.sin(u.facing) * radius * 1.6);
    g.stroke({ color: 0xffffff, width: 0.3 });
  }

  if (u.actionKind === 'firing') {
    const mx = Math.cos(u.facing) * radius * 2.2;
    const my = Math.sin(u.facing) * radius * 2.2;
    g.circle(mx, my, 0.6);
    g.fill({ color: 0xffee88 });
    g.circle(mx, my, 0.3);
    g.fill({ color: 0xffffff });
  }

  // Blood bar.
  const bloodPct = Math.max(0, Math.min(1, u.blood / 100));
  const barW = baseRadius * 2;
  const barH = 0.3;
  const barY = radius * stanceSquash + 0.4;
  g.rect(-baseRadius, barY, barW, barH);
  g.fill({ color: 0x222222 });
  g.rect(-baseRadius, barY, barW * bloodPct, barH);
  g.fill({ color: bloodPct > 0.5 ? 0x4caf50 : bloodPct > 0.25 ? 0xff9800 : 0xf44336 });

  // Morale bar just below blood when shaky.
  if (alive && !downed && u.morale < 0.8) {
    const mBarY = barY + barH + 0.1;
    g.rect(-baseRadius, mBarY, barW, barH * 0.7);
    g.fill({ color: 0x222222 });
    const mpct = Math.max(0, Math.min(1, u.morale));
    g.rect(-baseRadius, mBarY, barW * mpct, barH * 0.7);
    g.fill({ color: mpct > 0.5 ? 0x7bbaff : mpct > 0.25 ? 0xd27bff : 0xff4d8a });
  }

  units.addChild(g);
}
