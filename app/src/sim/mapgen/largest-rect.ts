// COA-5 task #97 — largest open rectangle (LOR) search over a boolean
// mask. The spawn placer uses this to find biggest passable rectangles
// in the rear third of the map for each team.
//
// Algorithm: histogram-stack maximal rectangle (Lee's algorithm). O(W*H)
// for a single LOR. For top-K extraction we iteratively zero out the
// winning rect and re-run, so top-K is O(K * W * H). Fine for K=5-10
// and the masked regions in typical deploy searches.

export type Rect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly area: number;
};

// Largest rectangle of `1`s in a 0/1 mask (W × H). Returns { x, y, w, h,
// area }. If the mask has no 1s, w/h/area are 0.
export function largestRectangle(mask: Uint8Array, W: number, H: number): Rect {
  // Convert the 0/1 mask into per-column heights.
  const heights = new Int32Array(W);
  let best: Rect = { x: 0, y: 0, w: 0, h: 0, area: 0 };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      heights[x] = mask[y * W + x] ? heights[x] + 1 : 0;
    }
    // Scan the histogram row-by-row with the monotonic-stack trick.
    const stack: number[] = [];
    for (let x = 0; x <= W; x++) {
      const curHeight = x === W ? 0 : heights[x];
      while (stack.length > 0 && heights[stack[stack.length - 1]] > curHeight) {
        const topIdx = stack.pop()!;
        const h = heights[topIdx];
        const left = stack.length === 0 ? 0 : stack[stack.length - 1] + 1;
        const w = x - left;
        const area = w * h;
        if (area > best.area) {
          best = { x: left, y: y - h + 1, w, h, area };
        }
      }
      stack.push(x);
    }
  }
  return best;
}

// Find the top-K largest rectangles by area. Each result's footprint is
// zeroed in a scratch copy of the mask before the next iteration so the
// K rects are spatially disjoint.
export function topKLargestRectangles(
  mask: Uint8Array,
  W: number,
  H: number,
  k: number,
): Rect[] {
  const scratch = new Uint8Array(mask);
  const out: Rect[] = [];
  for (let i = 0; i < k; i++) {
    const r = largestRectangle(scratch, W, H);
    if (r.area === 0) break;
    out.push(r);
    // Zero out the rect in the scratch mask to expose the next candidate.
    for (let yy = r.y; yy < r.y + r.h; yy++) {
      for (let xx = r.x; xx < r.x + r.w; xx++) {
        scratch[yy * W + xx] = 0;
      }
    }
  }
  return out;
}

// Restrict a mask to a subrect — cells outside the subrect become 0.
// Used by the spawn placer to constrain LOR search to a rear third or
// other axis-derived region without copying the mask.
export function maskToSubrect(
  src: Uint8Array,
  W: number,
  H: number,
  sub: { x: number; y: number; w: number; h: number },
): Uint8Array {
  const out = new Uint8Array(W * H);
  const x1 = Math.min(W, sub.x + sub.w);
  const y1 = Math.min(H, sub.y + sub.h);
  for (let y = Math.max(0, sub.y); y < y1; y++) {
    for (let x = Math.max(0, sub.x); x < x1; x++) {
      out[y * W + x] = src[y * W + x];
    }
  }
  return out;
}
