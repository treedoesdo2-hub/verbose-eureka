export type FxKind =
  | 'tracer'
  | 'tracer-trail'
  | 'muzzle-core'
  | 'muzzle-bloom'
  | 'muzzle-smoke'
  | 'wound-chunk'
  | 'wound-spray'
  | 'wound-pool'
  | 'block-spark'
  | 'block-ring'
  | 'miss-dust'
  | 'miss-debris';

export const ALL_FX_KINDS: readonly FxKind[] = [
  'tracer',
  'tracer-trail',
  'muzzle-core',
  'muzzle-bloom',
  'muzzle-smoke',
  'wound-chunk',
  'wound-spray',
  'wound-pool',
  'block-spark',
  'block-ring',
  'miss-dust',
  'miss-debris',
];

export const TTL_MS: Record<FxKind, number> = {
  tracer: 150,
  'tracer-trail': 220,
  'muzzle-core': 60,
  'muzzle-bloom': 120,
  'muzzle-smoke': 220,
  'wound-chunk': 250,
  'wound-spray': 350,
  'wound-pool': 900,
  'block-spark': 200,
  'block-ring': 180,
  'miss-dust': 260,
  'miss-debris': 200,
};
