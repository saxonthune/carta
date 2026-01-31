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

## Environment Variables

- `VITE_STATIC_MODE`: Set to `true` for static mode (default in dev). Controls UI visibility of collaboration features.
