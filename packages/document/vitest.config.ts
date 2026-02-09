import { defineConfig } from 'vitest/config';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@carta/domain': path.resolve(__dirname, '../domain/src/index.ts'),
      '@carta/compiler': path.resolve(__dirname, '../compiler/src/index.ts'),
    },
  },
});
