import type { UnitId } from '@shared/ids';
import {
  approxPosJitter,
  effectiveHearingRange,
  HEARD_BEARING_MIN_CONFIDENCE,
  HEARD_MAX_ENTRIES,
  HEARD_TTL_TICKS,
  type Heard,
  hearingConfidence,
  NOISE_LOUDNESS,
  type NoiseKind,
} from './noise';
import type { SimEvent } from './state';
import type { Unit, Vec2 } from './unit';
import { SUPPRESSION_HEAVY_THRESHOLD } from './unit';
import { byteToTerrain, inBounds, tileIndex, type World } from './world';

function listenerTerrain(world: World, pos: Vec2): ReturnType<typeof byteToTerrain> {
  const tx = Math.floor(pos.x / world.tileSizeMeters);
  const ty = Math.floor(pos.y / world.tileSizeMeters);
  if (!inBounds(world, tx, ty)) return 'open';
  return byteToTerrain(world.terrain[tileIndex(world, tx, ty)] ?? 0);
}

function heardFromEvent(
  listener: Unit,
  world: World,
  sourceId: UnitId,
  sourcePos: Vec2,
  noiseKind: NoiseKind,
  tick: number,
): Heard | null {
  const terrain = listenerTerrain(world, listener.position);
  const suppressed = listener.suppression >= SUPPRESSION_HEAVY_THRESHOLD;
  const range = effectiveHearingRange(noiseKind, listener.stats.awareness, terrain, suppressed);
  const dx = sourcePos.x - listener.position.x;
  const dy = sourcePos.y - listener.position.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return null;
  const confidence = hearingConfidence(dist, range);
  if (confidence <= 0) return null;
  const { jitterMeters } = NOISE_LOUDNESS[noiseKind];
  const jitter = approxPosJitter(
    tick,
    listener.id,
    sourceId,
    noiseKind,
    jitterMeters * (1 - confidence),
  );
  const approxPos: Vec2 = { x: sourcePos.x + jitter.x, y: sourcePos.y + jitter.y };
  const bearing =
    confidence >= HEARD_BEARING_MIN_CONFIDENCE
      ? Math.atan2(approxPos.y - listener.position.y, approxPos.x - listener.position.x)
      : null;
  return {
    sourcePos,
    approxPos,
    bearing,
    confidence,
    tick,
    kind: noiseKind,
  };
}

export function updateLastHeard(
  listener: Unit,
  events: readonly SimEvent[],
  world: World,
  tick: number,
): ReadonlyMap<UnitId, Heard> {
  // Panicked units are too scrambled to process sound.
  if (listener.aiState === 'panic') return new Map();

  const next = new Map<UnitId, Heard>();
  for (const [sourceId, heard] of listener.lastHeard) {
    if (tick - heard.tick <= HEARD_TTL_TICKS) next.set(sourceId, heard);
  }

  for (const ev of events) {
    if (ev.kind !== 'noise-emitted') continue;
    if (ev.sourceUnitId === listener.id) continue;
    const candidate = heardFromEvent(
      listener,
      world,
      ev.sourceUnitId,
      ev.pos,
      ev.noiseKind,
      ev.tick,
    );
    if (!candidate) continue;
    const existing = next.get(ev.sourceUnitId);
    if (!existing || candidate.confidence >= existing.confidence) {
      next.set(ev.sourceUnitId, candidate);
    } else if (existing.tick < candidate.tick) {
      // Even a weaker new sample refreshes the tick so the entry doesn't age out.
      next.set(ev.sourceUnitId, { ...existing, tick: candidate.tick });
    }
  }

  if (next.size <= HEARD_MAX_ENTRIES) return next;
  // Drop oldest first.
  const sorted = [...next.entries()].sort((a, b) => b[1].tick - a[1].tick);
  const trimmed = new Map<UnitId, Heard>();
  for (let i = 0; i < Math.min(sorted.length, HEARD_MAX_ENTRIES); i++) {
    const entry = sorted[i];
    trimmed.set(entry[0], entry[1]);
  }
  return trimmed;
}

export function mostRecentHeard(
  unit: Unit,
  currentTick: number,
): { sourceId: UnitId; heard: Heard } | null {
  let best: { sourceId: UnitId; heard: Heard } | null = null;
  for (const [sourceId, heard] of unit.lastHeard) {
    if (currentTick - heard.tick > HEARD_TTL_TICKS) continue;
    if (
      !best ||
      heard.confidence > best.heard.confidence ||
      (heard.confidence === best.heard.confidence && heard.tick > best.heard.tick)
    ) {
      best = { sourceId, heard };
    }
  }
  return best;
}
