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
      '@carta/geometry': path.resolve(__dirname, '../geometry/src/index.ts'),
    },
  },
});
