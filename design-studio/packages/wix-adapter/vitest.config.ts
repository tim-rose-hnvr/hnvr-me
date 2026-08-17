import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary', 'lcov'],
      thresholds: { statements: 90, branches: 78, functions: 95, lines: 90 },
    },
  },
});
