import type { ObjectiveKind } from '@schema/contract';

export type ObjectiveStatus = 'active' | 'complete' | 'failed';

export type HudObjective = {
  readonly kind: ObjectiveKind;
  readonly description: string;
  readonly status: ObjectiveStatus;
};

export type HudEventSeverity = 'kill' | 'down' | 'wound' | 'stabilize' | 'morale' | 'misc';

export type HudEventEntry = {
  readonly id: string;
  readonly tick: number;
  readonly severity: HudEventSeverity;
  readonly text: string;
};

export type MinimapProjection = {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly width: number;
  readonly height: number;
};
