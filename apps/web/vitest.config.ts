import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts: Vitest 3 runs on its own Vite version. Tests cover pure logic only.
export default defineConfig({
  resolve: { conditions: ['development'] },
  test: { include: ['src/**/*.test.ts'] },
});
