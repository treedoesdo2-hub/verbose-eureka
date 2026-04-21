import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@sim': resolve('src/sim'),
        '@schema': resolve('src/schema'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react()],
  },
});
