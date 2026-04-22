export type TileKey = number;

export type BuildingDamage = {
  hits: number;
  crackLevel: 0 | 1 | 2 | 3;
  rubbled: boolean;
};

export type SmokeSource = {
  readonly x: number;
  readonly y: number;
  readonly intensity: number;
  readonly bornMs: number;
};

export const SMOKE_THRESHOLD_SHOTS = 4;
export const SMOKE_WINDOW_MS = 3000;
export const SMOKE_TILE_RADIUS_METERS = 6;
export const BUILDING_CRACK_THRESHOLDS: readonly [number, number, number] = [2, 5, 9];
export const BUILDING_RUBBLE_THRESHOLD = 14;

type FireCounter = {
  shots: number;
  lastShotMs: number;
  centerX: number;
  centerY: number;
};

export class AtmosphereState {
  private readonly fireCounters = new Map<TileKey, FireCounter>();
  private readonly buildingDamage = new Map<TileKey, BuildingDamage>();
  private readonly worldWidth: number;
  private readonly tileSizeMeters: number;
  private readonly smokeTileSize: number;

  constructor(worldWidth: number, _worldHeight: number, tileSizeMeters: number) {
    this.worldWidth = worldWidth;
    this.tileSizeMeters = tileSizeMeters;
    // Smoke locality is roughly 6m; round to a multiple of tile size.
    this.smokeTileSize = Math.max(1, Math.round(SMOKE_TILE_RADIUS_METERS / tileSizeMeters));
  }

  private smokeKey(x: number, y: number): TileKey {
    const sx = Math.floor(x / this.tileSizeMeters / this.smokeTileSize);
    const sy = Math.floor(y / this.tileSizeMeters / this.smokeTileSize);
    // Bucket key: 16-bit signed Y | 16-bit signed X.
    return ((sy & 0xffff) << 16) | (sx & 0xffff);
  }

  recordFire(x: number, y: number, nowMs: number): SmokeSource | null {
    const key = this.smokeKey(x, y);
    const prev = this.fireCounters.get(key);
    if (prev && nowMs - prev.lastShotMs > SMOKE_WINDOW_MS) {
      this.fireCounters.delete(key);
    }
    const cur = this.fireCounters.get(key);
    if (!cur) {
      this.fireCounters.set(key, { shots: 1, lastShotMs: nowMs, centerX: x, centerY: y });
      return null;
    }
    cur.shots += 1;
    cur.lastShotMs = nowMs;
    // Drift center slightly toward the new shot (running average).
    cur.centerX = cur.centerX * 0.8 + x * 0.2;
    cur.centerY = cur.centerY * 0.8 + y * 0.2;
    if (cur.shots >= SMOKE_THRESHOLD_SHOTS) {
      const source: SmokeSource = {
        x: cur.centerX,
        y: cur.centerY,
        intensity: cur.shots,
        bornMs: nowMs,
      };
      this.fireCounters.delete(key);
      return source;
    }
    return null;
  }

  decay(nowMs: number): void {
    for (const [k, c] of this.fireCounters) {
      if (nowMs - c.lastShotMs > SMOKE_WINDOW_MS) this.fireCounters.delete(k);
    }
  }

  private crackLevelFor(hits: number): 0 | 1 | 2 | 3 {
    if (hits >= BUILDING_CRACK_THRESHOLDS[2]) return 3;
    if (hits >= BUILDING_CRACK_THRESHOLDS[1]) return 2;
    if (hits >= BUILDING_CRACK_THRESHOLDS[0]) return 1;
    return 0;
  }

  recordBuildingHit(tileIdx: TileKey, terrainIsBuilding: boolean): BuildingDamage | null {
    if (!terrainIsBuilding) return null;
    const prev = this.buildingDamage.get(tileIdx);
    const hits = (prev?.hits ?? 0) + 1;
    const crackLevel = this.crackLevelFor(hits);
    const rubbled = hits >= BUILDING_RUBBLE_THRESHOLD;
    const next: BuildingDamage = { hits, crackLevel, rubbled };
    this.buildingDamage.set(tileIdx, next);
    return next;
  }

  getBuildingDamage(tileIdx: TileKey): BuildingDamage | undefined {
    return this.buildingDamage.get(tileIdx);
  }

  allBuildingDamage(): ReadonlyMap<TileKey, BuildingDamage> {
    return this.buildingDamage;
  }

  tileIndexAt(x: number, y: number): TileKey {
    const tx = Math.floor(x / this.tileSizeMeters);
    const ty = Math.floor(y / this.tileSizeMeters);
    return ty * this.worldWidth + tx;
  }

  tileXYOf(tileIdx: TileKey): { tx: number; ty: number } {
    return { tx: tileIdx % this.worldWidth, ty: Math.floor(tileIdx / this.worldWidth) };
  }
}
