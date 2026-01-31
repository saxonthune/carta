import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // dagre's ESM build is fake ESM (CJS wrapped in export default) that uses
      // require("@dagrejs/graphlib") at runtime. Point to the real CJS file so
      // Vite's esbuild pre-bundler can convert it properly.
      // Use require.resolve to handle pnpm's .pnpm directory structure
      '@dagrejs/dagre': require.resolve('@dagrejs/dagre'),
      // Map workspace packages to source files for development
      '@carta/domain': path.resolve(__dirname, 'packages/domain/src/index.ts'),
      '@carta/compiler': path.resolve(__dirname, 'packages/compiler/src/index.ts'),
      '@carta/storage': path.resolve(__dirname, 'packages/storage/src/index.ts'),
    },
  },
  optimizeDeps: {
    include: ['@dagrejs/dagre'],
  },
})
