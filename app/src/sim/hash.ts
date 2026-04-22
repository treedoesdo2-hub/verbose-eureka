import type { SimState } from './state';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export class Fnv1a {
  private h: number = FNV_OFFSET;

  u32(v: number): this {
    const n = v >>> 0;
    for (let shift = 0; shift < 32; shift += 8) {
      this.byte((n >>> shift) & 0xff);
    }
    return this;
  }

  byte(b: number): this {
    this.h = Math.imul(this.h ^ (b & 0xff), FNV_PRIME) >>> 0;
    return this;
  }

  f64(v: number): this {
    const buf = new ArrayBuffer(8);
    new Float64Array(buf)[0] = v;
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < 8; i++) this.byte(bytes[i]);
    return this;
  }

  str(s: string): this {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      this.byte(c & 0xff);
      this.byte((c >>> 8) & 0xff);
    }
    this.byte(0);
    return this;
  }

  digest(): string {
    return this.h.toString(16).padStart(8, '0');
  }
}

export function hashState(state: SimState): string {
  const h = new Fnv1a();
  h.u32(state.tick);
  for (const v of state.rngSnapshot) h.u32(v);
  h.u32(state.nextWoundId);
  h.byte(state.ended ? 1 : 0);

  const sortedEntries = [...state.units.entries()].sort((a, b) => a[0] - b[0]);
  h.u32(sortedEntries.length);

  for (const [, u] of sortedEntries) {
    h.u32(u.id);
    h.u32(u.teamId);
    h.f64(u.position.x);
    h.f64(u.position.y);
    h.f64(u.facing);
    h.f64(u.velocity.x);
    h.f64(u.velocity.y);
    h.f64(u.bloodVolume);
    h.f64(u.suppression);
    h.f64(u.morale);
    h.str(u.action.kind);
    h.str(u.aiState);
    h.str(u.stance);
    h.byte(u.alerted ? 1 : 0);
    const sortedLastSeen = [...u.lastSeen.entries()].sort((a, b) => a[0] - b[0]);
    h.u32(sortedLastSeen.length);
    for (const [targetId, seen] of sortedLastSeen) {
      h.u32(targetId);
      h.f64(seen.pos.x);
      h.f64(seen.pos.y);
      h.u32(seen.tick);
    }
    const sortedLastHeard = [...u.lastHeard.entries()].sort((a, b) => a[0] - b[0]);
    h.u32(sortedLastHeard.length);
    for (const [sourceId, heard] of sortedLastHeard) {
      h.u32(sourceId);
      h.f64(heard.approxPos.x);
      h.f64(heard.approxPos.y);
      h.byte(heard.bearing === null ? 0 : 1);
      h.f64(heard.bearing ?? 0);
      h.f64(heard.confidence);
      h.u32(heard.tick);
      h.str(heard.kind);
    }
    h.u32(u.wounds.length);
    for (const w of u.wounds) {
      h.u32(w.id);
      h.str(w.zone);
      h.str(w.type);
      h.str(w.severity);
      h.f64(w.severityPct);
      h.str(w.treatment);
      h.f64(w.bleedRatePerSec);
      h.u32(w.tickInflicted);
    }
  }

  return h.digest();
}
