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
  | 'miss-debris'
  | 'explosion-core'
  | 'explosion-ring'
  | 'explosion-shock'
  | 'explosion-debris'
  | 'smoke-puff'
  | 'dust-puff'
  | 'shell-casing'
  | 'shell-casing-decal';

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
  'explosion-core',
  'explosion-ring',
  'explosion-shock',
  'explosion-debris',
  'smoke-puff',
  'dust-puff',
  'shell-casing',
  'shell-casing-decal',
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
  'explosion-core': 120,
  'explosion-ring': 220,
  'explosion-shock': 300,
  'explosion-debris': 450,
  'smoke-puff': 2800,
  'dust-puff': 500,
  'shell-casing': 650,
  'shell-casing-decal': 4500,
};
