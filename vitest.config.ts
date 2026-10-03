import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@credaver/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@credaver/x402-guard': path.resolve(__dirname, 'packages/x402-guard/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.{test,spec}.ts', 'apps/**/*.{test,spec}.ts'],
  },
});
