import 'pixi.js/unsafe-eval';
import type { SimSnapshot, SnapshotUnit, WorldSnapshot } from '@shared/snapshot';
import { Application, Container, Graphics } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { AtmosphereState } from './atmosphere-state';
import { FxEmitter } from './fx-emitter';
import { stanceFootprint } from './fx-math';
import { DOWNED_BODY, DOWNED_OUTLINE, SUPPRESSION_HALO, SUPPRESSION_PULSE } from './fx-palette';

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
  decalLayer: Container;
  visionLayer: Container;
  unitsLayer: Container;
  fxLayer: Container;
  fx: FxEmitter;
  atmosphere: AtmosphereState;
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
        const decalLayer = new Container();
        const visionLayer = new Container();
        const unitsLayer = new Container();
        const fxLayer = new Container();
        worldLayer.addChild(terrainLayer);
        worldLayer.addChild(decalLayer);
        worldLayer.addChild(visionLayer);
        worldLayer.addChild(unitsLayer);
        worldLayer.addChild(fxLayer);
        app.stage.addChild(worldLayer);

        const atmosphere = new AtmosphereState(world.width, world.height, world.tileSizeMeters);
        const fx = new FxEmitter(fxLayer, app.ticker, decalLayer, atmosphere, world);

        sceneRef.current = {
          app,
          worldLayer,
          terrainLayer,
          decalLayer,
          visionLayer,
          unitsLayer,
          fxLayer,
          fx,
          atmosphere,
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
    const now = performance.now();
    for (const u of snapshot.units) drawUnit(scene.unitsLayer, scene.visionLayer, u, now);

    // Snapshots arrive on the render clock; the same tick can arrive twice in
    // dev fast-refresh or if React re-runs the effect — de-dupe by tick so we
    // don't double-ingest events.
    if (snapshot.tick !== lastTickRef.current) {
      scene.atmosphere.decay(now);
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

function drawUnit(units: Container, vision: Container, u: SnapshotUnit, now: number): void {
  const dead = u.actionKind === 'dead';
  const downed = u.actionKind === 'downed';
  const alive = !dead && !downed;
  const teamColor = TEAM_COLORS[u.teamId] ?? 0xffffff;
  const foot = stanceFootprint(u.stance);

  if (alive) {
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
  const baseRadius = 1.5;

  if (downed) {
    drawDownedSilhouette(g, u, baseRadius);
    units.addChild(g);
    return;
  }

  // Suppression layered effect — drawn first so body paints over it.
  if (alive && u.suppression > 0.3) {
    g.position.set(u.x, u.y);
    // Base halo.
    g.circle(0, 0, baseRadius * foot.scale + 0.9);
    g.stroke({
      color: SUPPRESSION_HALO,
      alpha: Math.min(0.85, u.suppression * 0.9),
      width: 0.25,
    });
    // Pulsing inner ring (period ~800 ms).
    const pulse = 0.5 + 0.5 * Math.sin((now / 800) * Math.PI * 2);
    g.circle(0, 0, baseRadius * foot.scale + 0.55);
    g.stroke({
      color: SUPPRESSION_PULSE,
      alpha: 0.3 + 0.5 * pulse * u.suppression,
      width: 0.18,
    });
    // Chevron when near pin threshold.
    if (u.suppression > 0.85) {
      const cy = -(baseRadius * foot.scale + 1.6);
      g.moveTo(-0.5, cy);
      g.lineTo(0, cy + 0.5);
      g.lineTo(0.5, cy);
      g.stroke({ color: SUPPRESSION_HALO, alpha: 0.9, width: 0.2 });
    }
  } else {
    g.position.set(u.x, u.y);
  }

  if (dead) {
    drawDeadSilhouette(g, baseRadius, foot.scale);
    units.addChild(g);
    return;
  }

  // Body colour — desaturate toward gray as suppression climbs; panic tints magenta.
  const bodyColor =
    u.aiState === 'panic'
      ? 0xaa4488
      : u.suppression > 0.6
        ? blendTowardGray(teamColor, Math.min(0.6, (u.suppression - 0.6) * 1.5))
        : teamColor;

  drawAliveSilhouette(g, u, baseRadius, foot, bodyColor);

  // Facing indicator — thicker while firing.
  const r = baseRadius * foot.scale;
  g.moveTo(0, 0);
  g.lineTo(Math.cos(u.facing) * r * 1.7, Math.sin(u.facing) * r * 1.7);
  g.stroke({ color: 0xffffff, width: u.actionKind === 'firing' ? 0.4 : 0.3 });

  // Panic shiver — jagged outline offset.
  if (u.aiState === 'panic') {
    const shiver = 0.12;
    const jx = Math.sin(now / 40) * shiver;
    const jy = Math.cos(now / 55) * shiver;
    g.ellipse(jx, jy, r, r * foot.squash);
    g.stroke({ color: 0xaa4488, alpha: 0.6, width: 0.15 });
  }

  // Small firing hint (authoritative muzzle flash comes from FxEmitter).
  if (u.actionKind === 'firing') {
    const mx = Math.cos(u.facing) * r * 1.9;
    const my = Math.sin(u.facing) * r * 1.9;
    g.circle(mx, my, 0.25);
    g.fill({ color: 0xffee88, alpha: 0.8 });
  }

  drawBloodBar(g, u, baseRadius, foot);
  if (u.morale < 0.8) drawMoraleBar(g, u, baseRadius, foot);

  units.addChild(g);
}

function drawAliveSilhouette(
  g: Graphics,
  u: SnapshotUnit,
  baseRadius: number,
  foot: ReturnType<typeof stanceFootprint>,
  bodyColor: number,
): void {
  const r = baseRadius * foot.scale;
  if (u.stance === 'prone') {
    // Capsule oriented along facing: two circles joined by a rect, rotated by facing.
    const cos = Math.cos(u.facing);
    const sin = Math.sin(u.facing);
    const half = foot.bodyLength / 2;
    const wHalf = 0.5;
    const ax = cos * half;
    const ay = sin * half;
    // Body rect (as polygon to rotate properly).
    const px = -sin;
    const py = cos;
    g.moveTo(ax + px * wHalf, ay + py * wHalf);
    g.lineTo(ax - px * wHalf, ay - py * wHalf);
    g.lineTo(-ax - px * wHalf, -ay - py * wHalf);
    g.lineTo(-ax + px * wHalf, -ay + py * wHalf);
    g.closePath();
    g.fill({ color: bodyColor });
    g.stroke({ color: 0x000000, width: 0.12 });
    // Head end (forward).
    g.circle(ax, ay, 0.55);
    g.fill({ color: bodyColor });
    g.stroke({ color: 0x000000, width: 0.1 });
    // Feet end (back).
    g.circle(-ax, -ay, 0.45);
    g.fill({ color: bodyColor });
    g.stroke({ color: 0x000000, width: 0.1 });
    return;
  }

  // Standing / crouched — body ellipse + head dot + shoulder line.
  g.ellipse(0, 0, r, r * foot.squash);
  g.fill({ color: bodyColor });
  g.stroke({ color: 0x000000, width: 0.15 });

  // Head offset forward.
  const headR = u.stance === 'crouched' ? 0.42 : 0.5;
  const headDist = u.stance === 'crouched' ? r * 0.35 : r * 0.55;
  g.circle(Math.cos(u.facing) * headDist, Math.sin(u.facing) * headDist, headR);
  g.fill({ color: bodyColor });
  g.stroke({ color: 0x000000, width: 0.12 });

  // Shoulder line perpendicular to facing.
  const { px, py } = { px: -Math.sin(u.facing), py: Math.cos(u.facing) };
  const shoulder = foot.shoulderWidth * 0.5;
  g.moveTo(px * shoulder, py * shoulder);
  g.lineTo(-px * shoulder, -py * shoulder);
  g.stroke({ color: 0x000000, alpha: 0.6, width: 0.15 });
}

function drawDownedSilhouette(g: Graphics, u: SnapshotUnit, baseRadius: number): void {
  g.position.set(u.x, u.y);
  // Blood pool underlay — two overlapping low-alpha circles.
  g.circle(0, 0, baseRadius * 1.6);
  g.fill({ color: 0x330808, alpha: 0.55 });
  g.circle(baseRadius * 0.4, baseRadius * 0.2, baseRadius * 1.1);
  g.fill({ color: 0x3a0606, alpha: 0.45 });

  // Collapsed capsule perpendicular-ish to facing (collapsed sideways).
  const crossAngle = u.facing + Math.PI / 2;
  const cos = Math.cos(crossAngle);
  const sin = Math.sin(crossAngle);
  const half = 1.3;
  const wHalf = 0.45;
  const ax = cos * half;
  const ay = sin * half;
  const px = -sin;
  const py = cos;
  g.moveTo(ax + px * wHalf, ay + py * wHalf);
  g.lineTo(ax - px * wHalf, ay - py * wHalf);
  g.lineTo(-ax - px * wHalf, -ay - py * wHalf);
  g.lineTo(-ax + px * wHalf, -ay + py * wHalf);
  g.closePath();
  g.fill({ color: DOWNED_BODY });
  g.stroke({ color: DOWNED_OUTLINE, width: 0.12 });
  g.circle(ax, ay, 0.5);
  g.fill({ color: DOWNED_BODY });
  g.stroke({ color: DOWNED_OUTLINE, width: 0.1 });
  g.circle(-ax, -ay, 0.4);
  g.fill({ color: DOWNED_BODY });
  g.stroke({ color: DOWNED_OUTLINE, width: 0.1 });

  // Muted blood bar to show bleedout progress.
  const bloodPct = Math.max(0, Math.min(1, u.blood / 100));
  const barW = baseRadius * 2;
  const barH = 0.3;
  const barY = baseRadius + 0.8;
  g.rect(-baseRadius, barY, barW, barH);
  g.fill({ color: 0x1a1010 });
  g.rect(-baseRadius, barY, barW * bloodPct, barH);
  g.fill({ color: 0x883333 });
}

function drawDeadSilhouette(g: Graphics, baseRadius: number, scale: number): void {
  g.ellipse(0, 0, baseRadius * scale, baseRadius * scale * 0.6);
  g.fill({ color: 0x222222 });
  g.stroke({ color: 0x000000, width: 0.15 });
}

function drawBloodBar(
  g: Graphics,
  u: SnapshotUnit,
  baseRadius: number,
  foot: ReturnType<typeof stanceFootprint>,
): void {
  const bloodPct = Math.max(0, Math.min(1, u.blood / 100));
  const barW = baseRadius * 2;
  const barH = 0.3;
  const barY = baseRadius * foot.scale * foot.squash + 0.5;
  g.rect(-baseRadius, barY, barW, barH);
  g.fill({ color: 0x222222 });
  g.rect(-baseRadius, barY, barW * bloodPct, barH);
  g.fill({ color: bloodPct > 0.5 ? 0x4caf50 : bloodPct > 0.25 ? 0xff9800 : 0xf44336 });
}

function drawMoraleBar(
  g: Graphics,
  u: SnapshotUnit,
  baseRadius: number,
  foot: ReturnType<typeof stanceFootprint>,
): void {
  const barW = baseRadius * 2;
  const barH = 0.3;
  const mBarY = baseRadius * foot.scale * foot.squash + 0.5 + barH + 0.1;
  g.rect(-baseRadius, mBarY, barW, barH * 0.7);
  g.fill({ color: 0x222222 });
  const mpct = Math.max(0, Math.min(1, u.morale));
  g.rect(-baseRadius, mBarY, barW * mpct, barH * 0.7);
  g.fill({ color: mpct > 0.5 ? 0x7bbaff : mpct > 0.25 ? 0xd27bff : 0xff4d8a });
}

function blendTowardGray(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const gr = (color >> 8) & 0xff;
  const b = color & 0xff;
  const gray = Math.round((r + gr + b) / 3);
  const lerp = (c: number) => Math.round(c + (gray - c) * amount);
  return (lerp(r) << 16) | (lerp(gr) << 8) | lerp(b);
}
