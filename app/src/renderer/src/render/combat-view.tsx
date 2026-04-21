import type { SimSnapshot, SnapshotUnit, WorldSnapshot } from '@shared/snapshot';
import { Application, Container, Graphics, Text } from 'pixi.js';
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

export function CombatView({ world, snapshot }: Props): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const terrainLayerRef = useRef<Container | null>(null);
  const unitsLayerRef = useRef<Container | null>(null);
  const visionLayerRef = useRef<Container | null>(null);
  const fxLayerRef = useRef<Container | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const host = containerRef.current;
    let destroyed = false;
    const app = new Application();

    (async () => {
      await app.init({
        background: 0x0b0d10,
        resizeTo: host,
        antialias: true,
      });
      if (destroyed) {
        app.destroy(true);
        return;
      }
      host.innerHTML = '';
      host.appendChild(app.canvas);
      appRef.current = app;

      const terrainLayer = new Container();
      const visionLayer = new Container();
      const unitsLayer = new Container();
      const fxLayer = new Container();
      app.stage.addChild(terrainLayer);
      app.stage.addChild(visionLayer);
      app.stage.addChild(unitsLayer);
      app.stage.addChild(fxLayer);
      terrainLayerRef.current = terrainLayer;
      visionLayerRef.current = visionLayer;
      unitsLayerRef.current = unitsLayer;
      fxLayerRef.current = fxLayer;

      drawTerrain(terrainLayer, world, app);
    })();

    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
    };
  }, [world]);

  useEffect(() => {
    if (!snapshot || !appRef.current) return;
    const app = appRef.current;
    const unitsLayer = unitsLayerRef.current;
    const visionLayer = visionLayerRef.current;
    const fxLayer = fxLayerRef.current;
    if (!unitsLayer || !visionLayer || !fxLayer) return;

    const scale = computeScale(world, app.screen.width, app.screen.height);

    unitsLayer.removeChildren();
    visionLayer.removeChildren();
    fxLayer.removeChildren();

    for (const u of snapshot.units) {
      drawUnit(unitsLayer, visionLayer, u, scale);
    }

    drawFxEvents(fxLayer, snapshot, scale);
  }, [snapshot, world]);

  return <div ref={containerRef} className="combat-view" />;
}

function computeScale(world: WorldSnapshot, w: number, h: number): number {
  const worldW = world.width * world.tileSizeMeters;
  const worldH = world.height * world.tileSizeMeters;
  return Math.min(w / worldW, h / worldH) * 0.95;
}

function drawTerrain(layer: Container, world: WorldSnapshot, app: Application): void {
  const scale = computeScale(world, app.screen.width, app.screen.height);
  const offsetX = (app.screen.width - world.width * world.tileSizeMeters * scale) / 2;
  const offsetY = (app.screen.height - world.height * world.tileSizeMeters * scale) / 2;
  layer.position.set(offsetX, offsetY);
  layer.scale.set(scale);

  const g = new Graphics();
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const i = y * world.width + x;
      const color = TERRAIN_COLORS[world.terrain[i]] ?? 0x1a2b1a;
      g.rect(
        x * world.tileSizeMeters,
        y * world.tileSizeMeters,
        world.tileSizeMeters,
        world.tileSizeMeters,
      );
      g.fill({ color });
    }
  }
  layer.addChild(g);
}

function drawUnit(units: Container, vision: Container, u: SnapshotUnit, scale: number): void {
  const container = new Container();
  container.position.set(u.x, u.y);
  container.scale.set(1 / scale);

  if (u.actionKind !== 'dead') {
    const visionG = new Graphics();
    const coneRange = 30;
    const coneHalf = (20 * Math.PI) / 180;
    visionG.moveTo(0, 0);
    visionG.arc(0, 0, coneRange, u.facing - coneHalf, u.facing + coneHalf);
    visionG.lineTo(0, 0);
    visionG.fill({ color: TEAM_COLORS[u.teamId] ?? 0xffffff, alpha: 0.08 });

    if (u.alerted) {
      visionG.circle(0, 0, 80);
      visionG.stroke({ color: TEAM_COLORS[u.teamId], alpha: 0.1, width: 1 });
    }

    const visionContainer = new Container();
    visionContainer.position.set(u.x, u.y);
    vision.addChild(visionContainer);
    visionContainer.addChild(visionG);
  }

  const g = new Graphics();
  const color = u.actionKind === 'dead' ? 0x333333 : (TEAM_COLORS[u.teamId] ?? 0xffffff);
  const radius = 8;
  g.circle(0, 0, radius);
  g.fill({ color });
  g.stroke({ color: 0x000000, width: 1 });

  if (u.actionKind !== 'dead') {
    g.moveTo(0, 0);
    g.lineTo(Math.cos(u.facing) * radius * 1.5, Math.sin(u.facing) * radius * 1.5);
    g.stroke({ color: 0xffffff, width: 2 });
  }

  if (u.actionKind === 'firing') {
    const fxSize = 3;
    g.circle(Math.cos(u.facing) * radius * 1.8, Math.sin(u.facing) * radius * 1.8, fxSize);
    g.fill({ color: 0xffdd55 });
  }

  const bloodPct = Math.max(0, Math.min(1, u.blood / 100));
  const barW = radius * 2;
  const barH = 2;
  g.rect(-radius, radius + 2, barW, barH);
  g.fill({ color: 0x222222 });
  g.rect(-radius, radius + 2, barW * bloodPct, barH);
  g.fill({ color: bloodPct > 0.5 ? 0x4caf50 : bloodPct > 0.25 ? 0xff9800 : 0xf44336 });

  container.addChild(g);
  units.addChild(container);
}

function drawFxEvents(fx: Container, snapshot: SimSnapshot, _scale: number): void {
  const unitById = new Map<number, SnapshotUnit>();
  for (const u of snapshot.units) unitById.set(u.id, u);

  for (const e of snapshot.events) {
    if (e.kind === 'unit-fired') {
      const shooter = unitById.get(e.shooter);
      const target = unitById.get(e.target);
      if (!shooter || !target) continue;
      const g = new Graphics();
      g.moveTo(shooter.x, shooter.y);
      g.lineTo(target.x, target.y);
      g.stroke({ color: 0xffdd55, alpha: 0.6, width: 0.5 });
      fx.addChild(g);
    }
    if (e.kind === 'unit-hit') {
      const target = unitById.get(e.target);
      if (!target) continue;
      const g = new Graphics();
      g.circle(target.x, target.y, 4);
      g.stroke({ color: 0xff4040, alpha: 0.9, width: 1 });
      fx.addChild(g);
    }
  }

  void Text;
}
