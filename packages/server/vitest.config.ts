import { defineConfig } from 'vitest/config';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    pool: 'forks',
    poolOptions: {
      forks: { maxForks: 4, minForks: 1, execArgv: ['--max-old-space-size=512'] },
    },
  },
  resolve: {
    alias: {
      '@carta/schema': path.resolve(__dirname, '../schema/src/index.ts'),
      '@carta/document': path.resolve(__dirname, '../document/src/index.ts'),
      '@carta/geometry': path.resolve(__dirname, '../geometry/src/index.ts'),
      'zod-to-json-schema': path.resolve(__dirname, '../../node_modules/.pnpm/zod-to-json-schema@3.25.1_zod@3.25.76/node_modules/zod-to-json-schema/dist/esm/index.js'),
    },
  },
});
