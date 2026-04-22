import type { SnapshotEvent, SnapshotUnit } from '@shared/snapshot';
import { type Container, Graphics, type Ticker } from 'pixi.js';

type FxKind = 'tracer' | 'wound' | 'block' | 'miss';

type FxEntry = {
  kind: FxKind;
  g: Graphics;
  bornMs: number;
  ttlMs: number;
};

const TTL_MS: Record<FxKind, number> = {
  tracer: 150,
  wound: 300,
  block: 200,
  miss: 150,
};

export class FxEmitter {
  private readonly layer: Container;
  private readonly ticker: Ticker;
  private readonly entries: FxEntry[] = [];
  private elapsedMs = 0;
  private readonly onTick: (t: Ticker) => void;
  private disposed = false;

  constructor(layer: Container, ticker: Ticker) {
    this.layer = layer;
    this.ticker = ticker;
    this.onTick = (t: Ticker) => {
      this.elapsedMs += t.deltaMS;
      this.cull();
    };
    ticker.add(this.onTick);
  }

  spawnTracer(
    from: { x: number; y: number },
    to: { x: number; y: number },
    color = 0xffdd55,
  ): void {
    if (this.disposed) return;
    const g = new Graphics();
    g.moveTo(from.x, from.y);
    g.lineTo(to.x, to.y);
    g.stroke({ color, alpha: 0.85, width: 0.18 });
    this.layer.addChild(g);
    this.entries.push({ kind: 'tracer', g, bornMs: this.elapsedMs, ttlMs: TTL_MS.tracer });
  }

  spawnImpact(at: { x: number; y: number }, kind: 'wound' | 'block' | 'miss'): void {
    if (this.disposed) return;
    const g = new Graphics();
    if (kind === 'wound') {
      g.circle(at.x, at.y, 1.2);
      g.fill({ color: 0xff3030, alpha: 0.7 });
      g.circle(at.x, at.y, 0.5);
      g.fill({ color: 0xffd060, alpha: 0.9 });
    } else if (kind === 'block') {
      g.circle(at.x, at.y, 0.9);
      g.stroke({ color: 0xf0c060, alpha: 0.9, width: 0.2 });
      g.moveTo(at.x - 0.8, at.y - 0.8);
      g.lineTo(at.x + 0.8, at.y + 0.8);
      g.moveTo(at.x + 0.8, at.y - 0.8);
      g.lineTo(at.x - 0.8, at.y + 0.8);
      g.stroke({ color: 0xfff0a0, alpha: 0.8, width: 0.15 });
    } else {
      g.circle(at.x, at.y, 0.6);
      g.fill({ color: 0xaaaaaa, alpha: 0.45 });
    }
    this.layer.addChild(g);
    this.entries.push({ kind, g, bornMs: this.elapsedMs, ttlMs: TTL_MS[kind] });
  }

  ingestEvents(events: readonly SnapshotEvent[], byId: ReadonlyMap<number, SnapshotUnit>): void {
    if (this.disposed) return;
    for (const e of events) {
      if (e.kind === 'unit-fired') {
        const s = byId.get(e.shooter);
        const t = byId.get(e.target);
        if (!s || !t) continue;
        this.spawnTracer({ x: s.x, y: s.y }, { x: t.x, y: t.y });
      } else if (e.kind === 'unit-hit') {
        const t = byId.get(e.target);
        if (!t) continue;
        this.spawnImpact({ x: t.x, y: t.y }, e.outcome);
      }
    }
  }

  activeCount(): number {
    return this.entries.length;
  }

  private cull(): void {
    let write = 0;
    for (let read = 0; read < this.entries.length; read++) {
      const entry = this.entries[read];
      if (!entry) continue;
      if (this.elapsedMs - entry.bornMs >= entry.ttlMs) {
        entry.g.destroy();
      } else {
        const age = this.elapsedMs - entry.bornMs;
        const alpha = 1 - age / entry.ttlMs;
        entry.g.alpha = alpha < 0 ? 0 : alpha;
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
  }
}
