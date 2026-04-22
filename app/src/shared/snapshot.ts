import type { BodyZone } from '@schema/common';

export type SnapshotStance = 'standing' | 'crouched' | 'prone';
export type SnapshotAiState = 'advance' | 'hold' | 'retreat' | 'flank' | 'recover' | 'panic';
export type SnapshotShotOutcome = 'wound' | 'block' | 'miss';
export type SnapshotMissReason = 'accuracy' | 'cover' | 'range';
export type SnapshotDownedCause = 'bleedout' | 'combat';

export type SnapshotUnit = {
  readonly id: number;
  readonly teamId: number;
  readonly operatorId: string | null;
  readonly x: number;
  readonly y: number;
  readonly facing: number;
  readonly blood: number;
  readonly suppression: number;
  readonly morale: number;
  readonly stance: SnapshotStance;
  readonly actionKind: string;
  readonly aiState: SnapshotAiState;
  readonly alerted: boolean;
  readonly ammo: number;
  readonly targetId: number | null;
  readonly wounds: readonly {
    zone: BodyZone;
    severity: string;
    treatment: string;
    bleedRate: number;
  }[];
};

export type SnapshotEvent =
  | { kind: 'unit-fired'; shooter: number; target: number; tick: number }
  | {
      kind: 'unit-hit';
      shooter: number;
      target: number;
      outcome: SnapshotShotOutcome;
      zone: BodyZone | null;
      woundId: number | null;
      reason: SnapshotMissReason | null;
      tick: number;
    }
  | { kind: 'unit-downed'; unitId: number; cause: SnapshotDownedCause; tick: number }
  | { kind: 'unit-died'; unitId: number; tick: number }
  | { kind: 'unit-stabilized'; medicId: number; targetId: number; tick: number }
  | { kind: 'unit-pinned'; unitId: number; tick: number }
  | { kind: 'unit-broke'; unitId: number; tick: number }
  | { kind: 'unit-rallied'; unitId: number; tick: number };

export type SimSnapshot = {
  readonly tick: number;
  readonly ended: boolean;
  readonly endReason?: string;
  readonly units: readonly SnapshotUnit[];
  readonly events: readonly SnapshotEvent[];
};

export type SerializedWorld = {
  readonly width: number;
  readonly height: number;
  readonly tileSizeMeters: number;
  readonly terrain: Uint8Array;
};

export type WorldSnapshot = SerializedWorld;

export type PerUnitStats = {
  readonly unitId: number;
  readonly teamId: number;
  readonly operatorId: string | null;
  readonly shotsFired: number;
  readonly hitsLanded: number;
  readonly shotsBlocked: number;
  readonly shotsMissed: number;
  readonly woundsReceived: number;
  readonly kills: number;
  readonly downs: number;
  readonly alliesStabilized: number;
  readonly survived: boolean;
};

export type MatchHighlight = {
  readonly kind: 'ace' | 'medic' | 'held-under-fire' | 'heavy-casualty';
  readonly unitId: number;
  readonly operatorId: string | null;
  readonly text: string;
};

export type MatchStats = {
  readonly totalTicks: number;
  readonly perUnit: readonly PerUnitStats[];
  readonly highlights: readonly MatchHighlight[];
};
