// COA-5 task #114 — spawn placer debug log.
//
// Captures a snapshot of the spawn placer's decision surface so a bad
// deploy-zone placement can be diagnosed without re-running the
// pipeline. DebugSink's `data` channel only accepts flat scalar maps,
// so we emit one entry per phase with a flattened key prefix.

import type { DebugSink } from '../debug-sink';
import type { SpawnPlacerInput, SpawnPlacerResult } from '../spawn-placer';

export function logPlacerRun(
  sink: DebugSink,
  input: SpawnPlacerInput,
  result: SpawnPlacerResult,
): void {
  sink.info('spawn-placer', 'input', {
    mapW: input.W,
    mapH: input.H,
    regime: input.regime,
    team0Squads: input.rosterTeam0.squadCount,
    team0Units: input.rosterTeam0.unitCount,
    team1Squads: input.rosterTeam1.squadCount,
    team1Units: input.rosterTeam1.unitCount,
    anchors: input.objectiveAnchors.length,
  });
  sink.info('spawn-placer', 'axis', {
    cx: Math.round(result.axis.cx),
    cy: Math.round(result.axis.cy),
    angleRadians: Math.round(result.axis.angleRadians * 1000) / 1000,
  });
  sink.info('spawn-placer', 'bands-meters', {
    min: Math.round(result.bands.minimumSeparation),
    target: Math.round(result.bands.targetSeparation),
    max: Math.round(result.bands.maximumSeparation),
  });
  sink.info('spawn-placer', 'team0-zone', {
    x: result.team0.x,
    y: result.team0.y,
    w: result.team0.w,
    h: result.team0.h,
    facing: Math.round((result.team0.facing ?? 0) * 1000) / 1000,
    squads: result.team0.squadRects?.length ?? 0,
  });
  sink.info('spawn-placer', 'team1-zone', {
    x: result.team1.x,
    y: result.team1.y,
    w: result.team1.w,
    h: result.team1.h,
    facing: Math.round((result.team1.facing ?? 0) * 1000) / 1000,
    squads: result.team1.squadRects?.length ?? 0,
  });
  if (result.fallbackUsed) {
    sink.warn('spawn-placer', 'fallback carve used — scored pair failed separation gate');
  }
}
