import type {
  SnapshotDownedCause,
  SnapshotEvent,
  SnapshotUnit,
  WorldSnapshot,
} from '@shared/snapshot';
import { type Container, Graphics, type Ticker } from 'pixi.js';
import type { AtmosphereState, BuildingDamage } from './atmosphere-state';
import {
  casingArcEnd,
  direction,
  jitter,
  missDustColors,
  muzzleOffset,
  perp,
  woundPaletteForZone,
} from './fx-math';
import {
  BLOOD_POOL,
  BUILDING_CRACK,
  CASING_BRASS,
  CASING_SHADOW,
  CRATER_FLOOR,
  CRATER_RIM,
  CRATER_SCORCH,
  EXPLOSION_CORE,
  EXPLOSION_DARK,
  EXPLOSION_MID,
  EXPLOSION_SHOCK,
  MUZZLE_BLOOM,
  MUZZLE_CORE,
  MUZZLE_SMOKE,
  POOL_BLOOD,
  RUBBLE_TINT,
  SMOKE_PUFF,
  SMOKE_PUFF_LIGHT,
  SPARK_COOL,
  SPARK_CORE,
  SPARK_HOT,
  TRACER_CORE,
  TRACER_GLOW,
} from './fx-palette';
import { type FxKind, TTL_MS } from './fx-ttl';

type Ease = 'linear' | 'easeOut' | 'pulse';

type FxEntry = {
  kind: FxKind;
  g: Graphics;
  bornMs: number;
  ttlMs: number;
  ease: Ease;
};

type FxSeed = { tick: number; a: number; b: number };

export class FxEmitter {
  private readonly layer: Container;
  private readonly decalLayer: Container | null;
  private readonly atmosphere: AtmosphereState | null;
  private readonly world: WorldSnapshot | null;
  private readonly ticker: Ticker;
  private readonly entries: FxEntry[] = [];
  private readonly decals: Graphics[] = [];
  private readonly paintedBuildingTiles = new Map<number, number>();
  private readonly paintedRubbleTiles = new Set<number>();
  private elapsedMs = 0;
  private readonly onTick: (t: Ticker) => void;
  private disposed = false;

  constructor(
    layer: Container,
    ticker: Ticker,
    decalLayer: Container | null = null,
    atmosphere: AtmosphereState | null = null,
    world: WorldSnapshot | null = null,
  ) {
    this.layer = layer;
    this.decalLayer = decalLayer;
    this.atmosphere = atmosphere;
    this.world = world;
    this.ticker = ticker;
    this.onTick = (t: Ticker) => {
      this.elapsedMs += t.deltaMS;
      this.cull();
    };
    ticker.add(this.onTick);
  }

  spawnTracer(from: { x: number; y: number }, to: { x: number; y: number }, seed: FxSeed): void {
    if (this.disposed) return;
    const d = direction(from, to);
    if (d.len === 0) return;

    // Outer glow.
    const glow = new Graphics();
    glow.moveTo(from.x, from.y);
    glow.lineTo(to.x, to.y);
    glow.stroke({ color: TRACER_GLOW, alpha: 0.55, width: 0.32 });
    this.push('tracer', glow, 'easeOut');

    // Inner core — tapered via separate segments.
    const core = new Graphics();
    core.moveTo(from.x, from.y);
    core.lineTo(to.x, to.y);
    core.stroke({ color: TRACER_CORE, alpha: 0.95, width: 0.14 });
    // Head dot at impact end.
    core.circle(to.x, to.y, 0.22);
    core.fill({ color: TRACER_CORE });
    this.push('tracer', core, 'easeOut');

    // Trailing dashes.
    const trail = new Graphics();
    const dashCount = 4;
    for (let i = 0; i < dashCount; i++) {
      const t0 = i / dashCount;
      const t1 = t0 + 0.5 / dashCount;
      const x0 = from.x + d.nx * d.len * t0;
      const y0 = from.y + d.ny * d.len * t0;
      const x1 = from.x + d.nx * d.len * t1;
      const y1 = from.y + d.ny * d.len * t1;
      const j = jitter(seed, i);
      trail.moveTo(x0 + j * 0.05, y0 + j * 0.05);
      trail.lineTo(x1, y1);
    }
    trail.stroke({ color: TRACER_CORE, alpha: 0.45, width: 0.09 });
    this.push('tracer-trail', trail, 'linear');
  }

  spawnMuzzleFlash(origin: { x: number; y: number }, angle: number, seed: FxSeed): void {
    if (this.disposed) return;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const { px, py } = perp(cos, sin);

    // Core: bright triangular cone.
    const core = new Graphics();
    const tipX = origin.x + cos * 1.4;
    const tipY = origin.y + sin * 1.4;
    core.moveTo(origin.x, origin.y);
    core.lineTo(origin.x + px * 0.35, origin.y + py * 0.35);
    core.lineTo(tipX, tipY);
    core.lineTo(origin.x - px * 0.35, origin.y - py * 0.35);
    core.closePath();
    core.fill({ color: MUZZLE_CORE, alpha: 0.95 });
    this.push('muzzle-core', core, 'easeOut');

    // Bloom: soft wide circle.
    const bloom = new Graphics();
    bloom.circle(origin.x + cos * 0.4, origin.y + sin * 0.4, 1.1);
    bloom.fill({ color: MUZZLE_BLOOM, alpha: 0.6 });
    this.push('muzzle-bloom', bloom, 'easeOut');

    // Smoke puff drifting along facing.
    const smoke = new Graphics();
    const j = jitter(seed, 0);
    smoke.circle(origin.x + cos * 0.6 + j * 0.1, origin.y + sin * 0.6 + j * 0.1, 0.55);
    smoke.fill({ color: MUZZLE_SMOKE, alpha: 0.45 });
    this.push('muzzle-smoke', smoke, 'easeOut');
  }

  spawnWoundImpact(
    at: { x: number; y: number },
    dir: { nx: number; ny: number },
    zone: import('@schema/common').BodyZone | null,
    seed: FxSeed,
  ): void {
    if (this.disposed) return;
    const palette = woundPaletteForZone(zone);
    const { px, py } = perp(dir.nx, dir.ny);

    // Chunk: irregular quad travelling along shot direction.
    const chunk = new Graphics();
    const cx = at.x + dir.nx * 0.3;
    const cy = at.y + dir.ny * 0.3;
    chunk.moveTo(cx - dir.nx * 0.3, cy - dir.ny * 0.3);
    chunk.lineTo(cx + px * 0.35 * palette.weight, cy + py * 0.35 * palette.weight);
    chunk.lineTo(cx + dir.nx * 0.5 * palette.weight, cy + dir.ny * 0.5 * palette.weight);
    chunk.lineTo(cx - px * 0.25 * palette.weight, cy - py * 0.25 * palette.weight);
    chunk.closePath();
    chunk.fill({ color: palette.secondary, alpha: 0.85 });
    this.push('wound-chunk', chunk, 'easeOut');

    // Spray: deterministic jittered droplets.
    const spray = new Graphics();
    const dropletCount = 6; // MAX_PRIMITIVES cap
    for (let i = 0; i < dropletCount; i++) {
      const j1 = jitter(seed, i * 2);
      const j2 = jitter(seed, i * 2 + 1);
      const dist = 0.5 + Math.abs(j1) * 1.1 * palette.weight;
      const sx = at.x + dir.nx * dist + px * j2 * 0.6;
      const sy = at.y + dir.ny * dist + py * j2 * 0.6;
      const r = 0.12 + Math.abs(j1) * 0.12;
      spray.circle(sx, sy, r);
    }
    spray.fill({ color: palette.primary, alpha: 0.9 });
    this.push('wound-spray', spray, 'easeOut');

    // Lingering pool dot at impact.
    const pool = new Graphics();
    pool.circle(at.x, at.y, 0.35 * palette.weight);
    pool.fill({ color: BLOOD_POOL, alpha: 0.75 });
    this.push('wound-pool', pool, 'linear');
  }

  spawnBlockSpark(
    at: { x: number; y: number },
    dir: { nx: number; ny: number },
    seed: FxSeed,
  ): void {
    if (this.disposed) return;
    const { px, py } = perp(dir.nx, dir.ny);

    // Central ring flash.
    const ring = new Graphics();
    ring.circle(at.x, at.y, 0.7);
    ring.stroke({ color: SPARK_CORE, alpha: 0.9, width: 0.18 });
    this.push('block-ring', ring, 'easeOut');

    // Shower: 5–8 fan segments opposite shot direction.
    const sparkCount = 8; // MAX_PRIMITIVES cap
    const hot = new Graphics();
    const cool = new Graphics();
    for (let i = 0; i < sparkCount; i++) {
      const j = jitter(seed, i);
      // Fan ±45° opposite direction.
      const spread = j * 0.78; // rad
      const base = Math.atan2(-dir.ny, -dir.nx);
      const angle = base + spread;
      const len = 0.6 + Math.abs(j) * 0.9;
      const x1 = at.x + Math.cos(angle) * len;
      const y1 = at.y + Math.sin(angle) * len;
      const g = i % 2 === 0 ? hot : cool;
      g.moveTo(at.x + px * j * 0.1, at.y + py * j * 0.1);
      g.lineTo(x1, y1);
    }
    hot.stroke({ color: SPARK_HOT, alpha: 0.95, width: 0.15 });
    cool.stroke({ color: SPARK_COOL, alpha: 0.7, width: 0.1 });
    this.push('block-spark', hot, 'easeOut');
    this.push('block-spark', cool, 'easeOut');
  }

  spawnMissDust(
    at: { x: number; y: number },
    dir: { nx: number; ny: number },
    reason: import('@shared/snapshot').SnapshotMissReason | null,
    seed: FxSeed,
  ): void {
    if (this.disposed) return;
    const { light, dark } = missDustColors(reason);
    const { px, py } = perp(dir.nx, dir.ny);

    const dustLight = new Graphics();
    dustLight.circle(at.x, at.y, 0.7);
    dustLight.fill({ color: light, alpha: 0.55 });
    this.push('miss-dust', dustLight, 'easeOut');

    const dustDark = new Graphics();
    const j = jitter(seed, 0);
    dustDark.circle(at.x + dir.nx * 0.25 + j * 0.1, at.y + dir.ny * 0.25 + j * 0.1, 0.5);
    dustDark.fill({ color: dark, alpha: 0.45 });
    this.push('miss-dust', dustDark, 'easeOut');

    // Debris ticks — 3 small lines.
    const debris = new Graphics();
    for (let i = 0; i < 3; i++) {
      const jd = jitter(seed, i + 1);
      const ox = at.x + px * jd * 0.5;
      const oy = at.y + py * jd * 0.5;
      debris.moveTo(ox, oy);
      debris.lineTo(ox + dir.nx * 0.2, oy + dir.ny * 0.2);
    }
    debris.stroke({ color: dark, alpha: 0.8, width: 0.08 });
    this.push('miss-debris', debris, 'easeOut');
  }

  spawnExplosion(at: { x: number; y: number }, seed: FxSeed): void {
    if (this.disposed) return;
    // Core flash.
    const core = new Graphics();
    core.circle(at.x, at.y, 1.4);
    core.fill({ color: EXPLOSION_CORE, alpha: 0.95 });
    this.push('explosion-core', core, 'easeOut');

    // Mid star.
    const mid = new Graphics();
    const points = 6;
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const jr = 1 + jitter(seed, i) * 0.4;
      if (i === 0) mid.moveTo(at.x + Math.cos(a) * jr, at.y + Math.sin(a) * jr);
      else mid.lineTo(at.x + Math.cos(a) * jr, at.y + Math.sin(a) * jr);
    }
    mid.closePath();
    mid.fill({ color: EXPLOSION_MID, alpha: 0.85 });
    this.push('explosion-ring', mid, 'easeOut');

    // Shock ring.
    const shock = new Graphics();
    shock.circle(at.x, at.y, 2.2);
    shock.stroke({ color: EXPLOSION_SHOCK, alpha: 0.9, width: 0.25 });
    this.push('explosion-shock', shock, 'easeOut');

    // Debris.
    const debris = new Graphics();
    const debrisCount = 6;
    for (let i = 0; i < debrisCount; i++) {
      const a = (i / debrisCount) * Math.PI * 2 + jitter(seed, i + points) * 0.3;
      const len = 1.2 + Math.abs(jitter(seed, i + points + 1)) * 1.5;
      debris.moveTo(at.x + Math.cos(a) * 0.4, at.y + Math.sin(a) * 0.4);
      debris.lineTo(at.x + Math.cos(a) * len, at.y + Math.sin(a) * len);
    }
    debris.stroke({ color: EXPLOSION_DARK, alpha: 0.85, width: 0.12 });
    this.push('explosion-debris', debris, 'easeOut');

    // Persistent crater decal.
    const target = this.decalLayer ?? this.layer;
    const crater = new Graphics();
    crater.circle(at.x, at.y, 1.8);
    crater.fill({ color: CRATER_RIM, alpha: 0.8 });
    crater.circle(at.x, at.y, 1.2);
    crater.fill({ color: CRATER_FLOOR, alpha: 0.85 });
    for (let i = 0; i < 3; i++) {
      const j1 = jitter(seed, i * 3);
      const j2 = jitter(seed, i * 3 + 1);
      crater.circle(
        at.x + j1 * 1.5,
        at.y + j2 * 1.5,
        0.25 + Math.abs(jitter(seed, i * 3 + 2)) * 0.2,
      );
      crater.fill({ color: CRATER_SCORCH, alpha: 0.7 });
    }
    target.addChild(crater);
    this.decals.push(crater);
  }

  spawnShellCasing(origin: { x: number; y: number }, facing: number, seed: FxSeed): void {
    if (this.disposed) return;
    const end = casingArcEnd(origin, facing, seed);
    // Live phase: arc trail from origin to landing point.
    const live = new Graphics();
    live.moveTo(origin.x, origin.y);
    // Render the arc as a small polyline to give an ejection shape.
    const mx = (origin.x + end.x) / 2;
    const my = (origin.y + end.y) / 2 - end.peakY;
    live.lineTo(mx, my);
    live.lineTo(end.x, end.y);
    live.stroke({ color: CASING_BRASS, alpha: 0.9, width: 0.06 });
    // Casing body at the landing.
    live.circle(end.x, end.y, 0.09);
    live.fill({ color: CASING_BRASS });
    this.push('shell-casing', live, 'easeOut');

    // Decal phase: small rotated brass sliver on the decal layer, fades linearly.
    const target = this.decalLayer ?? this.layer;
    const decal = new Graphics();
    const angle = jitter(seed, 9) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const half = 0.14;
    const thick = 0.05;
    const px = -sin;
    const py = cos;
    decal.moveTo(end.x + cos * half + px * thick, end.y + sin * half + py * thick);
    decal.lineTo(end.x + cos * half - px * thick, end.y + sin * half - py * thick);
    decal.lineTo(end.x - cos * half - px * thick, end.y - sin * half - py * thick);
    decal.lineTo(end.x - cos * half + px * thick, end.y - sin * half + py * thick);
    decal.closePath();
    decal.fill({ color: CASING_BRASS, alpha: 0.95 });
    decal.moveTo(end.x - cos * half, end.y - sin * half);
    decal.lineTo(end.x + cos * half, end.y + sin * half);
    decal.stroke({ color: CASING_SHADOW, alpha: 0.7, width: 0.04 });
    target.addChild(decal);
    this.entries.push({
      kind: 'shell-casing-decal',
      g: decal,
      bornMs: this.elapsedMs,
      ttlMs: TTL_MS['shell-casing-decal'],
      ease: 'linear',
    });
  }

  spawnSmokePuff(at: { x: number; y: number }, seed: FxSeed): void {
    if (this.disposed) return;
    const g = new Graphics();
    const radii = [0.7, 1.0, 1.3];
    for (let i = 0; i < radii.length; i++) {
      const j1 = jitter(seed, i * 2);
      const j2 = jitter(seed, i * 2 + 1);
      g.circle(at.x + j1 * 0.3, at.y + j2 * 0.3, radii[i]);
      g.fill({ color: i % 2 === 0 ? SMOKE_PUFF_LIGHT : SMOKE_PUFF, alpha: 0.5 });
    }
    this.push('smoke-puff', g, 'linear');
  }

  spawnDustPuff(at: { x: number; y: number }, seed: FxSeed, small = false): void {
    if (this.disposed) return;
    const g = new Graphics();
    const r = small ? 0.25 : 0.4;
    const j1 = jitter(seed, 0);
    const j2 = jitter(seed, 1);
    g.circle(at.x + j1 * 0.15, at.y + j2 * 0.15, r);
    g.fill({ color: 0xb8a880, alpha: 0.5 });
    g.circle(at.x - j1 * 0.1, at.y - j2 * 0.1, r * 0.7);
    g.fill({ color: 0x5a4a30, alpha: 0.4 });
    this.push('dust-puff', g, 'easeOut');
  }

  paintBuildingDamage(tileIdx: number, damage: BuildingDamage): void {
    if (this.disposed) return;
    const world = this.world;
    if (!world) return;
    const target = this.decalLayer ?? this.layer;
    const tx = tileIdx % world.width;
    const ty = Math.floor(tileIdx / world.width);
    const worldX = tx * world.tileSizeMeters;
    const worldY = ty * world.tileSizeMeters;
    const size = world.tileSizeMeters;

    const prevLevel = this.paintedBuildingTiles.get(tileIdx) ?? 0;
    if (damage.crackLevel > prevLevel) {
      const g = new Graphics();
      const strokes = damage.crackLevel + 1;
      const seed: FxSeed = { tick: tileIdx, a: damage.crackLevel, b: 0 };
      for (let i = 0; i < strokes; i++) {
        const j1 = jitter(seed, i * 2);
        const j2 = jitter(seed, i * 2 + 1);
        const sx = worldX + size * (0.2 + Math.abs(j1) * 0.6);
        const sy = worldY + size * (0.2 + Math.abs(j2) * 0.6);
        g.moveTo(sx, sy);
        g.lineTo(sx + j1 * size * 0.4, sy + j2 * size * 0.4);
      }
      g.stroke({ color: BUILDING_CRACK, alpha: 0.7, width: 0.08 });
      target.addChild(g);
      this.decals.push(g);
      this.paintedBuildingTiles.set(tileIdx, damage.crackLevel);
    }
    if (damage.rubbled && !this.paintedRubbleTiles.has(tileIdx)) {
      const tint = new Graphics();
      tint.rect(worldX, worldY, size, size);
      tint.fill({ color: RUBBLE_TINT, alpha: 0.55 });
      target.addChild(tint);
      this.decals.push(tint);
      this.paintedRubbleTiles.add(tileIdx);
    }
  }

  countByKind(kind: FxKind): number {
    let n = 0;
    for (const e of this.entries) if (e.kind === kind) n++;
    return n;
  }

  spawnBloodPool(at: { x: number; y: number }, cause: SnapshotDownedCause, seed: FxSeed): void {
    if (this.disposed) return;
    const target = this.decalLayer ?? this.layer;
    const radius = cause === 'combat' ? 1.5 : 0.8;
    const pool = new Graphics();
    const j1 = jitter(seed, 0);
    const j2 = jitter(seed, 1);
    pool.circle(at.x + j1 * 0.15, at.y + j2 * 0.15, radius);
    pool.fill({ color: POOL_BLOOD, alpha: 0.7 });
    pool.circle(at.x - j1 * 0.2, at.y - j2 * 0.2, radius * 0.7);
    pool.fill({ color: BLOOD_POOL, alpha: 0.55 });
    target.addChild(pool);
    this.decals.push(pool);
  }

  ingestEvents(events: readonly SnapshotEvent[], byId: ReadonlyMap<number, SnapshotUnit>): void {
    if (this.disposed) return;
    for (const e of events) {
      if (e.kind === 'unit-fired') {
        const s = byId.get(e.shooter);
        const t = byId.get(e.target);
        if (!s || !t) continue;
        const origin = muzzleOffset(s, 1.5);
        const d = direction({ x: s.x, y: s.y }, { x: t.x, y: t.y });
        const seed: FxSeed = { tick: e.tick, a: e.shooter, b: e.target };
        this.spawnMuzzleFlash(origin, d.angle, seed);
        this.spawnTracer(origin, { x: t.x, y: t.y }, seed);
        this.spawnShellCasing(origin, s.facing, seed);
        const smokeSource = this.atmosphere?.recordFire(s.x, s.y, this.elapsedMs);
        if (smokeSource) {
          this.spawnSmokePuff(
            { x: smokeSource.x, y: smokeSource.y },
            { tick: e.tick, a: e.shooter, b: -1 },
          );
        }
      } else if (e.kind === 'unit-hit') {
        const t = byId.get(e.target);
        if (!t) continue;
        const s = byId.get(e.shooter);
        const travel = s
          ? direction({ x: s.x, y: s.y }, { x: t.x, y: t.y })
          : { nx: Math.cos(t.facing), ny: Math.sin(t.facing), len: 1, angle: t.facing };
        const dir = { nx: travel.nx, ny: travel.ny };
        const seed: FxSeed = { tick: e.tick, a: e.shooter, b: e.target };
        if (e.outcome === 'wound') {
          this.spawnWoundImpact({ x: t.x, y: t.y }, dir, e.zone, seed);
          if (e.woundType === 'fragmentation') {
            this.spawnExplosion({ x: t.x, y: t.y }, seed);
          }
        } else if (e.outcome === 'block') {
          this.spawnBlockSpark({ x: t.x, y: t.y }, dir, seed);
        } else {
          const beyond = { x: t.x + dir.nx * 1.5, y: t.y + dir.ny * 1.5 };
          this.spawnMissDust(beyond, dir, e.reason, seed);
        }
        this.routeBuildingHit(t.x, t.y);
      } else if (e.kind === 'unit-downed') {
        const u = byId.get(e.unitId);
        if (!u) continue;
        this.spawnBloodPool({ x: u.x, y: u.y }, e.cause, { tick: e.tick, a: e.unitId, b: 0 });
      } else if (e.kind === 'noise-emitted') {
        if (e.noiseKind === 'footstep-standing' || e.noiseKind === 'footstep-crouched') {
          this.routeFootstepDust(e.x, e.y, e.tick, e.sourceUnitId, e.noiseKind);
        }
      }
    }
  }

  private routeBuildingHit(x: number, y: number): void {
    if (!this.atmosphere || !this.world) return;
    const tileIdx = this.atmosphere.tileIndexAt(x, y);
    const terrainByte = this.world.base[tileIdx] ?? 0;
    // Building detection moved into scene lookup (buildingId grid) post-COA-2;
    // for now use a heuristic on the new base byte layout (no dedicated
    // 'building' base — building walls are per-tile via buildingId on the
    // sim side). The renderer routes dust/debris on rubble_ground instead.
    const isBuilding = false;
    void terrainByte;
    const damage = this.atmosphere.recordBuildingHit(tileIdx, isBuilding);
    if (damage) this.paintBuildingDamage(tileIdx, damage);
  }

  private routeFootstepDust(
    x: number,
    y: number,
    tick: number,
    sourceId: number,
    kind: 'footstep-standing' | 'footstep-crouched',
  ): void {
    if (!this.world) return;
    const tx = Math.floor(x / this.world.tileSizeMeters);
    const ty = Math.floor(y / this.world.tileSizeMeters);
    if (tx < 0 || ty < 0 || tx >= this.world.width || ty >= this.world.height) return;
    const terrain = this.world.base[ty * this.world.width + tx] ?? 0;
    // Road (1) and rubble_ground (5) produce dust in the new base layout.
    if (terrain !== 1 && terrain !== 5) return;
    this.spawnDustPuff({ x, y }, { tick, a: sourceId, b: terrain }, kind === 'footstep-crouched');
  }

  activeCount(): number {
    return this.entries.length;
  }

  decalCount(): number {
    return this.decals.length;
  }

  private push(kind: FxKind, g: Graphics, ease: Ease): void {
    this.layer.addChild(g);
    this.entries.push({ kind, g, bornMs: this.elapsedMs, ttlMs: TTL_MS[kind], ease });
  }

  private cull(): void {
    let write = 0;
    for (let read = 0; read < this.entries.length; read++) {
      const entry = this.entries[read];
      if (!entry) continue;
      const age = this.elapsedMs - entry.bornMs;
      if (age >= entry.ttlMs) {
        entry.g.destroy();
      } else {
        const t = age / entry.ttlMs;
        let alpha: number;
        if (entry.ease === 'easeOut') {
          alpha = 1 - t * t;
        } else if (entry.ease === 'pulse') {
          alpha = 0.5 + 0.5 * Math.cos(t * Math.PI * 4);
        } else {
          alpha = 1 - t;
        }
        entry.g.alpha = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
        this.entries[write++] = entry;
      }
    }
    this.entries.length = write;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ticker.remove(this.onTick);
    for (const entry of this.entries) entry.g.destroy();
    this.entries.length = 0;
    for (const d of this.decals) d.destroy();
    this.decals.length = 0;
  }
}
