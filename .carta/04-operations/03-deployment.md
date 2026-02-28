---
title: Deployment
status: draft
---

# Deployment

## Web Build

```bash
pnpm build        # Produces static assets in dist/
```

The build is a single-page application. It can be hosted on any static file server (Netlify, Vercel, S3, GitHub Pages). Whether it operates in single-document or multi-document mode depends on the `VITE_SYNC_URL` environment variable at build time.

Without a server URL, the app runs in single-document mode (IndexedDB only, like Excalidraw). With a server URL, it connects for document storage and collaboration.

## Environment Variables

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `VITE_SYNC_URL` | URL string or absent | absent | Server to connect to. Presence enables server mode. |
| `VITE_AI_MODE` | `none`, `user-key`, `server-proxy` | `none` | How AI chat gets credentials |

See doc02.05 for full deployment configuration details.
