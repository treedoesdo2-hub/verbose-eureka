import type { BodyZone } from '@schema/common';

export type SnapshotUnit = {
  readonly id: number;
  readonly teamId: number;
  readonly operatorId: string | null;
  readonly x: number;
  readonly y: number;
  readonly facing: number;
  readonly blood: number;
  readonly actionKind: string;
  readonly aiState: string;
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
  | { kind: 'unit-hit'; shooter: number; target: number; tick: number }
  | { kind: 'unit-downed'; unitId: number; tick: number }
  | { kind: 'unit-died'; unitId: number; tick: number }
  | { kind: 'unit-stabilized'; medicId: number; targetId: number; tick: number };

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
