import { createRequire } from 'module'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const require = createRequire(import.meta.url)

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
    },
  },
  optimizeDeps: {
    include: ['@dagrejs/dagre'],
  },
})
