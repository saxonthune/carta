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
pnpm server       # Start MongoDB + collaboration server
pnpm dev:client   # Start client in server mode
```

Visit `http://localhost:5173/?doc=my-document-id`.

## Monorepo

Packages live in `packages/`. The web client lives in root `src/`. The domain package (`@carta/domain`) is resolved via Vite/TypeScript aliases.

Currently existing packages: `@carta/domain`, `@carta/server`, `@carta/compiler`, `@carta/storage`. See doc02.01 for the target dependency graph.

## Key Directories

```
src/
  components/       UI components
  hooks/            React hooks
  contexts/         React contexts (DocumentContext)
  stores/           Document adapter and Yjs implementation
  constructs/       Port registry, schemas, compiler
  ai/               AI sidebar and tools
  utils/            Utilities (file I/O, display, examples)

packages/
  domain/           Shared types, port registry, built-in schemas
  compiler/         Compilation engine
  server/           Collaboration server + MCP server
```
