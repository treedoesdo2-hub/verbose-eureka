import type { Contract } from '@schema/contract';
import { CONTRACT_SIZE_TILES } from '@schema/contract';
import type { BiomeId } from '@schema/map';
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
  // Extract/defend contracts suggest rural zones (LZ, farmhouse); eliminate
  // contracts bias urban. Secure splits down the middle (mixed).
  const kinds = new Set(contract.objectives.map((o) => o.kind));
  if (kinds.has('extract') || kinds.has('defend')) return 'rural_open';
  if (kinds.has('eliminate') && !kinds.has('secure')) return 'urban_sparse';
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
