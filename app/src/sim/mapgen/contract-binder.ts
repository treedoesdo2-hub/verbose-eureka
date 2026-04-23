import type { Contract } from '@schema/contract';
import { CONTRACT_SIZE_TILES } from '@schema/contract';
import type { BiomeId } from '@schema/map';
import type { HeroLandmark } from './hero-landmark';
import type { MapGenRequest, ObjectiveAnchor } from './types';

// Pillar A: derive a MapGenRequest from a Contract. Honors contract-authored
// biomeHint + sizeHint; falls back to a heuristic based on faction + objective
// mix when unset.
//
// `runSeed` (optional) mixes a per-playthrough seed into the map seed so the
// same contract yields a fresh map on every Deploy. Omit it (or pass undefined)
// to get the stable contract-only seed — used by tests that want
// deterministic fixtures and by UI contexts that don't yet know the
// playthrough seed.
export function mapGenRequestFromContract(
  contract: Contract,
  tileSizeMeters: number,
  generationVersion: number,
  runSeed?: number | string,
): MapGenRequest {
  const mods = contract.modifiers;
  const biome = mods.biomeHint ?? pickBiomeHeuristic(contract);
  const size = CONTRACT_SIZE_TILES[mods.sizeHint];
  const seed = runSeed !== undefined ? `${contract.id}:${runSeed}` : contract.id;
  return {
    seed,
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

// Generic fallbacks used when a landmark hasn't been rolled yet (e.g.,
// the contract board shows all contracts at once with no per-card
// pipeline run). Keeps the copy readable instead of leaking literal
// `{landmark}` tokens to the player.
const LANDMARK_FALLBACKS: Record<string, string> = {
  '{landmark}': 'the target',
  '{landmark_short}': 'the target',
};

export function interpolateBriefing(
  briefing: string,
  landmark: HeroLandmark | null,
): string {
  let out = briefing;
  for (const [token, resolve] of Object.entries(LANDMARK_TOKENS)) {
    if (!out.includes(token)) continue;
    const replacement = landmark ? resolve(landmark) : LANDMARK_FALLBACKS[token];
    out = out.split(token).join(replacement);
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
