// COA-1 density-driven cluster scatter — phase 2 of the density pipeline.
//
// generateCoverDensity (density-field.ts) produces a Float32 per-tile
// field. This file extracts local-max hotspots, connects them with an
// MST for route adjacency, and scatters cluster children around each
// hotspot using Gaussian offsets + rejection sampling against the field.

import { gaussian2D, type Rng } from './noise';

export type Hotspot = {
  readonly x: number;
  readonly y: number;
  readonly strength: number; // raw density value at this tile
  // Index of the hotspot in the extractHotspots output array; used as
  // clusterMembership key when scattering children.
  readonly id: number;
};

export type ScatterParams = {
  // Expected number of children per hotspot; actual scatter count varies
  // with hotspot strength (strong hotspot → more children).
  readonly childrenPerHotspot: number;
  // Gaussian sigma (in tiles) for child offset around hotspot centroid.
  readonly sigmaTiles: number;
  // Max attempts per child before giving up (rejection sampling budget).
  readonly maxAttemptsPerChild: number;
  // Rejection threshold: child sample x,y must have density >= this to
  // accept. Keeps children inside the cluster footprint.
  readonly minDensityForChild: number;
};

/**
 * Non-maximum-suppression local-max extraction over the density field.
 * A tile is a hotspot iff its density is strictly greater than all 8
 * neighbors within `radius` tiles (skipping neighbors past the map edge).
 * Hotspots below `minStrength` are dropped.
 *
 * @param field density field produced by generateCoverDensity
 * @param width / height map dims
 * @param radius NMS radius in tiles (default 3)
 * @param minStrength density floor below which hotspots are rejected
 * @param minSeparation minimum tile distance between accepted hotspots;
 *   post-NMS filter applied greedily by descending strength.
 */
export function extractHotspots(
  field: Float32Array,
  width: number,
  height: number,
  radius = 3,
  // P4.1 — lowered from 0.35 to 0.20. With the rear-thirds mask removed
  // (P2.7), hotspots have more room to land; relaxing the strength floor
  // lets biomes like rural_open and arid (low density multiplier)
  // surface enough anchors to populate the map.
  minStrength = 0.20,
  minSeparation = 6,
): Hotspot[] {
  const candidates: Hotspot[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const v = field[i];
      if (v < minStrength) continue;
      let isMax = true;
      outer: for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (field[ny * width + nx] > v) {
            isMax = false;
            break outer;
          }
        }
      }
      if (isMax) {
        candidates.push({ x, y, strength: v, id: -1 });
      }
    }
  }

  // Greedy min-separation pass — sort by strength descending, keep a hotspot
  // only if it's at least `minSeparation` tiles from all previously-kept
  // hotspots. Produces a nicely spaced hotspot set.
  candidates.sort((a, b) => b.strength - a.strength);
  const kept: Hotspot[] = [];
  const sepSq = minSeparation * minSeparation;
  for (const c of candidates) {
    let ok = true;
    for (const k of kept) {
      const dx = c.x - k.x;
      const dy = c.y - k.y;
      if (dx * dx + dy * dy < sepSq) {
        ok = false;
        break;
      }
    }
    if (ok) kept.push({ ...c, id: kept.length });
  }
  return kept;
}

/**
 * Scatter children around hotspots using Gaussian offsets + rejection
 * sampling against the density field. Returns an array of {x, y,
 * clusterId} — caller stamps whichever point kind is appropriate for
 * the biome / cluster type at each returned tile.
 */
export function scatterClustersDensityDriven(
  hotspots: readonly Hotspot[],
  field: Float32Array,
  width: number,
  height: number,
  params: ScatterParams,
  rng: Rng,
): { x: number; y: number; clusterId: number }[] {
  const out: { x: number; y: number; clusterId: number }[] = [];
  for (const h of hotspots) {
    // Child count scales with hotspot strength: strong → full count.
    const count = Math.max(1, Math.round(params.childrenPerHotspot * h.strength));
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < params.maxAttemptsPerChild; attempt++) {
        const g = gaussian2D(rng, params.sigmaTiles, params.sigmaTiles);
        const cx = Math.round(h.x + g.x);
        const cy = Math.round(h.y + g.y);
        if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
        const density = field[cy * width + cx];
        if (density < params.minDensityForChild) continue;
        out.push({ x: cx, y: cy, clusterId: h.id });
        break;
      }
    }
  }
  return out;
}

/**
 * Minimum-spanning-tree adjacency over the hotspot set. Each edge is a
 * pair of hotspot indices + the Euclidean distance between them.
 * Downstream callers use this to route dominant lines (roads / rivers /
 * hedgerow spines) between hotspots, preserving spatial adjacency.
 *
 * Prim's algorithm — O(V²), fine up to hundreds of hotspots.
 */
export function routeAdjacencyMST(
  hotspots: readonly Hotspot[],
): { from: number; to: number; dist: number }[] {
  const V = hotspots.length;
  if (V <= 1) return [];
  const inTree = new Uint8Array(V);
  const minDist = new Float32Array(V);
  const minFrom = new Int32Array(V);
  minDist.fill(Number.POSITIVE_INFINITY);
  minFrom.fill(-1);
  minDist[0] = 0;

  const edges: { from: number; to: number; dist: number }[] = [];

  for (let step = 0; step < V; step++) {
    // Pick the not-yet-in-tree vertex with the smallest key.
    let u = -1;
    let best = Number.POSITIVE_INFINITY;
    for (let v = 0; v < V; v++) {
      if (!inTree[v] && minDist[v] < best) {
        best = minDist[v];
        u = v;
      }
    }
    if (u === -1) break;
    inTree[u] = 1;
    if (minFrom[u] !== -1) {
      edges.push({ from: minFrom[u], to: u, dist: minDist[u] });
    }

    // Relax edges from u.
    for (let v = 0; v < V; v++) {
      if (inTree[v]) continue;
      const dx = hotspots[u].x - hotspots[v].x;
      const dy = hotspots[u].y - hotspots[v].y;
      const d = Math.hypot(dx, dy);
      if (d < minDist[v]) {
        minDist[v] = d;
        minFrom[v] = u;
      }
    }
  }

  return edges;
}
