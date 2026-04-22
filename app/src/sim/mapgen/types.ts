import type { BiomeId, TerrainBase } from '@schema/map';
import type { BuildingRecord } from '../world';
import type { Hotspot } from './density-scatter';
import type { DominantCapillary, DominantLine } from './dominant-line';
import type { HeroLandmark } from './hero-landmark';

// Re-export walkability bit constants from world.ts so existing pipeline /
// scenario callers don't need two imports. Authoritative layout lives in
// world.ts (see ADR 012).
export {
  WALK_FOOT,
  WALK_PRONE,
  WALK_MECH,
  WALK_POWER_ARMOR,
  WALK_WHEELED,
  WALK_TRACKED,
  WALK_SLOW,
  WALK_CUT_REQUIRED,
  WALK_CLIMB_ONLY,
  WALK_DOOR,
  WALK_INFANTRY_MASK,
  WALK_CHASSIS_VEHICLE_MASK,
} from '../world';

export type SpawnRegime = 'meeting' | 'assault' | 'defence' | 'storming' | 'custom';

export type RosterSpec = {
  readonly squadCount: number;
  readonly unitCount: number;
};

export type MapGenRequest = {
  readonly seed: string;
  readonly biome: BiomeId;
  readonly size: number; // square maps only at MVP
  readonly tileSizeMeters: number;
  readonly tags?: readonly string[];
  readonly generationVersion: number;
  readonly spawnRegime?: SpawnRegime;
  readonly rosterTeam0?: RosterSpec;
  readonly rosterTeam1?: RosterSpec;
};

export type DeployZone = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  // COA-5 spawn placer output — optional to keep older authored-map
  // fixtures + tests that construct DeployZone from {x,y,w,h} alone
  // compatible. Facing is in radians (+X east, +Y south); squadRects
  // subdivides the zone one rect per squad.
  readonly facing?: number;
  readonly squadRects?: readonly { readonly x: number; readonly y: number; readonly w: number; readonly h: number }[];
};

export type ObjectiveAnchor = {
  readonly kindHint: 'extract' | 'defend' | 'secure';
  readonly rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly qualityScore: number;
};

export type MapGenDiagnostics = {
  readonly retryCount: number;
  readonly hotspotsFound: number;
  readonly hotspotsDropped: number;
  readonly carvedCells: number;
  readonly prunedClusters: number;
  // COA-1 density-driven scatter diagnostics. 0 means density scatter was
  // not used (pre-COA-1 pipeline path).
  readonly densityScatterChildren: number;
  readonly densityScatterRejected: number;
};

export type MapGenResult = {
  readonly request: MapGenRequest;
  readonly width: number;
  readonly height: number;
  // Per-tile grids — mirror the World layout (ADR 012).
  readonly base: Uint8Array;
  readonly point: Uint8Array;
  readonly edgeN: Uint8Array;
  readonly edgeW: Uint8Array;
  readonly edgeOverrideN: Uint8Array;
  readonly edgeOverrideW: Uint8Array;
  readonly buildingId: Uint16Array;
  readonly walkability: Uint16Array;
  readonly coverProfile: Uint8Array;
  readonly elevationStep: Uint8Array;
  readonly structureHeight: Uint8Array;
  readonly hpN: Uint16Array;
  readonly hpW: Uint16Array;
  readonly hpPoint: Uint16Array;
  readonly buildings: readonly BuildingRecord[];
  // Continuous elevation kept as a debug/render aid (minimap contours).
  readonly elevation: Float32Array;
  // Continuous cover-density field driving cluster scatter (COA-1).
  readonly coverDensity: Float32Array;
  // COA-1 hotspot + cluster outputs. Non-COA-1 pipelines leave these empty /
  // null. clusterMembership is a per-tile Int16Array where -1 = not in any
  // cluster, 0..n-1 = assigned to hotspots[i].
  readonly hotspots: readonly Hotspot[];
  readonly clusterMembership: Int16Array;
  // COA-4 spatial identity. Dominant line + capillaries + single hero
  // landmark carry the map's visual character through to briefings. Empty
  // arrays / null for pre-COA-4 pipelines.
  readonly dominantLine: DominantLine | null;
  readonly capillaries: readonly DominantCapillary[];
  readonly heroLandmark: HeroLandmark | null;
  readonly deployZones: { readonly team0: DeployZone; readonly team1: DeployZone };
  readonly objectiveAnchors: readonly ObjectiveAnchor[];
  readonly diagnostics: MapGenDiagnostics;
  readonly hash: number;
};

export type TerrainByte = number;
export type BiomeWeight = { readonly terrain: TerrainBase; readonly weight: number };
