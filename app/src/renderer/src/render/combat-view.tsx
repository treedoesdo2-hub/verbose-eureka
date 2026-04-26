import 'pixi.js/unsafe-eval';
import type { SimSnapshot, SnapshotUnit, WorldSnapshot } from '@shared/snapshot';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { AtmosphereState } from './atmosphere-state';
import { Camera } from './camera';
import { FxEmitter } from './fx-emitter';
import { isBleeding, stanceFootprint, woundIconColor } from './fx-math';
import {
  BLEED_DOT,
  DOWNED_BODY,
  DOWNED_OUTLINE,
  MORALE_AURA,
  MORALE_AURA_PULSE,
  PIN_AURA,
  SUPPRESSION_HALO,
  SUPPRESSION_PULSE,
  TARGET_LOCK,
  TARGET_LOCK_SOFT,
} from './fx-palette';
import { TerrainLayer } from './terrain-layer';

const TEAM_COLORS: Record<number, number> = {
  0: 0x55aaff,
  1: 0xff5a4a,
};

type Props = {
  world: WorldSnapshot;
  snapshot: SimSnapshot | null;
  selectedUnitId?: number | null;
  // operatorId → callsign for nameplate rendering. Optional: when omitted
  // we fall back to "unit-{id}".
  callsigns?: ReadonlyMap<string, string>;
};

type Scene = {
  app: Application;
  worldLayer: Container;
  terrain: TerrainLayer;
  decalLayer: Container;
  visionLayer: Container;
  unitsLayer: Container;
  fxLayer: Container;
  lockLayer: Container;
  // Hex-ring markers for active objectives (#288.14).
  objectiveLayer: Container;
  // Translucent callsigns for selected + firing units (#288.18).
  nameplateLayer: Container;
  // LAST·SEEN markers from friendly lastHeard hints (#288.17).
  ghostLayer: Container;
  fx: FxEmitter;
  atmosphere: AtmosphereState;
  camera: Camera;
};

export function CombatView({
  world,
  snapshot,
  selectedUnitId = null,
  callsigns,
}: Props): React.JSX.Element {
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
        const terrain = new TerrainLayer(world);
        const decalLayer = new Container();
        const visionLayer = new Container();
        const unitsLayer = new Container();
        const fxLayer = new Container();
        const lockLayer = new Container();
        const objectiveLayer = new Container();
        const nameplateLayer = new Container();
        // Ghost-contact layer (#288.17) — sits beneath nameplates so the
        // selected-unit callsign always reads on top.
        const ghostLayer = new Container();
        worldLayer.addChild(terrain.container);
        worldLayer.addChild(decalLayer);
        worldLayer.addChild(visionLayer);
        worldLayer.addChild(objectiveLayer);
        worldLayer.addChild(unitsLayer);
        worldLayer.addChild(fxLayer);
        worldLayer.addChild(lockLayer);
        worldLayer.addChild(ghostLayer);
        worldLayer.addChild(nameplateLayer);
        app.stage.addChild(worldLayer);

        const atmosphere = new AtmosphereState(world.width, world.height, world.tileSizeMeters);
        const fx = new FxEmitter(fxLayer, app.ticker, decalLayer, atmosphere, world);

        const cullNow = (): void => {
          const scene = sceneRef.current;
          if (!scene) return;
          const w = scene.app.renderer.width / (window.devicePixelRatio || 1);
          const h = scene.app.renderer.height / (window.devicePixelRatio || 1);
          const rect = scene.camera.viewportRect(w, h);
          scene.terrain.cull(rect.minX, rect.minY, rect.maxX, rect.maxY);
        };

        const camera = new Camera(
          host,
          worldLayer,
          {
            worldWidth: world.width * world.tileSizeMeters,
            worldHeight: world.height * world.tileSizeMeters,
          },
          cullNow,
        );

        sceneRef.current = {
          app,
          worldLayer,
          terrain,
          decalLayer,
          visionLayer,
          unitsLayer,
          fxLayer,
          lockLayer,
          objectiveLayer,
          nameplateLayer,
          ghostLayer,
          fx,
          atmosphere,
          camera,
        };

        relayout();
        // WASD pan runs on the Pixi ticker so it stays smooth regardless
        // of snapshot cadence.
        app.ticker.add(() => {
          const scene = sceneRef.current;
          if (!scene) return;
          const w = scene.app.renderer.width / (window.devicePixelRatio || 1);
          const h = scene.app.renderer.height / (window.devicePixelRatio || 1);
          scene.camera.tick(w, h);
        });
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
      scene.camera.fitToWorld(w, h);
      const rect = scene.camera.viewportRect(w, h);
      scene.terrain.cull(rect.minX, rect.minY, rect.maxX, rect.maxY);
    }

    const ro = new ResizeObserver(() => relayout());
    ro.observe(host);

    return () => {
      destroyed = true;
      ro.disconnect();
      if (sceneRef.current) {
        sceneRef.current.camera.dispose();
        sceneRef.current.terrain.dispose();
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
    scene.lockLayer.removeChildren();
    scene.objectiveLayer.removeChildren();
    scene.nameplateLayer.removeChildren();
    scene.ghostLayer.removeChildren();

    const byId = new Map<number, SnapshotUnit>();
    for (const u of snapshot.units) byId.set(u.id, u);
    const now = performance.now();

    // Objective hex rings (#288.14). Drawn beneath units so silhouettes
    // sit cleanly on top.
    for (const obj of snapshot.objectives) {
      drawObjectiveMarker(scene.objectiveLayer, obj, now);
    }

    for (const u of snapshot.units) drawUnit(scene.unitsLayer, scene.visionLayer, u, now);

    for (const shooter of snapshot.units) {
      if (shooter.targetId == null) continue;
      if (shooter.actionKind !== 'firing' && shooter.actionKind !== 'aiming') continue;
      const target = byId.get(shooter.targetId);
      if (!target) continue;
      if (target.actionKind === 'dead') continue;
      drawTargetLock(scene.lockLayer, target, now);
    }

    // Ghost contacts (#288.17) — render lastHeard hints from friendly
    // units as faded markers labelled LAST·SEEN. We dedupe by source
    // unit id within a single tick so a hint heard by multiple
    // friendlies only renders once.
    const ghostByUnitId = new Map<number, SnapshotUnit['lastHeard'][number] & { dist: number }>();
    for (const u of snapshot.units) {
      if (u.teamId !== 0) continue;
      if (u.actionKind === 'dead' || u.actionKind === 'downed') continue;
      for (const h of u.lastHeard) {
        const target = byId.get(h.sourceUnitId);
        // Skip ghosts for units we can already see (alive friendlies
        // would visually duplicate the silhouette).
        if (target && target.actionKind !== 'dead' && target.teamId === 0) continue;
        const prev = ghostByUnitId.get(h.sourceUnitId);
        const dist = Math.hypot(h.approxX - u.x, h.approxY - u.y);
        if (!prev || dist < prev.dist) {
          ghostByUnitId.set(h.sourceUnitId, { ...h, dist });
        }
      }
    }
    for (const ghost of ghostByUnitId.values()) {
      drawGhostContact(scene.ghostLayer, ghost, snapshot.tick);
    }

    // Nameplates (#288.18) — selected unit always; firing units transient.
    for (const u of snapshot.units) {
      if (u.actionKind === 'dead') continue;
      const isSelected = selectedUnitId !== null && u.id === selectedUnitId;
      const isFiring = u.actionKind === 'firing';
      if (!isSelected && !isFiring) continue;
      const callsign = (u.operatorId ? callsigns?.get(u.operatorId) : null) ?? `unit-${u.id}`;
      drawNameplate(scene.nameplateLayer, u, callsign, isSelected);
    }

    // Snapshots arrive on the render clock; the same tick can arrive twice in
    // dev fast-refresh or if React re-runs the effect — de-dupe by tick so we
    // don't double-ingest events.
    if (snapshot.tick !== lastTickRef.current) {
      scene.atmosphere.decay(now);
      scene.fx.ingestEvents(snapshot.events, byId);
      lastTickRef.current = snapshot.tick;
    }
  }, [snapshot, selectedUnitId, callsigns]);

  return (
    <div ref={containerRef} className="combat-view" style={{ position: 'relative' }}>
      {/* LOS edge vignette (#288.09) — radial fade at the viewport edges
          implies the player's visual range falls off near the periphery.
          Pure visual chrome over the PIXI canvas; no FOV mask. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(6,9,20,0.35) 80%, rgba(6,9,20,0.7) 100%)',
        }}
      />
    </div>
  );
}

// LAST·SEEN ghost-contact marker (#288.17). Rendered as a faded amber
// hex outline with a small label, positioned at the lastHeard hint's
// approximate coordinates. Confidence < 0.4 hints render at lower
// opacity so weak intel reads as weak.
function drawGhostContact(
  layer: Container,
  hint: SnapshotUnit['lastHeard'][number] & { dist: number },
  currentTick: number,
): void {
  const ageTicks = Math.max(0, currentTick - hint.tick);
  // Decay opacity over ~10 seconds (300 ticks) so older hints fade out.
  const ageFade = Math.max(0, 1 - ageTicks / 300);
  const alpha = Math.max(0.25, hint.confidence) * ageFade;
  if (alpha <= 0.05) return;

  const r = 1.4;
  const g = new Graphics();
  g.position.set(hint.approxX, hint.approxY);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.stroke({ color: 0xffa020, alpha, width: 0.16 });
  // X mark inside.
  g.moveTo(-r * 0.5, -r * 0.5);
  g.lineTo(r * 0.5, r * 0.5);
  g.moveTo(-r * 0.5, r * 0.5);
  g.lineTo(r * 0.5, -r * 0.5);
  g.stroke({ color: 0xffa020, alpha: alpha * 0.7, width: 0.12 });
  layer.addChild(g);

  const text = new Text({
    text: 'LAST·SEEN',
    style: new TextStyle({
      fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
      fontSize: 22,
      fontWeight: '700',
      fill: 0xffa020,
      letterSpacing: 1.2,
    }),
  });
  text.anchor.set(0.5, 0);
  text.position.set(hint.approxX, hint.approxY + r + 0.4);
  text.scale.set(0.1);
  text.alpha = alpha;
  layer.addChild(text);
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

  g.position.set(u.x, u.y);

  // Morale / pin aura — sits beneath the suppression halo so the halo reads
  // crisply on top. Panicked or broken units get the magenta aura; heavily
  // pinned units get the orange aura.
  if (alive) {
    const panicked = u.aiState === 'panic' || u.morale < 0.25;
    const heavyPinned = u.suppression >= 0.85;
    if (panicked || heavyPinned) {
      const auraPulse = 0.5 + 0.5 * Math.sin((now / 1100) * Math.PI * 2);
      const outerR = baseRadius * foot.scale + 1.4;
      const innerR = baseRadius * foot.scale + 0.9;
      const auraColor = panicked ? MORALE_AURA : PIN_AURA;
      const pulseColor = panicked ? MORALE_AURA_PULSE : PIN_AURA;
      g.circle(0, 0, outerR);
      g.fill({ color: auraColor, alpha: 0.18 + 0.12 * auraPulse });
      g.circle(0, 0, innerR);
      g.fill({ color: pulseColor, alpha: 0.1 + 0.15 * auraPulse });
    }
  }

  // Suppression layered effect — drawn under the body silhouette.
  if (alive && u.suppression > 0.3) {
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
  drawWoundIcons(g, u, baseRadius, foot);
  drawBleedDot(g, u, baseRadius, foot, now);

  units.addChild(g);
}

function drawTargetLock(layer: Container, target: SnapshotUnit, now: number): void {
  const g = new Graphics();
  g.position.set(target.x, target.y);
  const pulse = 0.5 + 0.5 * Math.sin((now / 600) * Math.PI * 2);
  const r = 1.2;
  // Outer soft ring.
  g.circle(0, 0, r);
  g.stroke({ color: TARGET_LOCK_SOFT, alpha: 0.35 + 0.2 * pulse, width: 0.08 });
  // Inner crisp ring.
  g.circle(0, 0, r * 0.65);
  g.stroke({ color: TARGET_LOCK, alpha: 0.55 + 0.3 * pulse, width: 0.08 });
  // Four tick marks at cardinals radiating outward.
  const tick = 0.28;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const cx = Math.cos(a) * r;
    const cy = Math.sin(a) * r;
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * tick, cy + Math.sin(a) * tick);
  }
  g.stroke({ color: TARGET_LOCK, alpha: 0.8, width: 0.1 });
  layer.addChild(g);
}

function drawWoundIcons(
  g: Graphics,
  u: SnapshotUnit,
  baseRadius: number,
  foot: ReturnType<typeof stanceFootprint>,
): void {
  if (u.wounds.length === 0) return;
  const iconR = 0.18;
  const gap = 0.5;
  const maxIcons = 6;
  const count = Math.min(u.wounds.length, maxIcons);
  const rowWidth = (count - 1) * gap;
  const y = -(baseRadius * foot.scale * foot.squash + 0.7);
  for (let i = 0; i < count; i++) {
    const w = u.wounds[i];
    if (!w) continue;
    const color = woundIconColor(w.severity);
    const x = -rowWidth / 2 + i * gap;
    g.circle(x, y, iconR);
    g.fill({ color });
    g.stroke({ color: 0x000000, alpha: 0.7, width: 0.05 });
  }
  if (u.wounds.length > maxIcons) {
    const x = -rowWidth / 2 + maxIcons * gap;
    for (let k = 0; k < 3; k++) {
      g.circle(x + k * 0.12, y, 0.06);
      g.fill({ color: 0xffffff, alpha: 0.8 });
    }
  }
}

function drawBleedDot(
  g: Graphics,
  u: SnapshotUnit,
  baseRadius: number,
  foot: ReturnType<typeof stanceFootprint>,
  now: number,
): void {
  if (!isBleeding(u.wounds)) return;
  const pulse = 0.5 + 0.5 * Math.sin((now / 900) * Math.PI * 2);
  const y = -(baseRadius * foot.scale * foot.squash + 1.15);
  g.circle(0, y, 0.22);
  g.fill({ color: BLEED_DOT, alpha: 0.55 + 0.35 * pulse });
  g.circle(0, y, 0.12);
  g.fill({ color: 0xffffff, alpha: 0.4 + 0.4 * pulse });
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

// ── Objective hex-ring marker (#288.14) ───────────────────────────────────
// Draws a flat hex outline around the objective's zone with a small
// kind-letter legend. Cyan when active, green when complete, magenta
// when failed.
function drawObjectiveMarker(
  layer: Container,
  obj: SimSnapshot['objectives'][number],
  now: number,
): void {
  if (!obj.zone) return;
  const color =
    obj.status === 'complete' ? 0x33ffa0 : obj.status === 'failed' ? 0xff2d9a : 0x18e0ff;
  const cx = obj.zone.x + obj.zone.w / 2;
  const cy = obj.zone.y + obj.zone.h / 2;
  // Hex radius scales with the zone's larger axis.
  const r = Math.max(obj.zone.w, obj.zone.h) * 0.55;
  const g = new Graphics();
  g.position.set(cx, cy);

  // Outer hex.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.stroke({ color, alpha: 0.7, width: 0.18 });

  // Pulsing inner hex (active objectives only).
  if (obj.status === 'active') {
    const pulse = 0.5 + 0.5 * Math.sin((now / 1100) * Math.PI * 2);
    const r2 = r * (0.55 + 0.05 * pulse);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * r2;
      const py = Math.sin(a) * r2;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.stroke({ color, alpha: 0.35 + 0.3 * pulse, width: 0.12 });
  }

  layer.addChild(g);

  // Kind letter overlay — small Pixi Text; cheap because objectives are
  // O(1).
  const label = obj.kind === 'extract' ? 'X' : obj.kind === 'defend' ? 'D' : 'S';
  const text = new Text({
    text: label,
    style: new TextStyle({
      fontFamily: 'Chakra Petch, system-ui, sans-serif',
      fontSize: 32,
      fontWeight: '700',
      fill: color,
      letterSpacing: 2,
    }),
  });
  text.anchor.set(0.5, 0.5);
  text.position.set(cx, cy);
  text.scale.set(r * 0.06);
  layer.addChild(text);
}

// ── Nameplate (#288.18) ────────────────────────────────────────────────────
// Translucent callsign rendered above a unit. Used for the selected unit
// (sticky) and any unit currently firing (transient).
function drawNameplate(
  layer: Container,
  u: SnapshotUnit,
  callsign: string,
  isSelected: boolean,
): void {
  const text = new Text({
    text: `"${callsign}"`,
    style: new TextStyle({
      fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
      fontSize: 24,
      fontWeight: '600',
      fill: u.teamId === 0 ? 0x18e0ff : 0xff5a4a,
      letterSpacing: 1,
      stroke: { color: 0x000000, width: 4 },
    }),
  });
  text.anchor.set(0.5, 1);
  text.position.set(u.x, u.y - 2.2);
  text.scale.set(0.12);
  text.alpha = isSelected ? 0.95 : 0.7;
  layer.addChild(text);
}
