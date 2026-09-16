import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['src/content/**', 'jsdom']],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/shared/**/*.ts'],
      exclude: ['**/*.test.ts'],
      thresholds: { lines: 85, functions: 85, branches: 80 },
    },
  },
});
