import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary', 'lcov'],
      // Sperrklinke, kein Ziel: die Schwellen liegen knapp unter dem Ist-Stand.
      // Sie sollen einen Rückschritt melden, nicht zum Abdeckungsschreiben zwingen.
      thresholds: { statements: 90, branches: 85, functions: 92, lines: 90 },
    },
  },
});
