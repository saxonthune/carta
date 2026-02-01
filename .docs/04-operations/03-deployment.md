---
title: Deployment
status: draft
---

# Deployment

## Static Mode Build

```bash
npm run build        # Produces static assets in dist/
```

The static build is a single-page application with no server dependency. It can be hosted on any static file server (Netlify, Vercel, S3, GitHub Pages).

## Server Mode Build

Requires MongoDB and the collaboration server. See doc03.01.09 for server mode details.

## Desktop Build

```bash
cd packages/desktop
pnpm build        # Builds web-client, server, and desktop TypeScript
pnpm package      # Packages with electron-builder (dmg/zip for Mac, nsis/zip for Win, AppImage/deb for Linux)
```

The desktop build bundles the MCP server binary as an extraResource, enabling Claude Desktop integration.

## Environment Variables

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `VITE_STORAGE_BACKENDS` | `local`, `server`, `both` | `local` | Available storage providers |
| `VITE_AI_MODE` | `none`, `user-key`, `server-proxy`, `both` | `none` | AI chat configuration |
| `VITE_COLLABORATION` | `enabled`, `disabled` | `disabled` | Real-time sync availability |
| `VITE_CARTA_API_URL` | URL | `http://localhost:1234` | Server base URL |

In desktop mode, these are auto-configured by the Electron main process.
