import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEBUG_LOG_PATH = '/tmp/carta-layout-debug.log'

function debugLogPlugin(): Plugin {
  return {
    name: 'debug-log',
    configureServer(server) {
      server.middlewares.use('/__debug_log', (req, res) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            fs.appendFileSync(DEBUG_LOG_PATH, body + '\n')
            res.writeHead(200)
            res.end('ok')
          })
        } else {
          res.writeHead(405)
          res.end()
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), debugLogPlugin()],
  resolve: {
    alias: {
      // dagre's ESM build is fake ESM (CJS wrapped in export default) that uses
      // require("@dagrejs/graphlib") at runtime. Point to the real CJS file so
      // Vite's esbuild pre-bundler can convert it properly.
      // Use require.resolve to handle pnpm's .pnpm directory structure
      '@dagrejs/dagre': require.resolve('@dagrejs/dagre'),
      // Map workspace packages to source files for development
      '@carta/domain': path.resolve(__dirname, '../domain/src/index.ts'),
      '@carta/compiler': path.resolve(__dirname, '../compiler/src/index.ts'),
      '@carta/document': path.resolve(__dirname, '../document/src/index.ts'),
    },
  },
  optimizeDeps: {
    include: ['@dagrejs/dagre'],
  },
})
