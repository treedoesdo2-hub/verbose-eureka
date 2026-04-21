import { hashState } from './hash';
import { Rng } from './rng';
import type { SimState } from './state';
import { tick } from './tick';

export type ReplayRecord = {
  readonly seed: number;
  readonly initialHash: string;
  readonly totalTicks: number;
  readonly finalHash: string;
};

export class RecordingSim {
  private readonly rng: Rng;
  private readonly seed: number;
  private readonly initialHash: string;
  private state: SimState;

  constructor(initialState: SimState, seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.state = initialState;
    this.initialHash = hashState(initialState);
  }

  step(): SimState {
    this.state = tick(this.state, this.rng);
    return this.state;
  }

  current(): SimState {
    return this.state;
  }

  finish(): ReplayRecord {
    return {
      seed: this.seed,
      initialHash: this.initialHash,
      totalTicks: this.state.tick,
      finalHash: hashState(this.state),
    };
  }
}

export function replay(
  initialState: SimState,
  record: ReplayRecord,
): { state: SimState; finalHash: string; initialHashMatches: boolean } {
  if (hashState(initialState) !== record.initialHash) {
    return {
      state: initialState,
      finalHash: hashState(initialState),
      initialHashMatches: false,
    };
  }

  const rng = new Rng(record.seed);
  let state = initialState;

  for (let t = 0; t < record.totalTicks; t++) {
    state = tick(state, rng);
  }

  return {
    state,
    finalHash: hashState(state),
    initialHashMatches: true,
  };
}
