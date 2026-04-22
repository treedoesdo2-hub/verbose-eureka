import type { Contract } from '@schema/contract';
import { CONTRACT_SIZE_TILES } from '@schema/contract';
import type { BiomeId } from '@schema/map';
import type { HeroLandmark } from './hero-landmark';
import type { MapGenRequest, ObjectiveAnchor } from './types';

// Pillar A: derive a MapGenRequest from a Contract. Honors contract-authored
// biomeHint + sizeHint; falls back to a heuristic based on faction + objective
// mix when unset.
export function mapGenRequestFromContract(
  contract: Contract,
  tileSizeMeters: number,
  generationVersion: number,
): MapGenRequest {
  const mods = contract.modifiers;
  const biome = mods.biomeHint ?? pickBiomeHeuristic(contract);
  const size = CONTRACT_SIZE_TILES[mods.sizeHint];
  return {
    seed: contract.id,
    biome,
    size,
    tileSizeMeters,
    generationVersion,
  };
}

function pickBiomeHeuristic(contract: Contract): BiomeId {
  // Extract/defend contracts suggest rural zones (LZ, farmhouse). Secure
  // contracts tend to be urban (holding a building, intersection). Mixed
  // stays the default catch-all.
  const kinds = new Set(contract.objectives.map((o) => o.kind));
  if (kinds.has('extract') || kinds.has('defend')) return 'rural_open';
  if (kinds.has('secure')) return 'urban_sparse';
  return 'mixed';
}

// Bind each ContractObjective to the best-matching ObjectiveAnchor. Returns
// a map from objective-id to anchor rect in tile coordinates.
export function bindObjectivesToAnchors(
  contract: Contract,
  anchors: readonly ObjectiveAnchor[],
): Map<string, { x: number; y: number; w: number; h: number }> {
  const out = new Map<string, { x: number; y: number; w: number; h: number }>();
  const usedAnchors = new Set<number>();
  for (const obj of contract.objectives) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < anchors.length; i++) {
      if (usedAnchors.has(i)) continue;
      const a = anchors[i];
      const kindMatch = a.kindHint === obj.kind ? 1 : 0;
      const score = kindMatch * 10 + a.qualityScore;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      out.set(obj.id, { ...anchors[bestIdx].rect });
      usedAnchors.add(bestIdx);
    }
  }
  return out;
}

// COA-4 task #90 — briefing token interpolation. Contract briefing
// strings may embed {landmark} or {landmark_short} tokens that bind to
// the generated hero landmark at runtime so mission text references the
// actual named feature ("seize Refinery Bravo" → "seize Refinery
// Hotel-7" for this seed). Unknown tokens are left in place so authors
// can see them during review.
const LANDMARK_TOKENS: Record<string, (l: HeroLandmark) => string> = {
  '{landmark}': (l) => l.name,
  '{landmark_short}': (l) => l.shortName,
};

export function interpolateBriefing(
  briefing: string,
  landmark: HeroLandmark | null,
): string {
  if (!landmark) return briefing;
  let out = briefing;
  for (const [token, resolve] of Object.entries(LANDMARK_TOKENS)) {
    if (out.includes(token)) out = out.split(token).join(resolve(landmark));
  }
  return out;
}

// COA-4 task #90 — when a contract's briefing explicitly references the
// hero landmark and carries a 'secure' objective, snap the secure
// anchor to the landmark's bounding box so the waypoint reads clean on
// the map and matches the text. Returns a rect or null if the landmark
// has no footprint.
export function secureAnchorFromLandmark(
  landmark: HeroLandmark | null,
): { x: number; y: number; w: number; h: number } | null {
  if (!landmark || landmark.footprint.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of landmark.footprint) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// True if the briefing references any landmark token (caller uses this
// to decide whether to route the secure objective to the landmark).
export function briefingReferencesLandmark(briefing: string): boolean {
  for (const token of Object.keys(LANDMARK_TOKENS)) {
    if (briefing.includes(token)) return true;
  }
  return false;
}
