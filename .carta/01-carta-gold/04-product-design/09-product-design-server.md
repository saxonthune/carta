---
title: Product Design Server
status: draft
summary: Thin filesystem server that bridges the product design canvas to local files — REST API for canvas and source CRUD, SSE for live file watching
tags: [server, product-design, canvas, filesystem, api]
deps: [doc01.01.01.00, doc01.01.01.04]
---

# Product Design Server

A thin Node.js server that gives the product design canvas filesystem access. The browser can't read/write files directly, so the server bridges the gap: serves the web client, exposes REST endpoints for canvas and source file operations, and pushes file changes via SSE.

## Entities

**Canvas** — a `.carta-canvas.json` file. Stores which source files to show and where to position them on screen. A saved view. Contains no domain data — just references and layout.

**Source** — a markdown file containing one or more `carta` code blocks. Each block is a structure instance (enumeration, entity model, etc.). The source file is the domain truth. Multiple canvases can reference the same source. Blocks are addressable parts of a source (source + blockIndex), not separate entities.

## API Surface

### Canvas

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/api/canvas/:path` | — | Read canvas file + all parsed source files. Returns `{ canvas, files }` where `files` is each source parsed into blocks. |
| PUT | `/api/canvas/:path/layout` | `{ layout: FileContainerLayout[] }` | Update layout positions in the canvas file |
| POST | `/api/canvas/:path/sources` | `{ filename: string }` | Add a source file reference to the canvas |
| DELETE | `/api/canvas/:path/sources/:filename` | Remove a source file reference from the canvas |

### Source

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/api/sources` | — | List available `.md` files in the canvas directory (for "add file" picker) |
| POST | `/api/sources` | `{ filename: string, block: { name, type, body } }` | Create a new `.md` file with an initial carta code block |
| PUT | `/api/sources/:filename/blocks/:index` | `{ body: Record<string, unknown> }` | Update a block's body in a source file. Reads current file, calls `updateBlock`, writes back. |

### Watch

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/canvas/:path/watch` | SSE stream. Server watches the canvas's source files with `fs.watch` (debounced). Pushes `{ event: 'file-changed', filename, blocks }` when a source file changes externally. |

## CLI Entry Point

```
carta canvas serve specs/hr-domain.carta-canvas.json
```

Starts the server, opens the canvas in the default browser. Source file paths in the canvas are resolved relative to the canvas file's directory.

## Delivery Model

This replaces the VS Code extension as the primary delivery mechanism for the product design canvas. The extension can later spawn this server and load the URL in a WebView, instead of reimplementing file I/O itself.

No relation to `@carta/server` — that package is for the collaborative web platform (doc01.03.09). This is a local-only, single-user tool.
