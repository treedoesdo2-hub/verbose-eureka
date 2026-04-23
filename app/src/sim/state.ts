import type { BodyZone } from '@schema/common';
import type { ObjectiveKind } from '@schema/contract';
import type { UnitId } from '@shared/ids';
import type { DominantLine } from './mapgen/dominant-line';
import type { HeroLandmark } from './mapgen/hero-landmark';
import type { NoiseKind } from './noise';
import type { RngSnapshot } from './rng';
import type { SquadRuntimeState } from './squad';
import type { Unit, Vec2, WoundType } from './unit';
import type { World } from './world';

export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;

export type ShotOutcomeKind = 'wound' | 'block' | 'miss';
export type ShotMissReason = 'accuracy' | 'cover' | 'range';
export type DownedCause = 'bleedout' | 'combat';

export type ObjectiveStatus = 'active' | 'complete' | 'failed';
export type ObjectiveRect = { x: number; y: number; w: number; h: number };

export type ObjectiveRuntimeParams =
  | { kind: 'extract'; zone: ObjectiveRect; minUnitsInside: number }
  | { kind: 'defend'; zone: ObjectiveRect; holdTicks: number }
  | { kind: 'secure'; zone: ObjectiveRect; holdTicks: number };

export type ObjectiveRuntimeState = {
  readonly id: string;
  readonly kind: ObjectiveKind;
  readonly description: string;
  readonly params: ObjectiveRuntimeParams;
  readonly status: ObjectiveStatus;
  readonly progressTicks: number;
};

export type SimEvent =
  | { kind: 'unit-spawned'; unitId: UnitId; tick: number }
  | { kind: 'unit-moved'; unitId: UnitId; tick: number }
  | { kind: 'unit-spotted'; observer: UnitId; target: UnitId; tick: number }
  | { kind: 'unit-fired'; shooter: UnitId; target: UnitId; tick: number }
  | {
      kind: 'unit-hit';
      shooter: UnitId;
      target: UnitId;
      outcome: ShotOutcomeKind;
      zone: BodyZone | null;
      woundId: number | null;
      reason: ShotMissReason | null;
      woundType: WoundType | null;
      tick: number;
    }
  | { kind: 'unit-downed'; unitId: UnitId; cause: DownedCause; tick: number }
  | { kind: 'unit-died'; unitId: UnitId; tick: number }
  | { kind: 'unit-stabilized'; medicId: UnitId; targetId: UnitId; tick: number }
  | { kind: 'unit-pinned'; unitId: UnitId; tick: number }
  | { kind: 'unit-broke'; unitId: UnitId; tick: number }
  | { kind: 'unit-rallied'; unitId: UnitId; tick: number }
  | { kind: 'noise-emitted'; sourceUnitId: UnitId; pos: Vec2; noiseKind: NoiseKind; tick: number }
  | {
      kind: 'objective-status-changed';
      objectiveId: string;
      from: ObjectiveStatus;
      to: ObjectiveStatus;
      tick: number;
    };

export type SimState = {
  readonly tick: number;
  readonly rngSnapshot: RngSnapshot;
  readonly world: World;
  readonly units: ReadonlyMap<UnitId, Unit>;
  readonly events: readonly SimEvent[];
  readonly nextWoundId: number;
  readonly objectives: readonly ObjectiveRuntimeState[];
  readonly ended: boolean;
  readonly endReason?: string;
  // Team anchor positions (meters). Used as fallback attractors for the
  // waypoint regen + BT terminal fallback so units don't idle on empty
  // maps with no objective progress.
  readonly team0HomePos: Vec2;
  readonly team1HomePos: Vec2;
  // ADR 003 squad hierarchy: player units belong to squads and follow a
  // leader while the squad's order is 'advance'. Keyed by SquadRuntimeState.id.
  readonly squads: ReadonlyMap<string, SquadRuntimeState>;
  // Tick of the most recent combat-shaped event (fired / hit / downed /
  // died / stabilized). Used by the stalemate watchdog to force-end
  // matches where both sides have fallen out of engagement and the BT
  // can't re-acquire — see @desktop's 2026-04-23 stall finding.
  readonly lastCombatTick: number;
  // COA-4 map metadata — dominant line + hero landmark carry the map's
  // spatial identity through to briefing UI + AI waypoint hints. Null on
  // pre-COA-4 scenarios (authored fixtures that predate the pipeline
  // rewrite).
  readonly mapMeta: MapMeta;
};

export type MapMeta = {
  readonly dominantLine: DominantLine | null;
  readonly heroLandmark: HeroLandmark | null;
};

export const EMPTY_MAP_META: MapMeta = {
  dominantLine: null,
  heroLandmark: null,
};
