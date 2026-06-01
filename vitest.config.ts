import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // §12.4: ≥80% line coverage on encoder, solver wrapper, inference engine.
      include: [
        'src/core/**/*.ts',
      ],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts'],
    },
    // jsdom environment is selected per-file via // @vitest-environment jsdom
    environmentMatchGlobs: [
      ['tests/ui/**', 'jsdom'],
      ['src/**/*.test.tsx', 'jsdom'],
    ],
  },
});
