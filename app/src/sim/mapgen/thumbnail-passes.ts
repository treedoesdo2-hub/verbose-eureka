// COA-7 tasks #122-125 — image-processing passes used by the thumbnail
// pipeline. These operate on the 2D per-tile byte grids (base, point,
// buildingId) before color conversion; keeping them byte-level lets
// us run cheap cluster/morphological ops without touching RGBA.

// ---- Modal downsample -----------------------------------------------------
// For a block of source pixels covered by one thumbnail pixel we pick
// the single most-common byte. Much cleaner-looking than point
// sampling, which produces salt-and-pepper noise on downsampled maps.

export function modalDownsample(
  src: Uint8Array | Uint16Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array {
  const out = new Uint8Array(dstW * dstH);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;
  // Small histogram reused per cell — 256 bins covers every byte value we
  // expect (base + point kinds stay under 256).
  const hist = new Uint32Array(256);
  for (let dy = 0; dy < dstH; dy++) {
    const sy0 = Math.floor(dy * scaleY);
    const sy1 = Math.max(sy0 + 1, Math.floor((dy + 1) * scaleY));
    for (let dx = 0; dx < dstW; dx++) {
      const sx0 = Math.floor(dx * scaleX);
      const sx1 = Math.max(sx0 + 1, Math.floor((dx + 1) * scaleX));
      hist.fill(0);
      let best = 0;
      let bestCount = 0;
      for (let y = sy0; y < sy1 && y < srcH; y++) {
        for (let x = sx0; x < sx1 && x < srcW; x++) {
          const v = src[y * srcW + x] & 0xff;
          const c = ++hist[v];
          if (c > bestCount) {
            bestCount = c;
            best = v;
          }
        }
      }
      out[dy * dstW + dx] = best;
    }
  }
  return out;
}

// P3.7 — continuous downsample for Uint8ClampedArray (shadingBake).
// Averages source block pixels rather than picking the modal byte —
// shading is a continuous luminance signal, not a categorical kind.
export function downsampleClamped(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dstW * dstH);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;
  for (let dy = 0; dy < dstH; dy++) {
    const sy0 = Math.floor(dy * scaleY);
    const sy1 = Math.max(sy0 + 1, Math.floor((dy + 1) * scaleY));
    for (let dx = 0; dx < dstW; dx++) {
      const sx0 = Math.floor(dx * scaleX);
      const sx1 = Math.max(sx0 + 1, Math.floor((dx + 1) * scaleX));
      let sum = 0;
      let count = 0;
      for (let y = sy0; y < sy1 && y < srcH; y++) {
        for (let x = sx0; x < sx1 && x < srcW; x++) {
          sum += src[y * srcW + x];
          count += 1;
        }
      }
      out[dy * dstW + dx] = count > 0 ? Math.round(sum / count) : 128;
    }
  }
  return out;
}

// ---- Cluster gate pass ----------------------------------------------------
// Scans the downsampled byte grid for single-cell islands of a given
// kind; if smaller than minClusterSize, the cell is reverted to the
// modal surrounding byte. Used to silence the chicken-pox noise that
// arises when modalDownsample leaves orphaned single pixels.

export function clusterGate(
  grid: Uint8Array,
  W: number,
  H: number,
  minClusterSize: number,
): number {
  const visited = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  let flipped = 0;
  for (let i = 0; i < grid.length; i++) {
    if (visited[i]) continue;
    const kind = grid[i];
    let top = 0;
    stack[top++] = i;
    const component: number[] = [];
    while (top > 0) {
      const p = stack[--top];
      if (visited[p] || grid[p] !== kind) continue;
      visited[p] = 1;
      component.push(p);
      const x = p % W;
      const y = (p - x) / W;
      if (x > 0) stack[top++] = p - 1;
      if (x < W - 1) stack[top++] = p + 1;
      if (y > 0) stack[top++] = p - W;
      if (y < H - 1) stack[top++] = p + W;
    }
    if (component.length < minClusterSize) {
      const surroundModal = sampleSurroundingModal(grid, W, H, component, kind);
      for (const p of component) grid[p] = surroundModal;
      flipped += component.length;
    }
  }
  return flipped;
}

function sampleSurroundingModal(
  grid: Uint8Array,
  W: number,
  H: number,
  component: readonly number[],
  avoidKind: number,
): number {
  const hist = new Uint32Array(256);
  for (const p of component) {
    const x = p % W;
    const y = (p - x) / W;
    const neighbors = [
      x > 0 ? p - 1 : -1,
      x < W - 1 ? p + 1 : -1,
      y > 0 ? p - W : -1,
      y < H - 1 ? p + W : -1,
    ];
    for (const n of neighbors) {
      if (n < 0) continue;
      const v = grid[n];
      if (v !== avoidKind) hist[v]++;
    }
  }
  let best = avoidKind;
  let bestCount = 0;
  for (let k = 0; k < 256; k++) {
    if (hist[k] > bestCount) {
      bestCount = hist[k];
      best = k;
    }
  }
  return best;
}

// ---- Morphological open/close --------------------------------------------
// Open: erode then dilate — removes single-pixel bright islands.
// Close: dilate then erode — fills single-pixel holes.
// Operates on a 0/1 mask, not a kind grid.

export function erode(mask: Uint8Array, W: number, H: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (mask[i] === 0) continue;
      let keep = 1;
      if (x > 0 && mask[i - 1] === 0) keep = 0;
      else if (x < W - 1 && mask[i + 1] === 0) keep = 0;
      else if (y > 0 && mask[i - W] === 0) keep = 0;
      else if (y < H - 1 && mask[i + W] === 0) keep = 0;
      out[i] = keep;
    }
  }
  return out;
}

export function dilate(mask: Uint8Array, W: number, H: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (mask[i]) {
        out[i] = 1;
        continue;
      }
      if (x > 0 && mask[i - 1]) out[i] = 1;
      else if (x < W - 1 && mask[i + 1]) out[i] = 1;
      else if (y > 0 && mask[i - W]) out[i] = 1;
      else if (y < H - 1 && mask[i + W]) out[i] = 1;
    }
  }
  return out;
}

export function morphologicalOpen(mask: Uint8Array, W: number, H: number): Uint8Array {
  return dilate(erode(mask, W, H), W, H);
}

export function morphologicalClose(mask: Uint8Array, W: number, H: number): Uint8Array {
  return erode(dilate(mask, W, H), W, H);
}

// ---- Median filter --------------------------------------------------------
// Replaces each cell with the median of its 3×3 neighborhood. Smooths
// out single-pixel spikes without blurring edges the way a Gaussian
// would. Used on covered-kind masks to clean up the final visible
// minimap surface before colorization.

export function medianFilter3x3(grid: Uint8Array, W: number, H: number): Uint8Array {
  const out = new Uint8Array(grid.length);
  const neighborhood = new Uint8Array(9);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          neighborhood[n++] = grid[ny * W + nx];
        }
      }
      out[y * W + x] = pickMedian(neighborhood, n);
    }
  }
  return out;
}

function pickMedian(arr: Uint8Array, n: number): number {
  // Tiny neighborhood — insertion sort is fine.
  const buf = Array.from(arr.subarray(0, n));
  buf.sort((a, b) => a - b);
  return buf[Math.floor(buf.length / 2)];
}
