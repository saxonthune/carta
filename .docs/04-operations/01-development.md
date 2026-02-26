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
pnpm dev          # Static mode (single-user, no server)
```

Visit `http://localhost:5173`.

## Server Mode

```bash
pnpm server       # Start MongoDB + document server
pnpm dev:client   # Start client in server mode
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

Currently existing packages: `@carta/schema`, `@carta/document`, `@carta/compiler`, `@carta/server`, `@carta/web-client`, `@carta/desktop`. See doc02.01 for the target dependency graph.

## Key Directories

```
packages/
  web-client/src/   React web application
    components/     UI components
    hooks/          React hooks
    contexts/       React contexts (DocumentContext)
    stores/         Document adapter and Yjs implementation
    constructs/     Port registry, schemas, compiler
    ai/             AI sidebar and tools
    utils/          Utilities (file I/O, display, examples)
  domain/           Shared types, port registry, built-in schemas
  document/         Shared Y.Doc operations, Yjs helpers, file format, migrations
  compiler/         Compilation engine
  server/           Document server + MCP server
  desktop/          Electron desktop app with embedded server
```
