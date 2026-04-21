import { hashState } from './hash';
import { Rng } from './rng';
import type { SimInput, SimState } from './state';
import { tick } from './tick';

export type ReplayRecord = {
  readonly seed: number;
  readonly initialHash: string;
  readonly inputs: ReadonlyMap<number, SimInput>;
  readonly totalTicks: number;
  readonly finalHash: string;
};

export class RecordingSim {
  private readonly rng: Rng;
  private readonly inputs = new Map<number, SimInput>();
  private readonly seed: number;
  private readonly initialHash: string;
  private state: SimState;

  constructor(initialState: SimState, seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.state = initialState;
    this.initialHash = hashState(initialState);
  }

  step(input: SimInput = { kind: 'none' }): SimState {
    if (input.kind !== 'none') this.inputs.set(this.state.tick, input);
    this.state = tick(this.state, input, this.rng);
    return this.state;
  }

  current(): SimState {
    return this.state;
  }

  finish(): ReplayRecord {
    return {
      seed: this.seed,
      initialHash: this.initialHash,
      inputs: new Map(this.inputs),
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
    const input = record.inputs.get(state.tick) ?? { kind: 'none' as const };
    state = tick(state, input, rng);
  }

  return {
    state,
    finalHash: hashState(state),
    initialHashMatches: true,
  };
}
