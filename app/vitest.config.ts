import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@sim': resolve(__dirname, 'src/sim'),
      '@schema': resolve(__dirname, 'src/schema'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@test-helpers': resolve(__dirname, 'src/__test-helpers__'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
    // ADR 014 §Pillar A — 4096-tile map target. Mapgen-heavy tests (full
    // pipeline + N-tick sim) routinely take 2–4s each on a warm CPU and
    // hit the default 5s ceiling under file-parallelism CPU starvation.
    // 30s gives plenty of headroom without masking real regressions —
    // a stuck test still fails fast in absolute terms.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
