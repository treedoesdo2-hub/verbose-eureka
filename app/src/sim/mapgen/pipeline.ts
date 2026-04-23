import type { BiomeId, PointObjectKind, TerrainBase } from '@schema/map';
import {
  BARRIER_AXES,
  BARRIER_KINDS,
  BASE_AXES,
  type BuildingRecord,
  type CoverAxes,
  DAMAGED_AXES,
  ELEVATION_STEPS,
  POINT_AXES,
  WALK_FOOT,
  WALK_INFANTRY_MASK,
  WALK_MECH,
  WALK_POWER_ARMOR,
  WALK_PRONE,
  WALK_SLOW,
  WALK_TRACKED,
  WALK_WHEELED,
  baseToByte,
  barrierIsDamaged,
  byteToBase,
  byteToPoint,
  coverByteFromAxes,
  pointToByte,
  quantizeElevationNorm,
  stronger,
} from '../world';
import { pickCapillaries, stampCapillary } from './capillary';
import { paintForBiome } from './base-paint';
import { bakeShading, bakeContours } from './elevation-shade';
import { makeDebugSink } from './debug-sink';
import { DENSITY_PROFILES, generateCoverDensity } from './density-field';
import {
  extractHotspots,
  routeAdjacencyMST,
  scatterClustersDensityDriven,
  type Hotspot,
} from './density-scatter';
import type { DominantCapillary, DominantLine } from './dominant-line';
import { pickLineKind } from './dominant-line';
import { logPlacerRun } from './debug/spawn-placer-log';
import { enforceReachability } from './enforce-reachability';
import {
  footprintFor,
  pickLandmarkKind,
  placeLandmark,
  stampHeroLandmark,
  type HeroLandmark,
} from './hero-landmark';
import { generateLandmarkName } from './landmark-names';
import { fbm2D, gaussian2D, hashStringToSeed, makeRng, subRng } from './noise';
import { resampleObjectiveAroundBisector } from './objective-resample';
import { pruneByThresholdTable } from './prune-by-threshold';
import { buildDominantLine, stampLine } from './route-line';
import { placeSpawns, planUnitSlots } from './spawn-placer';
import type {
  DeployZone,
  MapGenDiagnostics,
  MapGenRequest,
  MapGenResult,
  ObjectiveAnchor,
  RosterSpec,
  UnitSlots,
} from './types';

const DEFAULT_ROSTER: RosterSpec = { squadCount: 2, unitCount: 8 };

// Base-kind byte shortcuts (match world.ts BASE_KINDS order).
const B = {
  open: baseToByte('open'),
  road: baseToByte('road'),
  water_shallow: baseToByte('water_shallow'),
  water_deep: baseToByte('water_deep'),
  mud: baseToByte('mud'),
  rubble_ground: baseToByte('rubble_ground'),
  snow: baseToByte('snow'),
  sand: baseToByte('sand'),
} as const;

type BiomeDef = {
  // (elevation, fertility) → base surface preference.
  paint(elev: number, fert: number, rng01: number): TerrainBase;
  // Density targets per 10k cells.
  buildingClusters: number;
  buildingClusterSize: [number, number];
  forestClusters: number;
  roadDensity: number;
};

const BIOMES: Record<BiomeId, BiomeDef> = {
  urban_sparse: {
    paint(elev, fert) {
      if (elev < 0.18) return 'water_deep';
      if (fert > 0.72) return 'open'; // forest added later via point scatter
      return 'open';
    },
    buildingClusters: 45,
    buildingClusterSize: [3, 7],
    forestClusters: 6,
    roadDensity: 0.55,
  },
  rural_open: {
    paint(elev, fert) {
      if (elev < 0.15) return 'water_deep';
      if (fert > 0.62) return 'open';
      return 'open';
    },
    buildingClusters: 8,
    buildingClusterSize: [2, 4],
    forestClusters: 18,
    roadDensity: 0.2,
  },
  mixed: {
    paint(elev, fert) {
      if (elev < 0.16) return 'water_deep';
      if (fert > 0.68) return 'open';
      return 'open';
    },
    buildingClusters: 22,
    buildingClusterSize: [2, 6],
    forestClusters: 12,
    roadDensity: 0.35,
  },
  // Deferred biomes stubbed with the mixed profile.
  urban_dense: {
    paint(elev) {
      return elev < 0.16 ? 'water_deep' : 'open';
    },
    buildingClusters: 90,
    buildingClusterSize: [3, 8],
    forestClusters: 2,
    roadDensity: 0.7,
  },
  industrial: {
    paint(elev) {
      return elev < 0.16 ? 'water_deep' : 'open';
    },
    buildingClusters: 60,
    buildingClusterSize: [5, 10],
    forestClusters: 2,
    roadDensity: 0.5,
  },
  forest: {
    paint(elev) {
      if (elev < 0.15) return 'water_deep';
      return 'open';
    },
    buildingClusters: 3,
    buildingClusterSize: [2, 3],
    forestClusters: 40,
    roadDensity: 0.1,
  },
  arid: {
    paint(elev, fert) {
      if (elev < 0.12) return 'sand';
      return fert < 0.3 ? 'sand' : 'open';
    },
    buildingClusters: 12,
    buildingClusterSize: [2, 5],
    forestClusters: 2,
    roadDensity: 0.25,
  },
  rural_village: {
    paint(elev) {
      if (elev < 0.15) return 'water_deep';
      return 'open';
    },
    buildingClusters: 18,
    buildingClusterSize: [2, 5],
    forestClusters: 14,
    roadDensity: 0.3,
  },
};

// COA-1 task #45 — retry harness. Generators that fail the sanity check
// (e.g., deploy zones unreachable without heavy carving, zero hotspots on
// a biome that requires them, fewer than N objective anchors) get a
// re-roll with a perturbed seed. Bounded at MAX_PIPELINE_RETRIES attempts
// so a pathological seed doesn't loop forever.
const MAX_PIPELINE_RETRIES = 3;

export function runPipelineWithRetry(req: MapGenRequest): MapGenResult {
  let lastFailure: string | null = null;
  for (let attempt = 0; attempt < MAX_PIPELINE_RETRIES; attempt++) {
    const attemptReq =
      attempt === 0 ? req : { ...req, seed: `${req.seed}:retry${attempt}` };
    const r = runPipelineCore(attemptReq);
    const problems = sanityCheckMap(r);
    if (problems.length === 0) {
      return {
        ...r,
        diagnostics: { ...r.diagnostics, retryCount: attempt },
      };
    }
    lastFailure = problems.join('; ');
  }
  // Out of retries — return a last-chance attempt with a note in the
  // diagnostics so callers can see it came back degraded. We still emit
  // a usable map; the sanity failures are informational.
  const last = runPipelineCore({ ...req, seed: `${req.seed}:retry-final` });
  return {
    ...last,
    diagnostics: {
      ...last.diagnostics,
      retryCount: MAX_PIPELINE_RETRIES,
      // Pack the failure summary into the existing counter so we don't need
      // a new schema field just for this. Zero is the normal value.
      hotspotsDropped: last.diagnostics.hotspotsDropped + (lastFailure ? 1 : 0),
    },
  };
}

// Sanity checks — return a list of problem strings. Empty list = map is
// good to ship. Keep the checks cheap; the pipeline already does heavy
// validation internally.
// Exported for tests (P2.11) that want to verify the barren-map guard
// triggers on hand-constructed empty results.
export function sanityCheckMap(r: MapGenResult): string[] {
  const problems: string[] = [];
  if (r.objectiveAnchors.length < 3) {
    problems.push(`only ${r.objectiveAnchors.length} objective anchors`);
  }
  const dz = r.deployZones;
  if (dz.team0.w < 4 || dz.team0.h < 4) problems.push('team0 zone too small');
  if (dz.team1.w < 4 || dz.team1.h < 4) problems.push('team1 zone too small');
  // Excessive carving implies the pipeline struggled to produce a map
  // with organic connectivity — a re-roll is preferable. Tolerance scales
  // with map size so small maps don't spuriously retry.
  const maxCarve = Math.max(64, Math.floor((r.width * r.height) * 0.02));
  if (r.diagnostics.carvedCells > maxCarve) {
    problems.push(`carveCorridor touched ${r.diagnostics.carvedCells} cells (budget ${maxCarve})`);
  }
  // P2.10 — barren-map guard. If scatter dropped fewer than 0.5% of
  // tiles as point objects, the map reads as visually empty (one of the
  // structural bugs this rework targets). Force a retry.
  const total = r.width * r.height;
  let pointTiles = 0;
  for (let i = 0; i < total; i++) if (r.point[i] > 0) pointTiles++;
  const pointPct = total === 0 ? 0 : pointTiles / total;
  if (pointPct < 0.005) {
    problems.push(`point-object density ${(pointPct * 100).toFixed(2)}% below 0.5% floor`);
  }
  return problems;
}

export function runPipeline(req: MapGenRequest): MapGenResult {
  return runPipelineCore(req);
}

function runPipelineCore(req: MapGenRequest): MapGenResult {
  const W = req.size;
  const H = req.size;
  const N = W * H;
  const seedBase = hashStringToSeed(req.seed);

  // Per-tile grids (ADR 012).
  const base = new Uint8Array(N);
  const point = new Uint8Array(N);
  const edgeN = new Uint8Array(N);
  const edgeW = new Uint8Array(N);
  const edgeOverrideN = new Uint8Array(N);
  const edgeOverrideW = new Uint8Array(N);
  const buildingId = new Uint16Array(N);
  const walkability = new Uint16Array(N);
  const coverProfile = new Uint8Array(N);
  const elevationStep = new Uint8Array(N);
  const structureHeight = new Uint8Array(N);
  const hpN = new Uint16Array(N);
  const hpW = new Uint16Array(N);
  const hpPoint = new Uint16Array(N);

  const elevation = new Float32Array(N);
  const fertility = new Float32Array(N);
  const coverDensity = new Float32Array(N);
  const buildings: BuildingRecord[] = [];

  const biomeDef = BIOMES[req.biome];
  // P3.1/P3.2 — per-biome elevation profile. Fall back to a modest
  // default if a biome hasn't declared one yet.
  const biomeDensityProfile = DENSITY_PROFILES[req.biome];
  const elevationGen = biomeDensityProfile?.elevationGen ?? {
    amplitude: 0.5,
    frequency: 0.021,
    octaves: 5,
    smoothness: 1,
  };

  // ---- Step: elevation fBm (continuous), quantized to step (COA-8) ----
  {
    const seed = subRng(seedBase, 'elevation-seed')();
    const s = ((seed * 0xffffffff) | 0) >>> 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = fbm2D(x, y, elevationGen.frequency, elevationGen.octaves, s, W);
        elevation[y * W + x] = v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const range = max - min || 1;
    // Normalize → scale by amplitude → re-center so flat maps stay mid-
    // range and hilly maps swing widely around 0.5.
    const halfAmp = elevationGen.amplitude / 2;
    for (let i = 0; i < N; i++) {
      const norm = (elevation[i] - min) / range; // [0, 1]
      const centered = norm - 0.5; // [-0.5, 0.5]
      const scaled = 0.5 + centered * elevationGen.amplitude * 2; // widen or squash around 0.5
      elevation[i] = Math.max(0, Math.min(1, scaled));
    }
    // Smoothness pass — box-blur the elevation with a kernel of half-width
    // `smoothness`. Applied on the continuous field before quantization so
    // the stepped output inherits the blur.
    const smoothness = Math.max(0, Math.floor(elevationGen.smoothness));
    if (smoothness > 0) {
      const blurred = new Float32Array(N);
      const k = smoothness;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let sum = 0;
          let count = 0;
          for (let dy = -k; dy <= k; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= H) continue;
            for (let dx = -k; dx <= k; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= W) continue;
              sum += elevation[yy * W + xx];
              count += 1;
            }
          }
          blurred[y * W + x] = sum / count;
        }
      }
      elevation.set(blurred);
    }
    for (let i = 0; i < N; i++) {
      elevationStep[i] = quantizeElevationNorm(elevation[i]);
    }
    // Suppress unused-var warning for halfAmp (kept for readability of
    // the scaling math above).
    void halfAmp;
  }

  // ---- Step: fertility fBm (continuous, paint-driver) ----
  {
    const s = hashStringToSeed(`${req.seed}:fertility`);
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = fbm2D(x, y, 0.014, 4, s, W);
        fertility[y * W + x] = v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const range = max - min || 1;
    for (let i = 0; i < N; i++) fertility[i] = (fertility[i] - min) / range;
  }

  // ---- Step: biome paint → base surface ----
  {
    // P5.1 — per-biome paint function extracted to base-paint.ts. The
    // BiomeDef.paint shim stays for authored-map compatibility but
    // the pipeline prefers the richer paint functions.
    const paintFn = paintForBiome(req.biome);
    const paintRng = subRng(seedBase, 'biome-paint');
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const kind = paintFn(elevation[i], fertility[i], paintRng());
        base[i] = baseToByte(kind);
      }
    }
  }

  // ---- Step: remove small water islands ----
  const prunedClusters = removeSmallBaseIslands(
    base,
    W,
    H,
    B.water_deep,
    B.open,
    Math.max(32, Math.floor(N * 0.002)),
  );

  // ---- Step: density field + hotspots (moved early — these drive the
  // ---- cluster-anchored scatter below). P2.7 — formerly this pre-masked
  // ---- the top + bottom thirds, which killed 67% of hotspot capacity.
  // ---- The post-extraction filter (applied later once actual deploy
  // ---- zones are known) already excludes hotspots inside zones; no need
  // ---- to pre-kill candidates heuristically.
  const densityProfile = DENSITY_PROFILES[req.biome];
  const hotspots: Hotspot[] = [];
  let hotspotsDropped = 0;
  if (densityProfile) {
    const generated = generateCoverDensity(
      densityProfile,
      W,
      H,
      elevation,
      fertility,
      seedBase,
    );
    coverDensity.set(generated);
    for (const h of extractHotspots(coverDensity, W, H)) hotspots.push(h);
  }

  // ---- Step: dominant line (COA-4 task #93, replaces stampRoadSkeleton) ----
  let dominantLine: DominantLine | null = null;
  const capillaries: DominantCapillary[] = [];
  if (biomeDef.roadDensity > 0) {
    const lineRng = subRng(seedBase, 'dominant-line');
    const lineKind = pickLineKind(req.biome, lineRng);
    dominantLine = buildDominantLine(
      lineKind,
      W,
      H,
      elevationStep,
      coverDensity,
      lineRng,
    );
    stampLine(dominantLine, base, W, H);
    // Capillaries — 0-3 perpendicular branches.
    const caps = pickCapillaries(dominantLine, lineRng, W, H);
    for (const c of caps) {
      stampCapillary(c, base, W, H);
      capillaries.push(c);
    }
  }

  // ---- Step: hero landmark pick + stamp into world buffers (COA-4) ----
  let heroLandmark: HeroLandmark | null = null;
  {
    const landmarkRng = subRng(seedBase, 'landmark');
    const kind = pickLandmarkKind(req.biome, landmarkRng);
    const lineWaypoints = dominantLine?.waypoints ?? [];
    // Provisional deploy rects (rear thirds) — placer runs later but
    // the landmark mustn't land in spawn territory.
    const provisionalTeam0 = { x: 0, y: H - Math.floor(H / 3), w: W, h: Math.floor(H / 3) };
    const provisionalTeam1 = { x: 0, y: 0, w: W, h: Math.floor(H / 3) };
    const center = placeLandmark(
      kind,
      W,
      H,
      coverDensity,
      lineWaypoints,
      [provisionalTeam0, provisionalTeam1],
      landmarkRng,
    );
    const footprint = footprintFor(kind, center).filter(
      (p) => p.x >= 0 && p.y >= 0 && p.x < W && p.y < H,
    );
    const { name, shortName } = generateLandmarkName(kind, landmarkRng);
    heroLandmark = { kind, name, shortName, footprint, center };
    stampHeroLandmark({
      landmark: heroLandmark,
      base,
      point,
      buildingId,
      structureHeight,
      buildings,
      W,
      H,
    });
  }

  // ---- Step: hotspot-anchored building + forest scatter ----
  // Each hotspot gets a building cluster (1-4 buildings, 2-4 tiles each)
  // plus a foliage ring around it. This produces the Firefight-style
  // "farmstead / compound / thicket cluster" density rather than the
  // prior uniform chicken-pox scatter.
  scatterAroundHotspots({
    hotspots,
    base,
    point,
    buildingId,
    structureHeight,
    buildings,
    hpPoint,
    coverDensity,
    fertility,
    W,
    H,
    seed: seedBase,
  });

  // ---- Step: density-driven debris scatter (COA-1 #40) ----
  // Urban/industrial biomes get point-object clusters (barrels, oil
  // drums, tyres, rubble piles) scattered around hotspots using the
  // density field. Other biomes get village-ish debris (cart, haystack,
  // well) at lower intensity. Uses scatterClustersDensityDriven for the
  // Gaussian-around-hotspot + rejection-against-density sampling.
  scatterDensityDrivenDebris(
    req.biome,
    hotspots,
    coverDensity,
    base,
    point,
    buildingId,
    hpPoint,
    W,
    H,
    seedBase,
  );

  // ---- Step: low-density baseline uniform scatter ----
  // Kept at reduced counts so the map still has solo features (single
  // trees, isolated sheds) outside the hotspot clusters.
  // P6.3 — forest before buildings. Buildings can then carve into
  // tree clusters (destroying individual trees) rather than the reverse,
  // which used to prune forest tiles as "overlap remnants".
  scatterForestClusters(
    base,
    point,
    hpPoint,
    fertility,
    W,
    H,
    // P6.1 — drop 0.5× multiplier.
    biomeDef.forestClusters,
    seedBase,
  );
  scatterBuildingClusters(
    base,
    structureHeight,
    buildingId,
    buildings,
    W,
    H,
    // P6.1 — drop the 0.3× multiplier. biomeDef.buildingClusters is now
    // the literal target count for the ambient/non-hotspot pass.
    biomeDef.buildingClusters,
    biomeDef.buildingClusterSize,
    seedBase,
  );

  // ---- Step: hedgerow barriers if dominant line is hedgerow-spine ----
  // We reimplement the walker inline rather than constructing a full
  // World for stampBarrierLine — the pipeline only has raw buffers at
  // this stage, the World struct is built downstream in scenario.ts.
  if (dominantLine && dominantLine.kind === 'hedgerow-spine') {
    stampHedgerowEdges(dominantLine.waypoints, edgeN, edgeW, hpN, hpW, W, H);
  }

  // ---- Step: threshold-driven pruning sweep (COA-3) ----
  // Removes single-tile "chicken pox" scatter + elongated strips from the
  // post-scatter output, rebuilding the walkability mask afterward.
  const debugSink = makeDebugSink();
  const pruneReports = pruneByThresholdTable(
    base,
    point,
    W,
    H,
    (kind) => baseToByte(kind),
    (kind) => pointToByte(kind),
  );
  let totalPrunedClusters = 0;
  for (const k of Object.keys(pruneReports)) {
    totalPrunedClusters += pruneReports[k].clustersPruned;
  }
  if (totalPrunedClusters > 0) {
    debugSink.info('prune', 'threshold-driven sweep complete', {
      totalClustersPruned: totalPrunedClusters,
    });
  }

  // ---- Step: walkability + cover bake ----
  bakeWalkabilityAndCover(
    base,
    point,
    buildingId,
    edgeN,
    edgeW,
    walkability,
    coverProfile,
    N,
  );

  // ---- Step: COA-5 spawn placer ----
  // Build provisional objective anchors from map center + quadrant seeds.
  // The placer uses these to derive the combat axis; we then resample
  // them around the team bisector (see further down).
  let objectiveAnchors: ObjectiveAnchor[] = [
    {
      kindHint: 'extract',
      rect: {
        x: Math.floor(W / 2) - 8,
        y: Math.floor(H / 4) - 4,
        w: 16,
        h: 8,
      },
      qualityScore: 0.8,
    },
    {
      kindHint: 'secure',
      rect: {
        x: Math.floor(W / 2) - 8,
        y: Math.floor(H / 2) - 8,
        w: 16,
        h: 16,
      },
      qualityScore: 0.7,
    },
    {
      kindHint: 'defend',
      rect: {
        x: Math.floor(W / 2) - 8,
        y: Math.floor(H * 3 / 4) - 4,
        w: 16,
        h: 8,
      },
      qualityScore: 0.9,
    },
  ];

  const placerResult = placeSpawns({
    W,
    H,
    tileSizeMeters: req.tileSizeMeters,
    walkability,
    elevationStep,
    objectiveAnchors,
    regime: req.spawnRegime ?? 'meeting',
    rosterTeam0: req.rosterTeam0 ?? DEFAULT_ROSTER,
    rosterTeam1: req.rosterTeam1 ?? DEFAULT_ROSTER,
  });
  const team0: DeployZone = placerResult.team0;
  const team1: DeployZone = placerResult.team1;
  logPlacerRun(debugSink, {
    W,
    H,
    tileSizeMeters: req.tileSizeMeters,
    walkability,
    elevationStep,
    objectiveAnchors,
    regime: req.spawnRegime ?? 'meeting',
    rosterTeam0: req.rosterTeam0 ?? DEFAULT_ROSTER,
    rosterTeam1: req.rosterTeam1 ?? DEFAULT_ROSTER,
  }, placerResult);

  // ADR 014 — density masking of deploy zones removed. Terrain generation
  // now spans the whole map edge-to-edge; spawn planner below lands units
  // on walkable tiles regardless of cover density. Per-slot walkability
  // clearing happens *after* the planner runs (see ensureSpawnSlotsWalkable
  // call below) so feature scatter (buildings, trees, hotspots) survives
  // in the flanks instead of being zeroed by a rear-third rect pass.

  // Resample objective anchors around the spawn placer's bisector so
  // both teams have similar travel distance to each objective.
  objectiveAnchors = resampleObjectiveAroundBisector({
    anchors: objectiveAnchors,
    team0,
    team1,
    regime: req.spawnRegime ?? 'meeting',
    walkability,
    W,
    H,
  });

  // ---- Step: reachability sanity carve (COA-3 enforceReachability) ----
  let carvedCells = 0;
  if (!zonesReachable(walkability, W, H, team0, team1)) {
    carvedCells = carveCorridor(base, point, buildingId, walkability, W, H, team0, team1);
  }
  // Extra safety net — ensure team0 → team1 + team0 → objective centre
  // connectivity via the new reachability enforcer. On an already-reachable
  // map this is a fast BFS + no carving.
  const reachReport = enforceReachability(
    walkability,
    base,
    point,
    buildingId,
    W,
    H,
    [
      { label: 'team0', seedTileX: Math.floor(team0.x + team0.w / 2), seedTileY: Math.floor(team0.y + team0.h / 2) },
      { label: 'team1', seedTileX: Math.floor(team1.x + team1.w / 2), seedTileY: Math.floor(team1.y + team1.h / 2) },
      { label: 'objective', seedTileX: Math.floor(W / 2), seedTileY: Math.floor(H / 2) },
    ],
    B.open,
    debugSink,
  );
  carvedCells += reachReport.carvedTiles;

  // Drop hotspots that ended up inside the (final) deploy zones after
  // the placer ran. The up-front mask used rear-third heuristics so this
  // catches rare overlaps where the placer shifted zones.
  {
    const keep: Hotspot[] = [];
    for (const h of hotspots) {
      if (insideZone(h, team0) || insideZone(h, team1)) {
        hotspotsDropped++;
        continue;
      }
      keep.push(h);
    }
    hotspots.length = 0;
    hotspots.push(...keep);
  }
  const clusterMembership = new Int16Array(N).fill(-1);

  const diagnostics: MapGenDiagnostics = {
    retryCount: 0,
    hotspotsFound: hotspots.length,
    hotspotsDropped,
    carvedCells,
    prunedClusters,
    densityScatterChildren: 0,
    densityScatterRejected: 0,
  };

  const hash = hashBuffers(base, point, edgeN, edgeW, walkability);

  // Adjacency MST over hotspots — downstream consumers (secondary lanes,
  // debug overlay, future scatter passes that want neighbor anchors) use
  // this to stay spatially coherent with the hotspot set (COA-1 #39).
  const hotspotAdjacency = routeAdjacencyMST(hotspots);

  // P3.3 / P3.5b — baked shading + contour overlay. Computed after all
  // stamp passes so hills near destroyed buildings still shade
  // correctly.
  const shadingBake = bakeShading(elevationStep, W, H);
  const contours = bakeContours(elevationStep, W, H);

  // ADR 014 — plan per-unit spawn tiles. Team 0 marches in along a road-
  // connected map edge; team 1 rings the dominant objective anchor. The
  // planner falls back to grid-sampling the deploy zone rects when no
  // road endpoint / anchor is available.
  const spawnPlan = planUnitSlots({
    W,
    H,
    walkability,
    dominantLine,
    objectiveAnchors,
    team0Zone: team0,
    team1Zone: team1,
  });
  const unitSlots: UnitSlots = spawnPlan.slots;
  // Per-slot walkability: clear deep water / buildings / points at the
  // actual spawn tiles only. Prior versions cleared the whole rear-third
  // deploy-zone rect, which also zeroed building + tree scatter in the
  // map flanks — causing the center-heavy feature distribution that
  // @desktop's 2026-04-23 smoke pass measured (30% center vs 2-3% flanks).
  ensureSpawnSlotsWalkable(base, buildingId, point, walkability, elevationStep, W, H, unitSlots);

  return {
    request: req,
    width: W,
    height: H,
    base,
    point,
    edgeN,
    edgeW,
    edgeOverrideN,
    edgeOverrideW,
    buildingId,
    walkability,
    coverProfile,
    elevationStep,
    structureHeight,
    hpN,
    hpW,
    hpPoint,
    buildings,
    elevation,
    coverDensity,
    hotspots,
    clusterMembership,
    hotspotAdjacency,
    dominantLine,
    capillaries,
    heroLandmark,
    deployZones: { team0, team1 },
    unitSlots,
    objectiveAnchors,
    diagnostics,
    hash,
    shadingBake,
    contours,
  };
}

// ---------------------------------------------------------------------------
// Pipeline stages — simplified parity pass. COAs 1/3/4 replace most of these.

function removeSmallBaseIslands(
  base: Uint8Array,
  W: number,
  H: number,
  sourceByte: number,
  fillByte: number,
  minSize: number,
): number {
  const N = W * H;
  const visited = new Uint8Array(N);
  const stack = new Int32Array(N);
  let pruned = 0;
  for (let i = 0; i < N; i++) {
    if (visited[i] || base[i] !== sourceByte) continue;
    let top = 0;
    stack[top++] = i;
    const component: number[] = [];
    while (top > 0) {
      const p = stack[--top];
      if (visited[p]) continue;
      visited[p] = 1;
      if (base[p] !== sourceByte) continue;
      component.push(p);
      const x = p % W;
      const y = (p - x) / W;
      if (x > 0) stack[top++] = p - 1;
      if (x < W - 1) stack[top++] = p + 1;
      if (y > 0) stack[top++] = p - W;
      if (y < H - 1) stack[top++] = p + W;
    }
    if (component.length < minSize) {
      for (const p of component) base[p] = fillByte;
      pruned++;
    }
  }
  return pruned;
}

function scatterBuildingClusters(
  base: Uint8Array,
  structureHeight: Uint8Array,
  buildingId: Uint16Array,
  buildings: BuildingRecord[],
  W: number,
  H: number,
  per10k: number,
  sizeRange: readonly [number, number],
  seed: number,
): void {
  const area = W * H;
  const target = Math.floor((per10k * area) / 10000);
  const rng = makeRng(seed ^ 0x123456);
  let placed = 0;
  let tries = 0;
  const maxTries = target * 20;
  while (placed < target && tries < maxTries) {
    tries++;
    const cx = Math.floor(rng() * W);
    const cy = Math.floor(rng() * H);
    const sw = sizeRange[0] + Math.floor(rng() * (sizeRange[1] - sizeRange[0] + 1));
    const sh = sizeRange[0] + Math.floor(rng() * (sizeRange[1] - sizeRange[0] + 1));
    const x0 = cx - (sw >> 1);
    const y0 = cy - (sh >> 1);
    if (x0 < 1 || y0 < 1 || x0 + sw >= W - 1 || y0 + sh >= H - 1) continue;
    let ok = true;
    for (let yy = y0; yy < y0 + sh && ok; yy++) {
      for (let xx = x0; xx < x0 + sw; xx++) {
        const i = yy * W + xx;
        if (base[i] === B.water_deep || buildingId[i] !== 0) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) continue;
    const height = 3 + Math.floor(rng() * 4);
    const floors = Math.max(1, Math.round(height / 3));
    const id = buildings.length + 1;
    const footprint: { x: number; y: number }[] = [];
    for (let yy = y0; yy < y0 + sh; yy++) {
      for (let xx = x0; xx < x0 + sw; xx++) {
        const i = yy * W + xx;
        buildingId[i] = id;
        structureHeight[i] = height;
        // Leave base as open; building is read via buildingId.
        footprint.push({ x: xx, y: yy });
      }
    }
    buildings.push({
      id,
      family: 'shed',
      floors,
      footprintTiles: footprint,
      wallHpInitial: 100,
    });
    placed++;
  }
}

// Replaces the old forest-base scatter. Stamps tree_forest / bush_medium
// points over open terrain — per the new vocabulary there's no 'forest'
// base surface; foliage is a point-object layer.
function scatterForestClusters(
  base: Uint8Array,
  point: Uint8Array,
  hpPoint: Uint16Array,
  fertility: Float32Array,
  W: number,
  H: number,
  per10k: number,
  seed: number,
): void {
  const area = W * H;
  const target = Math.floor((per10k * area) / 10000);
  const rng = makeRng(seed ^ 0x9abcdef);
  const treeByte = pointToByte('tree_forest');
  const bushByte = pointToByte('bush_medium');
  let placed = 0;
  let tries = 0;
  const maxTries = target * 10;
  while (placed < target && tries < maxTries) {
    tries++;
    const cx = Math.floor(rng() * W);
    const cy = Math.floor(rng() * H);
    const radius = 3 + Math.floor(rng() * 4);
    let anyPlaced = false;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = yy * W + xx;
        if (base[i] !== B.open) continue;
        if (point[i] !== 0) continue;
        // Deterministic fertility-weighted selection: trees on higher
        // fertility cells, bushes on the rest.
        const byte = fertility[i] > 0.55 ? treeByte : bushByte;
        point[i] = byte;
        // Max HP is per-kind; we track it but don't apply damage at gen time.
        hpPoint[i] = byte === treeByte ? 30 : 10;
        anyPlaced = true;
      }
    }
    if (anyPlaced) placed++;
  }
}

function bakeWalkabilityAndCover(
  base: Uint8Array,
  point: Uint8Array,
  buildingId: Uint16Array,
  edgeN: Uint8Array,
  edgeW: Uint8Array,
  walkability: Uint16Array,
  coverProfile: Uint8Array,
  N: number,
): void {
  for (let i = 0; i < N; i++) {
    const baseKind = byteToBase(base[i]);
    const baseAxes = BASE_AXES[baseKind];
    const pointKind: PointObjectKind | null = byteToPoint(point[i]);
    const pointAxes = pointKind ? POINT_AXES[pointKind] : null;
    const isBuilding = buildingId[i] !== 0;

    // Edge barrier axes owned by this tile (N + W). S + E belong to the
    // south/east neighbor's own (y+1).N / (x+1).W respectively. Reading
    // only N+W here mirrors terrainAxesAt in world.ts so pre-bake matches
    // runtime cover lookup exactly (COA-4 #88/#89).
    const edgeNAxes = barrierAxesFromByte(edgeN[i]);
    const edgeWAxes = barrierAxesFromByte(edgeW[i]);

    // Movement mask — intersection across layers. Base first. Edge
    // barriers that restrict movement across the N or W boundary also
    // narrow what can stand on this tile (a bocage-ringed tile can't be
    // entered by wheeled chassis, so WALK_WHEELED is stripped).
    let mask = walkMaskFromMove(baseAxes.move);
    if (pointAxes) mask &= walkMaskFromMove(pointAxes.move);
    if (edgeNAxes) mask &= walkMaskFromMove(edgeNAxes.move);
    if (edgeWAxes) mask &= walkMaskFromMove(edgeWAxes.move);
    if (isBuilding) {
      // Building interior: infantry-only, no vehicles.
      mask &= WALK_INFANTRY_MASK;
    }
    const slowestMult = Math.min(
      pointAxes?.moveSpeedMult ?? baseAxes.moveSpeedMult,
      edgeNAxes?.moveSpeedMult ?? 1.0,
      edgeWAxes?.moveSpeedMult ?? 1.0,
    );
    if (slowestMult < 1.0) mask |= WALK_SLOW;
    walkability[i] = mask;

    // Cover profile — rough pre-bake byte for fast hit.ts lookup.
    // Bits: los 0-1, cover 2-3, heightProfile 4-6, dirty 7.
    // Take the strongest contributor across base + point + N/W edge
    // barriers. This matches terrainAxesAt(world, x, y) semantics.
    let strongestAxes: CoverAxes = baseAxes;
    if (pointAxes) strongestAxes = stronger(strongestAxes, pointAxes);
    if (edgeNAxes) strongestAxes = stronger(strongestAxes, edgeNAxes);
    if (edgeWAxes) strongestAxes = stronger(strongestAxes, edgeWAxes);
    coverProfile[i] = coverByteFromAxes(strongestAxes);
  }
}

// Decode a barrier byte into CoverAxes (or null if no barrier). Damaged
// bit is honoured where a DAMAGED_AXES override exists. Kept file-local
// since the pipeline bake is the only non-World consumer.
function barrierAxesFromByte(edgeByte: number): CoverAxes | null {
  const kindIdx = edgeByte & 0x0f;
  if (kindIdx === 0) return null;
  const kind = BARRIER_KINDS[kindIdx - 1];
  if (!kind) return null;
  if (barrierIsDamaged(edgeByte)) {
    const d = DAMAGED_AXES[kind];
    if (d) return d;
  }
  return BARRIER_AXES[kind];
}

function walkMaskFromMove(
  move: 'walkable-free' | 'walkable-slow' | 'blocked-foot' | 'blocked-vehicle' | 'blocked-all',
): number {
  switch (move) {
    case 'walkable-free':
      return (
        WALK_FOOT |
        WALK_PRONE |
        WALK_MECH |
        WALK_POWER_ARMOR |
        WALK_WHEELED |
        WALK_TRACKED
      );
    case 'walkable-slow':
      return (
        WALK_FOOT |
        WALK_PRONE |
        WALK_MECH |
        WALK_POWER_ARMOR |
        WALK_WHEELED |
        WALK_TRACKED |
        WALK_SLOW
      );
    case 'blocked-foot':
      // Only mech + PA pass — per user, tank traps / dragons teeth pass
      // mechs and power armor but block wheeled + tracked.
      return WALK_MECH | WALK_POWER_ARMOR;
    case 'blocked-vehicle':
      // Infantry (all leg-based locomotion) passes; wheeled + tracked blocked.
      return WALK_INFANTRY_MASK;
    case 'blocked-all':
      return 0;
  }
}

function insideZone(p: { x: number; y: number }, zone: DeployZone): boolean {
  return p.x >= zone.x && p.x < zone.x + zone.w && p.y >= zone.y && p.y < zone.y + zone.h;
}

// ADR 014 — per-slot walkability clearing. Replaces the old zone-wide
// ensureZoneWalkable that flattened whole rear-third rectangles and
// zeroed building + tree scatter across the map flanks. Here we only
// touch the slot tiles themselves and a 1-tile ring for elevation
// feathering so units can step out without tripping the cliff guard.
function ensureSpawnSlotsWalkable(
  base: Uint8Array,
  buildingId: Uint16Array,
  point: Uint8Array,
  walkability: Uint16Array,
  elevationStep: Uint8Array,
  W: number,
  H: number,
  unitSlots: UnitSlots,
): void {
  const WALK_ALL_GROUND =
    WALK_FOOT | WALK_PRONE | WALK_MECH | WALK_POWER_ARMOR | WALK_WHEELED | WALK_TRACKED;
  const slots = [...unitSlots.team0, ...unitSlots.team1];
  for (const s of slots) {
    if (s.x < 0 || s.x >= W || s.y < 0 || s.y >= H) continue;
    const i = s.y * W + s.x;
    if (base[i] === B.water_deep) base[i] = B.open;
    if (buildingId[i] !== 0) buildingId[i] = 0;
    point[i] = 0;
    walkability[i] = WALK_ALL_GROUND;
    // Feather elevation to neighbors so the cliff guard (+2 step block)
    // doesn't strand units on a spawn tile. Take the min of the current
    // step and the 4-neighbor avg — pulls down cliffs, leaves low ground.
    let sum = 0;
    let count = 0;
    const neighbors = [
      s.y > 0 ? (s.y - 1) * W + s.x : -1,
      s.y < H - 1 ? (s.y + 1) * W + s.x : -1,
      s.x > 0 ? s.y * W + (s.x - 1) : -1,
      s.x < W - 1 ? s.y * W + (s.x + 1) : -1,
    ];
    for (const n of neighbors) {
      if (n < 0) continue;
      sum += elevationStep[n];
      count++;
    }
    if (count > 0) {
      const avg = Math.round(sum / count);
      const cur = elevationStep[i];
      if (Math.abs(cur - avg) > 2) elevationStep[i] = avg;
    }
  }
  // Second pass: feather each slot's 1-tile ring to within 2 steps of
  // the slot so the unit can step out. Skip ring tiles that are
  // themselves slots (already handled above).
  const slotKeys = new Set<number>(slots.map((s) => s.y * W + s.x));
  for (const s of slots) {
    if (s.x < 0 || s.x >= W || s.y < 0 || s.y >= H) continue;
    const baseStep = elevationStep[s.y * W + s.x];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = s.x + dx;
        const ny = s.y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const ni = ny * W + nx;
        if (slotKeys.has(ni)) continue;
        const d = elevationStep[ni] - baseStep;
        if (d > 2) elevationStep[ni] = baseStep + 2;
        else if (d < -2) elevationStep[ni] = baseStep - 2;
      }
    }
  }
}

function zonesReachable(
  walkability: Uint16Array,
  W: number,
  H: number,
  team0: DeployZone,
  team1: DeployZone,
): boolean {
  const start = {
    x: Math.floor(team0.x + team0.w / 2),
    y: Math.floor(team0.y + team0.h / 2),
  };
  const goal = {
    x: Math.floor(team1.x + team1.w / 2),
    y: Math.floor(team1.y + team1.h / 2),
  };
  const visited = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let head = 0;
  let tail = 0;
  queue[tail++] = start.y * W + start.x;
  visited[start.y * W + start.x] = 1;
  while (head < tail) {
    const p = queue[head++];
    const x = p % W;
    const y = (p - x) / W;
    if (x === goal.x && y === goal.y) return true;
    const neighbors = [
      x > 0 ? p - 1 : -1,
      x < W - 1 ? p + 1 : -1,
      y > 0 ? p - W : -1,
      y < H - 1 ? p + W : -1,
    ];
    for (const n of neighbors) {
      if (n < 0 || visited[n]) continue;
      if ((walkability[n] & WALK_FOOT) === 0) continue;
      visited[n] = 1;
      queue[tail++] = n;
    }
  }
  return false;
}

function carveCorridor(
  base: Uint8Array,
  point: Uint8Array,
  buildingId: Uint16Array,
  walkability: Uint16Array,
  W: number,
  H: number,
  team0: DeployZone,
  team1: DeployZone,
): number {
  const x0 = Math.floor(team0.x + team0.w / 2);
  const y0 = Math.floor(team0.y + team0.h / 2);
  const x1 = Math.floor(team1.x + team1.w / 2);
  const y1 = Math.floor(team1.y + team1.h / 2);
  let x = x0;
  let y = y0;
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  let carved = 0;
  while (x !== x1 || y !== y1) {
    if (x !== x1) x += dx;
    else if (y !== y1) y += dy;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const xx = x + ox;
        const yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = yy * W + xx;
        if (base[i] === B.water_deep || buildingId[i] !== 0 || point[i] !== 0) {
          if (base[i] === B.water_deep) base[i] = B.road;
          buildingId[i] = 0;
          point[i] = 0;
          walkability[i] =
            WALK_FOOT | WALK_PRONE | WALK_MECH | WALK_POWER_ARMOR | WALK_WHEELED | WALK_TRACKED;
          carved++;
        }
      }
    }
  }
  return carved;
}

function hashBuffers(...bufs: (Uint8Array | Uint16Array)[]): number {
  let h = 0x811c9dc5;
  // Stride every 17 entries of each buffer — full-buffer hash at 4096² is
  // expensive, stride hash is sufficient for determinism regression catch.
  for (const buf of bufs) {
    for (let i = 0; i < buf.length; i += 17) {
      h ^= buf[i];
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Hotspot-anchored scatter — each hotspot produces a dense cluster of
// buildings + surrounding foliage ring. This is the Firefight-style
// feature cluster that the prior uniform scatter couldn't produce.

type ScatterAroundHotspotsInput = {
  readonly hotspots: readonly Hotspot[];
  readonly base: Uint8Array;
  readonly point: Uint8Array;
  readonly buildingId: Uint16Array;
  readonly structureHeight: Uint8Array;
  readonly buildings: BuildingRecord[];
  readonly hpPoint: Uint16Array;
  readonly coverDensity: Float32Array;
  readonly fertility: Float32Array;
  readonly W: number;
  readonly H: number;
  readonly seed: number;
};

function scatterAroundHotspots(input: ScatterAroundHotspotsInput): void {
  const { hotspots, base, point, buildingId, structureHeight, buildings, hpPoint, fertility, W, H, seed } = input;
  if (hotspots.length === 0) return;
  const rng = makeRng(seed ^ 0xb0115b07);
  const treeByte = pointToByte('tree_forest');
  const bushByte = pointToByte('bush_medium');

  for (const h of hotspots) {
    // Building count scales with hotspot strength — 1-4 buildings per
    // hotspot. Gaussian offsets keep the cluster tight + organic.
    const buildingCount = Math.max(1, Math.round(h.strength * 4));
    for (let b = 0; b < buildingCount; b++) {
      const g = gaussian2D(rng, 3.5, 3.5);
      const sizeW = 2 + Math.floor(rng() * 3); // 2-4
      const sizeH = 2 + Math.floor(rng() * 3);
      const bx = Math.round(h.x + g.x) - (sizeW >> 1);
      const by = Math.round(h.y + g.y) - (sizeH >> 1);
      if (bx < 1 || by < 1 || bx + sizeW >= W - 1 || by + sizeH >= H - 1) continue;
      let clear = true;
      for (let yy = by; yy < by + sizeH && clear; yy++) {
        for (let xx = bx; xx < bx + sizeW; xx++) {
          const idx = yy * W + xx;
          if (base[idx] === B.water_deep || buildingId[idx] !== 0) {
            clear = false;
            break;
          }
        }
      }
      if (!clear) continue;
      const height = 3 + Math.floor(rng() * 4);
      const floors = Math.max(1, Math.round(height / 3));
      const id = buildings.length + 1;
      const footprint: { x: number; y: number }[] = [];
      for (let yy = by; yy < by + sizeH; yy++) {
        for (let xx = bx; xx < bx + sizeW; xx++) {
          const idx = yy * W + xx;
          buildingId[idx] = id;
          structureHeight[idx] = height;
          point[idx] = 0;
          footprint.push({ x: xx, y: yy });
        }
      }
      buildings.push({ id, family: 'house_red_tiles', floors, footprintTiles: footprint, wallHpInitial: 100 });
    }

    // Foliage ring — thin scatter in a 6-tile radius around the hotspot,
    // fertility-weighted tree vs bush. Skips tiles already occupied by
    // buildings/landmark.
    const ringR = 6;
    for (let dy = -ringR; dy <= ringR; dy++) {
      for (let dx = -ringR; dx <= ringR; dx++) {
        const xx = h.x + dx;
        const yy = h.y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > ringR * ringR) continue;
        // Probability decays with distance from hotspot centre.
        const p = Math.max(0, h.strength - dist2 / (ringR * ringR));
        if (rng() > p * 0.6) continue;
        const idx = yy * W + xx;
        if (base[idx] !== B.open) continue;
        if (point[idx] !== 0 || buildingId[idx] !== 0) continue;
        const byte = fertility[idx] > 0.55 ? treeByte : bushByte;
        point[idx] = byte;
        hpPoint[idx] = byte === treeByte ? 30 : 10;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Inline hedgerow barrier stamper — writes LinearBarrierKind 'hedge'
// bytes onto edgeN/edgeW along a path. Mirrors stampBarrierLine from
// barriers.ts but operates on raw buffers because the pipeline doesn't
// have a World struct yet (that's built downstream in scenario.ts).

function stampHedgerowEdges(
  waypoints: readonly { x: number; y: number }[],
  edgeN: Uint8Array,
  edgeW: Uint8Array,
  hpN: Uint16Array,
  hpW: Uint16Array,
  W: number,
  H: number,
): void {
  if (waypoints.length < 2) return;
  // hedge = LinearBarrierKind value 1 (index into world's barrier
  // encoding). We replicate the encoding inline: low nibble = kind,
  // high nibble = damaged flag. See encodeBarrier in world.ts.
  const hedgeKindIdx = 1;
  const byte = hedgeKindIdx & 0x0f;
  const maxHp = 80;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const steps = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(a.x + dx * t);
      const y = Math.round(a.y + dy * t);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const side = Math.abs(dx) >= Math.abs(dy) ? 'N' : 'W';
      const idx = y * W + x;
      if (side === 'N') {
        edgeN[idx] = byte;
        hpN[idx] = maxHp;
      } else {
        edgeW[idx] = byte;
        hpW[idx] = maxHp;
      }
    }
  }
}

// COA-1 #40 — density-driven debris scatter. Given a biome + hotspot set +
// density field, scatter point objects themed to the biome around each
// hotspot using scatterClustersDensityDriven. Uses its own sub-rng (XOR
// with a unique salt) so adding this pass doesn't perturb earlier
// determinism — each pass should own its RNG branch.
function scatterDensityDrivenDebris(
  biome: BiomeId,
  hotspots: readonly Hotspot[],
  density: Float32Array,
  base: Uint8Array,
  point: Uint8Array,
  buildingId: Uint16Array,
  hpPoint: Uint16Array,
  W: number,
  H: number,
  seedBase: number,
): void {
  if (hotspots.length === 0) return;
  // Biome-specific debris themes. Each entry maps to a POINT_AXES kind
  // plus a default per-item HP.
  type DebrisKind = 'barrel' | 'oil_drums' | 'tyres' | 'rubble_pile'
    | 'cart_empty' | 'cart_full' | 'haystack' | 'well' | 'trough';
  const themes: Record<BiomeId, readonly DebrisKind[]> = {
    urban_sparse: ['barrel', 'tyres', 'rubble_pile', 'cart_empty'],
    urban_dense: ['barrel', 'oil_drums', 'tyres', 'rubble_pile'],
    industrial: ['oil_drums', 'barrel', 'tyres', 'rubble_pile'],
    rural_open: ['cart_empty', 'haystack', 'well', 'trough'],
    rural_village: ['cart_empty', 'cart_full', 'haystack', 'well', 'trough'],
    mixed: ['cart_empty', 'haystack', 'barrel', 'tyres'],
    forest: ['rubble_pile', 'cart_empty'],
    arid: ['barrel', 'tyres', 'rubble_pile'],
  };
  const HP: Record<DebrisKind, number> = {
    barrel: 20,
    oil_drums: 25,
    tyres: 15,
    rubble_pile: 40,
    cart_empty: 15,
    cart_full: 30,
    haystack: 10,
    well: 60,
    trough: 20,
  };
  const theme = themes[biome];
  // Industrial biomes get denser debris; rural biomes sparser.
  const intensity =
    biome === 'industrial' || biome === 'urban_dense' ? 8
    : biome === 'urban_sparse' ? 5
    : biome === 'rural_village' ? 4
    : 3;
  const rng = makeRng(seedBase ^ 0xdeb115ed);
  const children = scatterClustersDensityDriven(
    hotspots,
    density,
    W,
    H,
    {
      childrenPerHotspot: intensity,
      // P4.2 — relax debris gates. Larger sigma spreads debris further
      // around each hotspot (more coverage), lower density threshold
      // accepts tiles the pipeline formerly rejected as too quiet, and
      // more attempts give scatter more chances to place on cluttered
      // maps.
      sigmaTiles: 7,
      maxAttemptsPerChild: 16,
      minDensityForChild: 0.15,
    },
    rng,
  );
  for (const c of children) {
    const idx = c.y * W + c.x;
    // Skip occupied tiles (walls would spawn inside buildings / trees).
    if (base[idx] !== B.open) continue;
    if (point[idx] !== 0) continue;
    if (buildingId[idx] !== 0) continue;
    // Pick a theme item per child via sub-rng draw — consistent per seed.
    const pick = theme[Math.floor(rng() * theme.length)];
    point[idx] = pointToByte(pick);
    hpPoint[idx] = HP[pick];
  }
}

// Silence unused ELEVATION_STEPS import — kept as a module-level reference
// so future scatter stages can read it without re-importing.
void ELEVATION_STEPS;
