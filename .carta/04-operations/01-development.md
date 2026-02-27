---
title: Development
status: active
---

# Development

## Prerequisites

- Node.js
- pnpm

## Quick Start

```bash
pnpm install
pnpm demo         # Static mode (single-user, no server)
```

Visit `http://localhost:5173`.

## Server Mode

```bash
pnpm server       # Start MongoDB + document server
pnpm client       # Start client in server mode
```

Visit `http://localhost:5173/?doc=my-document-id`.

## Desktop Mode

```bash
cd packages/desktop
pnpm dev          # Build TypeScript + launch Electron (connects to Vite dev server)
pnpm build        # Full production build (web-client + server + desktop)
pnpm package      # Package with electron-builder
```

The desktop app starts an embedded document server, then opens the web client connected to it via WebSocket.

## Monorepo

All packages live in `packages/`, including the web client (`@carta/web-client`). Cross-package dependencies are resolved via Vite/TypeScript aliases.

Currently existing packages: `@carta/geometry`, `@carta/schema`, `@carta/document`, `@carta/server`, `@carta/web-client`, `@carta/desktop`. See doc02.01 for the target dependency graph. Note: `@carta/compiler` has been merged into `@carta/document`.

## Key Directories

```
packages/
  web-client/src/   React web application
    components/     UI components
    hooks/          React hooks
    contexts/       React contexts (DocumentContext)
    stores/         Document adapter and Yjs implementation
    canvas-engine/  Canvas rendering primitives
    ai/             AI sidebar and tools
    utils/          Utilities (file I/O, display, examples)
  types/            Platform-agnostic graph types (CartaNode, CartaEdge)
  geometry/         Geometry primitives and layout algorithms
  schema/           Shared types, port registry, built-in schemas
  document/         Shared Y.Doc operations, Yjs helpers, file format, migrations, compiler
  server/           Document server + MCP server
  desktop/          Electron desktop app with embedded server
```
