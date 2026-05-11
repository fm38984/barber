import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
      },
    },
    alias: {
      '@barberflow/db': resolve(__dirname, '../../packages/db/src'),
      '@barberflow/shared-types': resolve(__dirname, '../../packages/shared-types/src'),
    },
  },
});
