import { describe, expect, it } from 'vitest';
import { baseToByte, pointToByte, WALK_FOOT, WALK_WHEELED } from '../world';
import { runPipeline, sanityCheckMap } from './pipeline';
import type { MapGenRequest, MapGenResult } from './types';

function req(overrides: Partial<MapGenRequest> = {}): MapGenRequest {
  return {
    seed: 'test-seed-1',
    biome: 'mixed',
    size: 128,
    tileSizeMeters: 1.5,
    generationVersion: 1,
    ...overrides,
  };
}

const WATER_DEEP = baseToByte('water_deep');

describe('mapgen pipeline', () => {
  it('produces byte-identical base grid for the same seed + biome + version', () => {
    const a = runPipeline(req({ seed: 'determinism-1' }));
    const b = runPipeline(req({ seed: 'determinism-1' }));
    expect(a.hash).toBe(b.hash);
    expect(a.base.length).toBe(b.base.length);
    for (let i = 0; i < a.base.length; i++) {
      expect(a.base[i]).toBe(b.base[i]);
    }
  });

  it('produces different base grids for different seeds', () => {
    const a = runPipeline(req({ seed: 'seed-a' }));
    const b = runPipeline(req({ seed: 'seed-b' }));
    expect(a.hash).not.toBe(b.hash);
  });

  it('produces different output across biomes for the same seed', () => {
    const shared = { seed: 'same-seed', size: 128 };
    const a = runPipeline(req({ ...shared, biome: 'urban_sparse' }));
    const b = runPipeline(req({ ...shared, biome: 'rural_open' }));
    expect(a.hash).not.toBe(b.hash);
  });

  // P2.6 — every biome must have a registered density profile that
  // produces hotspots. Catches regressions where a biome falls through
  // to an uninstalled default and maps spawn barren.
  const BIOMES_FOR_HOTSPOT_TEST: MapGenRequest['biome'][] = [
    'urban_dense',
    'urban_sparse',
    'rural_village',
    'rural_open',
    'forest',
    'industrial',
    'mixed',
    'arid',
  ];
  for (const biome of BIOMES_FOR_HOTSPOT_TEST) {
    it(`${biome} extracts ≥3 hotspots at 256²`, () => {
      const r = runPipeline(req({ seed: `hotspot-${biome}`, biome, size: 256 }));
      expect(r.hotspots.length).toBeGreaterThanOrEqual(3);
    });
  }

  // P2.8 — rural_open used to be hit hard by the rear-thirds pre-mask
  // that killed 67% of hotspot capacity (see P2.7). Assert the current
  // counter-to-mask hotspot count exceeds what the old heuristic would
  // have allowed — the old mask zeroed the top + bottom thirds so only
  // a ~middle-third band could host hotspots. At 256² the middle third
  // is 256*85 = ~21760 cells, giving ~2-4 hotspots. The unmasked pipeline
  // should produce ≥6 (roughly 3×).
  it('rural_open 256² produces ≥6 hotspots after rear-third mask removal (P2.8)', () => {
    const r = runPipeline(req({ seed: 'mask-removal-check', biome: 'rural_open', size: 256 }));
    expect(r.hotspots.length).toBeGreaterThanOrEqual(6);
  });

  it('clears spawn SLOT tiles of water and buildings so units can spawn (ADR 014)', () => {
    // ADR 014: clearing is per-slot now, not per-zone. The old test
    // asserted whole rear-third rects were cleared, which also nuked
    // building + tree scatter from the map flanks.
    const r = runPipeline(req());
    for (const s of [...r.unitSlots.team0, ...r.unitSlots.team1]) {
      const i = s.y * r.width + s.x;
      expect(r.base[i]).not.toBe(WATER_DEEP);
      expect(r.buildingId[i]).toBe(0);
      expect((r.walkability[i] & WALK_FOOT) !== 0).toBe(true);
    }
  });

  it('bakes walkability so water is impassable to foot', () => {
    const r = runPipeline(req());
    for (let i = 0; i < r.base.length; i++) {
      if (r.base[i] === WATER_DEEP) {
        expect(r.walkability[i] & WALK_FOOT).toBe(0);
      }
    }
  });

  it('buildings allow infantry passage but block wheeled vehicles', () => {
    const r = runPipeline(req());
    let checked = 0;
    for (let i = 0; i < r.buildingId.length && checked < 20; i++) {
      if (r.buildingId[i] !== 0) {
        // Building interiors: infantry pass, wheeled/tracked blocked.
        expect(r.walkability[i] & WALK_FOOT).not.toBe(0);
        expect(r.walkability[i] & WALK_WHEELED).toBe(0);
        checked++;
      }
    }
  });

  it('emits objective anchors covering extract, defend, secure', () => {
    const r = runPipeline(req());
    const hints = new Set(r.objectiveAnchors.map((a) => a.kindHint));
    expect(hints.has('extract')).toBe(true);
    expect(hints.has('defend')).toBe(true);
    expect(hints.has('secure')).toBe(true);
  });

  it('scales to 512 without throwing', () => {
    const r = runPipeline(req({ size: 512 }));
    expect(r.width).toBe(512);
    expect(r.height).toBe(512);
    expect(r.base.length).toBe(512 * 512);
  });

  it('scales to 1024 within a generous per-gen budget', () => {
    const t0 = performance.now();
    const r = runPipeline(req({ size: 1024 }));
    const elapsed = performance.now() - t0;
    expect(r.width).toBe(1024);
    expect(r.base.length).toBe(1024 * 1024);
    expect(elapsed).toBeLessThan(10000);
  });

  // COA-1 task #48 — density-driven scatter assertions.

  it('populates coverDensity with values in [0, 1]', () => {
    const r = runPipeline(req());
    expect(r.coverDensity.length).toBe(r.width * r.height);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < r.coverDensity.length; i++) {
      const v = r.coverDensity[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
  });

  it('emits at least one hotspot on a mixed 128x128 map', () => {
    const r = runPipeline(req({ seed: 'hotspot-seed', size: 128 }));
    expect(r.hotspots.length).toBeGreaterThan(0);
    expect(r.diagnostics.hotspotsFound).toBe(r.hotspots.length);
  });

  it('exposes a minimum-spanning-tree over hotspots (COA-1 #39)', () => {
    // Hotspot count >=2 ⇒ V-1 MST edges. Edge endpoints must be valid
    // hotspot indices, and distances must be non-negative.
    const r = runPipeline(req({ seed: 'mst-seed', size: 128 }));
    if (r.hotspots.length < 2) {
      expect(r.hotspotAdjacency.length).toBe(0);
      return;
    }
    expect(r.hotspotAdjacency.length).toBe(r.hotspots.length - 1);
    for (const e of r.hotspotAdjacency) {
      expect(e.from).toBeGreaterThanOrEqual(0);
      expect(e.from).toBeLessThan(r.hotspots.length);
      expect(e.to).toBeGreaterThanOrEqual(0);
      expect(e.to).toBeLessThan(r.hotspots.length);
      expect(e.dist).toBeGreaterThanOrEqual(0);
    }
  });

  it('urban_sparse biome scatters debris point-objects around hotspots (COA-1 #40)', () => {
    // scatterDensityDrivenDebris should stamp debris kinds themed to the
    // urban biome (barrels, tyres, rubble piles, empty carts). Verifies
    // the density-driven scatter is wired in and not dormant. Uses
    // urban_sparse because only biomes in DENSITY_PROFILES produce
    // hotspots that debris scatter can anchor to.
    const r = runPipeline(req({ seed: 'urban-debris', biome: 'urban_sparse', size: 192 }));
    const urbanDebrisKinds = new Set<number>([
      pointToByte('barrel'),
      pointToByte('tyres'),
      pointToByte('rubble_pile'),
      pointToByte('cart_empty'),
    ]);
    let debrisCount = 0;
    for (let i = 0; i < r.point.length; i++) {
      if (urbanDebrisKinds.has(r.point[i])) debrisCount++;
    }
    expect(debrisCount).toBeGreaterThan(0);
  });

  it('hotspots never land inside deploy zones', () => {
    const r = runPipeline(req({ seed: 'nomask-seed', size: 128 }));
    for (const h of r.hotspots) {
      const inT0 =
        h.x >= r.deployZones.team0.x &&
        h.x < r.deployZones.team0.x + r.deployZones.team0.w &&
        h.y >= r.deployZones.team0.y &&
        h.y < r.deployZones.team0.y + r.deployZones.team0.h;
      const inT1 =
        h.x >= r.deployZones.team1.x &&
        h.x < r.deployZones.team1.x + r.deployZones.team1.w &&
        h.y >= r.deployZones.team1.y &&
        h.y < r.deployZones.team1.y + r.deployZones.team1.h;
      expect(inT0).toBe(false);
      expect(inT1).toBe(false);
    }
  });

  it('unitSlots are populated for both teams and all on foot-walkable tiles (ADR 014)', () => {
    const r = runPipeline(req({ seed: 'unit-slots-seed', size: 128 }));
    expect(r.unitSlots.team0.length).toBeGreaterThan(0);
    expect(r.unitSlots.team1.length).toBeGreaterThan(0);
    for (const s of [...r.unitSlots.team0, ...r.unitSlots.team1]) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(r.width);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThan(r.height);
      const walk = r.walkability[s.y * r.width + s.x];
      expect((walk & WALK_FOOT) !== 0).toBe(true);
    }
  });

  it('team 0 march entry touches a map edge (ADR 014)', () => {
    const r = runPipeline(req({ seed: 'march-entry-seed', size: 128 }));
    // First squad-0 member is closest to the entry edge. Relaxed threshold
    // (≤3 tiles) because the nudge-to-walkable helper may step inland a
    // little if the direct edge tile is water / impassable.
    const leadSlot = r.unitSlots.team0[0];
    const distToEdge = Math.min(
      leadSlot.x,
      leadSlot.y,
      r.width - 1 - leadSlot.x,
      r.height - 1 - leadSlot.y,
    );
    expect(distToEdge).toBeLessThanOrEqual(3);
  });

  it('coverDensity spans the whole map — no rear-third / deploy-zone mask (ADR 014)', () => {
    // ADR 014 deprecated the deploy-zone density mask. Density is driven
    // by biome + terrain alone; the previous rear-third suppression
    // emptied two-thirds of the map and is no longer applied.
    const r = runPipeline(req({ seed: 'mask-seed', size: 128 }));
    let nonZeroInsideZones = 0;
    for (const zone of [r.deployZones.team0, r.deployZones.team1]) {
      for (let yy = zone.y; yy < zone.y + zone.h; yy++) {
        for (let xx = zone.x; xx < zone.x + zone.w; xx++) {
          if (r.coverDensity[yy * r.width + xx] > 0) nonZeroInsideZones++;
        }
      }
    }
    // Some non-zero density must exist inside zone rects — the terrain
    // generator now fills the full map edge-to-edge.
    expect(nonZeroInsideZones).toBeGreaterThan(0);
  });

  it('clusterMembership allocated and defaults to -1 (unassigned)', () => {
    const r = runPipeline(req());
    expect(r.clusterMembership.length).toBe(r.width * r.height);
    // At this phase of COA-1 no children are assigned yet — all -1.
    for (let i = 0; i < r.clusterMembership.length; i++) {
      expect(r.clusterMembership[i]).toBe(-1);
    }
  });

  it('urban_sparse biome produces different hotspot set than rural_open for the same seed', () => {
    const a = runPipeline(req({ seed: 'biome-sep', biome: 'urban_sparse', size: 128 }));
    const b = runPipeline(req({ seed: 'biome-sep', biome: 'rural_open', size: 128 }));
    // Hotspot counts will diverge; even if counts match, positions won't.
    const toKey = (h: { x: number; y: number }) => `${h.x},${h.y}`;
    const aSet = new Set(a.hotspots.map(toKey));
    const bSet = new Set(b.hotspots.map(toKey));
    let overlap = 0;
    for (const k of aSet) if (bSet.has(k)) overlap++;
    // Large overlap would imply biome-agnostic hotspot extraction — bug.
    expect(overlap).toBeLessThan(Math.max(aSet.size, bSet.size));
  });

  it('guarantees reachability between team0 and team1 deploy zones for 20 seeds', () => {
    const seeds = Array.from({ length: 20 }, (_, i) => `reach-seed-${i}`);
    const biomes: Array<'urban_sparse' | 'rural_open' | 'mixed'> = [
      'urban_sparse',
      'rural_open',
      'mixed',
    ];
    for (const seed of seeds) {
      for (const biome of biomes) {
        const r = runPipeline(req({ seed, biome, size: 96 }));
        const { team0, team1 } = r.deployZones;
        const W = r.width;
        const start = {
          x: Math.floor(team0.x + team0.w / 2),
          y: Math.floor(team0.y + team0.h / 2),
        };
        const goal = {
          x: Math.floor(team1.x + team1.w / 2),
          y: Math.floor(team1.y + team1.h / 2),
        };
        const visited = new Uint8Array(r.width * r.height);
        const queue: number[] = [start.y * W + start.x];
        visited[start.y * W + start.x] = 1;
        let reached = false;
        while (queue.length > 0) {
          const p = queue.shift() as number;
          const x = p % W;
          const y = (p - x) / W;
          if (x === goal.x && y === goal.y) {
            reached = true;
            break;
          }
          const candidates = [
            x > 0 ? p - 1 : -1,
            x < W - 1 ? p + 1 : -1,
            y > 0 ? p - W : -1,
            y < r.height - 1 ? p + W : -1,
          ];
          for (const n of candidates) {
            if (n < 0 || visited[n]) continue;
            if ((r.walkability[n] & WALK_FOOT) === 0) continue;
            visited[n] = 1;
            queue.push(n);
          }
        }
        expect(reached, `seed=${seed} biome=${biome} unreachable`).toBe(true);
      }
    }
  });

  // P2.11 — sanity-check the barren-map guard. Construct an artificial
  // MapGenResult with zero point objects + zero buildings and confirm
  // sanityCheckMap flags it.
  it('sanityCheckMap rejects maps with <0.5% point-object density', () => {
    const size = 64;
    const n = size * size;
    const empty: MapGenResult = {
      request: req({ biome: 'mixed', size }),
      width: size,
      height: size,
      base: new Uint8Array(n), // all open
      point: new Uint8Array(n), // zero points
      edgeN: new Uint8Array(n),
      edgeW: new Uint8Array(n),
      edgeOverrideN: new Uint8Array(n),
      edgeOverrideW: new Uint8Array(n),
      buildingId: new Uint16Array(n),
      walkability: new Uint16Array(n),
      coverProfile: new Uint8Array(n),
      elevationStep: new Uint8Array(n),
      structureHeight: new Uint8Array(n),
      hpN: new Uint16Array(n),
      hpW: new Uint16Array(n),
      hpPoint: new Uint16Array(n),
      buildings: [],
      elevation: new Float32Array(n),
      coverDensity: new Float32Array(n),
      hotspots: [],
      clusterMembership: new Int16Array(n).fill(-1),
      hotspotAdjacency: [],
      dominantLine: null,
      capillaries: [],
      heroLandmark: null,
      deployZones: {
        team0: { x: 0, y: 0, w: 8, h: 8 },
        team1: { x: size - 8, y: size - 8, w: 8, h: 8 },
      },
      objectiveAnchors: [
        { kindHint: 'extract', rect: { x: 30, y: 30, w: 4, h: 4 }, qualityScore: 1 },
        { kindHint: 'defend', rect: { x: 20, y: 20, w: 4, h: 4 }, qualityScore: 1 },
        { kindHint: 'secure', rect: { x: 40, y: 40, w: 4, h: 4 }, qualityScore: 1 },
      ],
      diagnostics: {
        retryCount: 0,
        hotspotsFound: 0,
        hotspotsDropped: 0,
        carvedCells: 0,
        prunedClusters: 0,
        densityScatterChildren: 0,
        densityScatterRejected: 0,
      },
      hash: 0,
      shadingBake: (() => {
        const a = new Uint8ClampedArray(n);
        a.fill(128);
        return a;
      })(),
      contours: new Uint8Array(n),
    };
    const problems = sanityCheckMap(empty);
    expect(problems.some((p) => p.includes('point-object density'))).toBe(true);
  });
});
