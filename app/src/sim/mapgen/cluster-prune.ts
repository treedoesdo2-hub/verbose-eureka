// COA-3 task #51 — generic flood-fill cluster identification + pruning.
//
// Given a predicate over tile indices (e.g. "is this tile a forest point?"),
// floodComponents returns each 4-connected connected component as a
// ClusterInfo object with footprint, bounding box, and centroid. Callers
// then prune by minimum size, elongation ratio, or proximity to deploy
// zones.

export type ClusterInfo = {
  readonly id: number;
  readonly tiles: readonly number[]; // linear tile indices (y*W + x)
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly centroidX: number;
  readonly centroidY: number;
};

// 4-connected flood-fill. For each tile where `predicate(i)` is true, we
// group tiles into connected components. Returns one ClusterInfo per
// component, id assigned in discovery order.
export function floodComponents(
  W: number,
  H: number,
  predicate: (idx: number) => boolean,
): ClusterInfo[] {
  const visited = new Uint8Array(W * H);
  const out: ClusterInfo[] = [];
  let id = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (visited[i]) continue;
      if (!predicate(i)) {
        visited[i] = 1;
        continue;
      }
      const component: number[] = [];
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let sumX = 0;
      let sumY = 0;
      const queue: number[] = [i];
      visited[i] = 1;
      while (queue.length > 0) {
        const cur = queue.shift() as number;
        const cx = cur % W;
        const cy = (cur - cx) / W;
        component.push(cur);
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        // 4-neighborhood.
        const neighbors = [
          cx > 0 ? cur - 1 : -1,
          cx < W - 1 ? cur + 1 : -1,
          cy > 0 ? cur - W : -1,
          cy < H - 1 ? cur + W : -1,
        ];
        for (const n of neighbors) {
          if (n < 0 || visited[n]) continue;
          visited[n] = 1;
          if (predicate(n)) queue.push(n);
        }
      }
      out.push({
        id: id++,
        tiles: component,
        minX,
        minY,
        maxX,
        maxY,
        centroidX: sumX / component.length,
        centroidY: sumY / component.length,
      });
    }
  }
  return out;
}

// Remove (mutate away) components smaller than `minSize`. Returns the
// number of clusters pruned. mutator is called per tile of each dropped
// cluster so the caller can clear the grid byte / walkability / HP slot.
export function pruneSmallClusters(
  clusters: readonly ClusterInfo[],
  minSize: number,
  mutator: (tileIdx: number) => void,
): number {
  let pruned = 0;
  for (const c of clusters) {
    if (c.tiles.length < minSize) {
      for (const t of c.tiles) mutator(t);
      pruned++;
    }
  }
  return pruned;
}

// Remove components whose footprint is too elongated (thin strips of
// single-tile-width forest patches look like plantation rows, not
// terrain). elongation = max(w, h) / min(w, h); default threshold 6 means
// a 6-tile-long, 1-tile-wide strip gets dropped.
export function pruneElongatedClusters(
  clusters: readonly ClusterInfo[],
  maxElongation: number,
  mutator: (tileIdx: number) => void,
): number {
  let pruned = 0;
  for (const c of clusters) {
    const w = c.maxX - c.minX + 1;
    const h = c.maxY - c.minY + 1;
    const minDim = Math.min(w, h);
    if (minDim === 0) continue;
    const elong = Math.max(w, h) / minDim;
    if (elong > maxElongation) {
      for (const t of c.tiles) mutator(t);
      pruned++;
    }
  }
  return pruned;
}
