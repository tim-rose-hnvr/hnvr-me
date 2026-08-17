import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 180_000,
    hookTimeout: 180_000,
    coverage: { provider: 'v8', include: ['src/**/*.ts'], reporter: ['text-summary'] },
  },
});
