import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      // This version of @vitest/coverage-v8 reports every file matched by `include` at 0% by
      // default (no `all` flag needed/available) — without `include` here, untested files would
      // simply be absent from the report instead of showing as 0%, making coverage look higher
      // than it actually is.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
