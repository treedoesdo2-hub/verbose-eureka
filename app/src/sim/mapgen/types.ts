import type { BiomeId, TerrainKind } from '@schema/map';

// Derived walkability bits. Packed in one byte.
export const WALK_FOOT = 1 << 0;
export const WALK_WHEELED = 1 << 1;
export const WALK_PRONE_ONLY = 1 << 2;

export type MapGenRequest = {
  readonly seed: string;
  readonly biome: BiomeId;
  readonly size: number; // square maps only at MVP
  readonly tileSizeMeters: number;
  readonly tags?: readonly string[];
  readonly generationVersion: number;
};

export type DeployZone = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type ObjectiveAnchor = {
  readonly kindHint: 'extract' | 'defend' | 'secure';
  readonly rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly qualityScore: number;
};

export type MapGenResult = {
  readonly request: MapGenRequest;
  readonly width: number;
  readonly height: number;
  readonly terrain: Uint8Array;
  readonly elevation: Float32Array;
  readonly walkability: Uint8Array;
  readonly coverValue: Uint8Array;
  readonly structureHeight: Uint8Array;
  readonly deployZones: { readonly team0: DeployZone; readonly team1: DeployZone };
  readonly objectiveAnchors: readonly ObjectiveAnchor[];
  readonly hash: number;
};

export type TerrainByte = number;
export type BiomeWeight = { readonly terrain: TerrainKind; readonly weight: number };
