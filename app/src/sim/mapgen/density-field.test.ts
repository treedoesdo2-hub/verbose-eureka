import { describe, expect, it } from 'vitest';
import {
  DENSITY_PROFILES,
  generateCoverDensity,
  MIXED_DENSITY,
  RURAL_OPEN_DENSITY,
  totalDensity,
  URBAN_SPARSE_DENSITY,
} from './density-field';
import {
  extractHotspots,
  routeAdjacencyMST,
  scatterClustersDensityDriven,
} from './density-scatter';
import { gaussian2D, makeRng } from './noise';

function uniformField(N: number, v: number): Float32Array {
  const f = new Float32Array(N);
  f.fill(v);
  return f;
}

describe('density-field — generateCoverDensity', () => {
  it('produces N values in [0, 1] for a small map', () => {
    const W = 32;
    const H = 32;
    const N = W * H;
    const elev = uniformField(N, 0.5);
    const fert = uniformField(N, 0.7);
    const field = generateCoverDensity(MIXED_DENSITY, W, H, elev, fert, 123);
    expect(field.length).toBe(N);
    for (let i = 0; i < N; i++) {
      expect(field[i]).toBeGreaterThanOrEqual(0);
      expect(field[i]).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for the same seed', () => {
    const W = 16;
    const H = 16;
    const N = W * H;
    const elev = uniformField(N, 0.5);
    const fert = uniformField(N, 0.7);
    const a = generateCoverDensity(MIXED_DENSITY, W, H, elev, fert, 42);
    const b = generateCoverDensity(MIXED_DENSITY, W, H, elev, fert, 42);
    expect(a).toEqual(b);
  });

  it('differs for different seeds', () => {
    const W = 16;
    const H = 16;
    const N = W * H;
    const elev = uniformField(N, 0.5);
    const fert = uniformField(N, 0.7);
    const a = generateCoverDensity(MIXED_DENSITY, W, H, elev, fert, 1);
    const b = generateCoverDensity(MIXED_DENSITY, W, H, elev, fert, 2);
    let differ = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differ++;
    expect(differ).toBeGreaterThan(N / 4);
  });

  it('elevation band gating zeroes tiles outside the band', () => {
    const W = 16;
    const H = 16;
    const N = W * H;
    const elev = uniformField(N, 0.99); // above urban band [0.1, 0.9]
    const fert = uniformField(N, 0.3);
    const field = generateCoverDensity(URBAN_SPARSE_DENSITY, W, H, elev, fert, 5);
    for (let i = 0; i < N; i++) expect(Math.abs(field[i])).toBeLessThan(1e-6);
  });

  it('fertility gating zeroes tiles outside the affinity (forest needs fertility)', () => {
    const W = 16;
    const H = 16;
    const N = W * H;
    const elev = uniformField(N, 0.5);
    const fert = uniformField(N, 0.05); // well below rural lo=0.35
    const field = generateCoverDensity(RURAL_OPEN_DENSITY, W, H, elev, fert, 5);
    // fertility smoothstep returns 0 below lo → density × 0.
    for (let i = 0; i < N; i++) expect(Math.abs(field[i])).toBeLessThan(1e-6);
  });

  it('rejects mismatched elevation / fertility arrays', () => {
    expect(() =>
      generateCoverDensity(MIXED_DENSITY, 8, 8, new Float32Array(16), new Float32Array(64), 1),
    ).toThrow();
  });
});

describe('density-field — extractHotspots', () => {
  it('picks the single global max from a flat-except-one field', () => {
    const W = 16;
    const H = 16;
    const N = W * H;
    const field = new Float32Array(N); // zero
    field[5 * W + 7] = 0.9;
    const hs = extractHotspots(field, W, H);
    expect(hs.length).toBe(1);
    expect(hs[0].x).toBe(7);
    expect(hs[0].y).toBe(5);
    expect(hs[0].strength).toBeCloseTo(0.9, 5);
  });

  it('respects minSeparation to drop clustered candidates', () => {
    const W = 16;
    const H = 16;
    const N = W * H;
    const field = new Float32Array(N);
    // Two strong peaks 2 tiles apart — minSeparation=6 drops the weaker.
    field[5 * W + 5] = 0.9;
    field[5 * W + 7] = 0.85;
    const hs = extractHotspots(field, W, H, 3, 0.3, 6);
    expect(hs.length).toBe(1);
    expect(hs[0].strength).toBeCloseTo(0.9, 5);
  });

  it('drops hotspots below minStrength', () => {
    const W = 16;
    const H = 16;
    const N = W * H;
    const field = new Float32Array(N);
    field[5 * W + 5] = 0.1;
    const hs = extractHotspots(field, W, H, 3, 0.35);
    expect(hs.length).toBe(0);
  });
});

describe('density-field — scatterClustersDensityDriven', () => {
  it('places children around each hotspot respecting density threshold', () => {
    const W = 32;
    const H = 32;
    const N = W * H;
    const field = new Float32Array(N);
    // Circular density disc around (16, 16) radius ~6.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - 16, y - 16);
        field[y * W + x] = d < 6 ? 0.8 : 0.05;
      }
    }
    const hotspots = [{ x: 16, y: 16, strength: 0.8, id: 0 }];
    const rng = makeRng(7);
    const children = scatterClustersDensityDriven(hotspots, field, W, H, {
      childrenPerHotspot: 10,
      sigmaTiles: 2,
      maxAttemptsPerChild: 20,
      minDensityForChild: 0.4,
    }, rng);
    expect(children.length).toBeGreaterThan(0);
    for (const c of children) {
      expect(field[c.y * W + c.x]).toBeGreaterThanOrEqual(0.4);
      expect(c.clusterId).toBe(0);
    }
  });
});

describe('density-field — routeAdjacencyMST', () => {
  it('returns V-1 edges for V hotspots', () => {
    const hs = [
      { x: 0, y: 0, strength: 1, id: 0 },
      { x: 10, y: 0, strength: 1, id: 1 },
      { x: 0, y: 10, strength: 1, id: 2 },
      { x: 10, y: 10, strength: 1, id: 3 },
    ];
    const edges = routeAdjacencyMST(hs);
    expect(edges.length).toBe(3);
    // Edges cover all vertices collectively.
    const covered = new Set<number>();
    for (const e of edges) {
      covered.add(e.from);
      covered.add(e.to);
    }
    expect(covered.size).toBe(4);
  });

  it('returns empty for 0 or 1 hotspots', () => {
    expect(routeAdjacencyMST([])).toEqual([]);
    expect(routeAdjacencyMST([{ x: 0, y: 0, strength: 1, id: 0 }])).toEqual([]);
  });
});

describe('density-field — gaussian2D determinism', () => {
  it('produces identical samples for the same RNG seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 20; i++) {
      expect(gaussian2D(a, 1)).toEqual(gaussian2D(b, 1));
    }
  });

  it('samples roughly centered at 0 with sigma=1 over 1000 draws', () => {
    const rng = makeRng(11);
    let sum = 0;
    let sumSq = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const g = gaussian2D(rng, 1);
      sum += g.x;
      sumSq += g.x * g.x;
    }
    const mean = sum / N;
    const variance = sumSq / N - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.15); // close to 0
    expect(variance).toBeGreaterThan(0.6);
    expect(variance).toBeLessThan(1.4);
  });
});

describe('density-field — totalDensity + DENSITY_PROFILES registry', () => {
  it('totalDensity sums a small field correctly', () => {
    const f = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    expect(totalDensity(f)).toBeCloseTo(1.0);
  });

  it('DENSITY_PROFILES exposes the three active biomes', () => {
    expect(DENSITY_PROFILES.urban_sparse).toBe(URBAN_SPARSE_DENSITY);
    expect(DENSITY_PROFILES.rural_open).toBe(RURAL_OPEN_DENSITY);
    expect(DENSITY_PROFILES.mixed).toBe(MIXED_DENSITY);
  });
});
