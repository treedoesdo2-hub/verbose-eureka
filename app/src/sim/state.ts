import type { BodyZone } from '@schema/common';
import type { UnitId } from '@shared/ids';
import type { NoiseKind } from './noise';
import type { RngSnapshot } from './rng';
import type { Unit, Vec2, WoundType } from './unit';
import type { World } from './world';

export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;

export type ShotOutcomeKind = 'wound' | 'block' | 'miss';
export type ShotMissReason = 'accuracy' | 'cover' | 'range';
export type DownedCause = 'bleedout' | 'combat';

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
  | { kind: 'noise-emitted'; sourceUnitId: UnitId; pos: Vec2; noiseKind: NoiseKind; tick: number };

export type SimState = {
  readonly tick: number;
  readonly rngSnapshot: RngSnapshot;
  readonly world: World;
  readonly units: ReadonlyMap<UnitId, Unit>;
  readonly events: readonly SimEvent[];
  readonly nextWoundId: number;
  readonly ended: boolean;
  readonly endReason?: string;
};
