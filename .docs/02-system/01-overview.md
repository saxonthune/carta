---
title: Architecture Overview
status: active
---

# Architecture Overview

Carta is structured as five layers that can evolve independently.

## Layers

```
Domain Layer (@carta/domain)
  Core types, port registry, built-in schemas, utilities
  Platform-agnostic — no React, no Yjs

Document Layer (@carta/document)
  Shared Y.Doc operations, Yjs helpers, file format, migrations
  Level-aware CRUD for constructs, edges, deployables, schemas
  Platform-agnostic — no React, no browser APIs

Document Adapter Layer (packages/web-client/src/stores/, packages/web-client/src/contexts/)
  Yjs Y.Doc state management, persistence (IndexedDB or server)
  DocumentAdapter interface with Yjs implementation
  Imports shared helpers from @carta/document
  Does not know about React Flow or rendering

Visual Editor Layer (packages/web-client/src/components/, packages/web-client/src/hooks/)
  React Flow canvas, node rendering, user interactions
  Feature directories: canvas/, metamap/, modals/, editors/, ui/
  CanvasContainer orchestrates Map (instance view) and Metamap (schema view)
  Does not know how to compile or persist

Compiler Layer (@carta/compiler)
  Transforms canvas state into AI-readable output
  Pure functions — receives schemas/deployables as parameters
  Does not know about the visual editor
```

## Why This Separation

1. The visual editor can add features (multi-select, keyboard shortcuts) without touching construct logic
2. New construct types work without modifying the editor or compiler
3. New output formats don't change how constructs are defined or rendered
4. User-defined constructs work seamlessly because all layers interact through interfaces

## Monorepo Structure

Target dependency graph (packages can only depend on packages above them):

```
                    @carta/types
                         |
                    @carta/domain
                   /      |      \
       @carta/compiler  @carta/document
                   |    /        \
        @carta/web-client   @carta/server
               |
        @carta/desktop
```

Currently `@carta/domain`, `@carta/document`, `@carta/compiler`, `@carta/server`, `@carta/web-client`, and `@carta/desktop` exist as packages.

### Barrel Exports

Packages and feature directories use barrel exports (`index.ts`) for organized public APIs:

**Packages:**
- `@carta/domain` exports from subdirectories: types, ports, schemas, utils, guides
- `@carta/document` exports all shared Yjs helpers, file format, migrations
- `@carta/compiler` exports CompilerEngine and formatters

**Web client feature directories:**
- `hooks/` — Organized by purpose: document state, UI state, utilities
- `components/canvas/` — Canvas components and LOD system
- `components/metamap/` — Schema view components
- `components/modals/` — All modal dialogs
- `components/ui/` — Primitives, navigation, menus, icons, domain components

## Data Flow

```
User adds node -> adapter fetches schema -> editor creates node with semanticId
User edits fields -> node data updated -> synced to Yjs Y.Doc -> persisted to IndexedDB
User drags port to port -> portRegistry.canConnect() validates -> connection stored on construct -> edge rendered
User compiles -> compiler receives schemas/deployables -> generates relationship semantics -> AI output
```
