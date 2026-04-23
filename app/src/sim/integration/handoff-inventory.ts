// P7.15 helper — feature inventory at each pipeline handoff stage.
//
// Each pipeline stage receives then emits a data structure. This helper
// produces a plain-object "feature count summary" per stage, so tests can
// assert continuity — a feature present at stage N must still be present
// at stage N+1 or the data diverged.

export type FeatureInventory = {
  readonly elevationNonZero: number;
  readonly hotspots: number;
  readonly buildingCount: number;
  readonly buildingTiles: number;
  readonly pointTiles: number;
  readonly hedgeEdges: number;
  readonly dominantLinePresent: boolean;
  readonly heroLandmarkPresent: boolean;
  readonly shadingDistinctBytes: number;
};

type GridlikeShading =
  | Uint8ClampedArray
  | Uint8Array;

export function inventoryFromMapGenResult(r: {
  readonly elevationStep: Uint8Array;
  readonly point: Uint8Array;
  readonly buildingId: Uint16Array;
  readonly edgeN: Uint8Array;
  readonly edgeW: Uint8Array;
  readonly hotspots: readonly unknown[];
  readonly buildings: readonly unknown[];
  readonly dominantLine: unknown;
  readonly heroLandmark: unknown;
  readonly shadingBake: GridlikeShading;
}): FeatureInventory {
  let elev = 0;
  for (let i = 0; i < r.elevationStep.length; i++) if (r.elevationStep[i] > 0) elev++;
  let pt = 0;
  for (let i = 0; i < r.point.length; i++) if (r.point[i] > 0) pt++;
  let bld = 0;
  for (let i = 0; i < r.buildingId.length; i++) if (r.buildingId[i] > 0) bld++;
  let hedges = 0;
  for (let i = 0; i < r.edgeN.length; i++) {
    const kN = r.edgeN[i] & 0x0f;
    const kW = r.edgeW[i] & 0x0f;
    if (kN === 1 || kN === 2) hedges++;
    if (kW === 1 || kW === 2) hedges++;
  }
  const distinct = new Set<number>();
  for (let i = 0; i < r.shadingBake.length; i++) distinct.add(r.shadingBake[i]);
  return {
    elevationNonZero: elev,
    hotspots: r.hotspots.length,
    buildingCount: r.buildings.length,
    buildingTiles: bld,
    pointTiles: pt,
    hedgeEdges: hedges,
    dominantLinePresent: r.dominantLine !== null,
    heroLandmarkPresent: r.heroLandmark !== null,
    shadingDistinctBytes: distinct.size,
  };
}

// Convenience for WorldSnapshot inventory (missing dominantLine + hero).
export function inventoryFromSnapshot(snap: {
  readonly elevationStep: Uint8Array;
  readonly point: Uint8Array;
  readonly buildingId: Uint16Array;
  readonly edgeN: Uint8Array;
  readonly edgeW: Uint8Array;
  readonly buildings: readonly unknown[];
  readonly shadingBake: Uint8ClampedArray;
}): Omit<FeatureInventory, 'dominantLinePresent' | 'heroLandmarkPresent' | 'hotspots'> {
  let elev = 0;
  for (let i = 0; i < snap.elevationStep.length; i++) if (snap.elevationStep[i] > 0) elev++;
  let pt = 0;
  for (let i = 0; i < snap.point.length; i++) if (snap.point[i] > 0) pt++;
  let bld = 0;
  for (let i = 0; i < snap.buildingId.length; i++) if (snap.buildingId[i] > 0) bld++;
  let hedges = 0;
  for (let i = 0; i < snap.edgeN.length; i++) {
    const kN = snap.edgeN[i] & 0x0f;
    const kW = snap.edgeW[i] & 0x0f;
    if (kN === 1 || kN === 2) hedges++;
    if (kW === 1 || kW === 2) hedges++;
  }
  const distinct = new Set<number>();
  for (let i = 0; i < snap.shadingBake.length; i++) distinct.add(snap.shadingBake[i]);
  return {
    elevationNonZero: elev,
    buildingCount: snap.buildings.length,
    buildingTiles: bld,
    pointTiles: pt,
    hedgeEdges: hedges,
    shadingDistinctBytes: distinct.size,
  };
}

export function diffInventories(
  before: FeatureInventory,
  after: FeatureInventory,
): Partial<Record<keyof FeatureInventory, [unknown, unknown]>> {
  const out: Partial<Record<keyof FeatureInventory, [unknown, unknown]>> = {};
  for (const k of Object.keys(before) as (keyof FeatureInventory)[]) {
    if (before[k] !== after[k]) out[k] = [before[k], after[k]];
  }
  return out;
}
