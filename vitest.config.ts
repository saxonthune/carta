import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/main.tsx'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
      '@carta/domain': path.resolve(__dirname, 'packages/domain/src/index.ts'),
      '@carta/compiler': path.resolve(__dirname, 'packages/compiler/src/index.ts'),
      '@carta/storage': path.resolve(__dirname, 'packages/storage/src/index.ts'),
    },
  },
});
