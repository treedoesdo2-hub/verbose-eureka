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
  },
});
