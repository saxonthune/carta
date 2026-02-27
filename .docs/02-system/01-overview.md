---
title: Architecture Overview
status: active
---

# Architecture Overview

Carta is structured as five layers that can evolve independently.

## Layers

```
Domain Layer (@carta/schema)
  Core types, port registry, built-in schemas, utilities
  Platform-agnostic — no React, no Yjs
  Geometry utilities via @carta/geometry dependency

Document Layer (@carta/document)
  Shared Y.Doc operations, Yjs helpers, file format, migrations
  Level-aware CRUD for constructs, edges, schemas
  Compilation engine (compiler merged into this package)
  Platform-agnostic — no React, no browser APIs

Document Adapter Layer (packages/web-client/src/stores/, packages/web-client/src/contexts/)
  Yjs Y.Doc state management, persistence (IndexedDB or server)
  DocumentAdapter interface with Yjs implementation
  Imports shared helpers from @carta/document
  Does not know about React Flow or rendering

Presentation Model (packages/web-client/src/presentation/)
  Transforms domain state into view state — pure functions, no React
  Node visibility (organizer collapse), positioning (layout strategies)
  Component dispatch (render style + LOD band)
  Edge routing (remapping for collapsed organizers)
  See doc02.09

Visual Editor Layer (packages/web-client/src/components/, packages/web-client/src/hooks/)
  Canvas engine, node rendering, user interactions
  Feature directories: canvas/, metamap/, modals/, editors/, ui/
  CanvasContainer orchestrates Map (instance view) and Metamap (schema view)
  Consumes presentation model output — does not compute layout or visibility
  Does not know how to compile or persist
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
                         ↓
                   @carta/geometry
                         ↓
                    @carta/schema
                    ↓         ↘
          @carta/document   @carta/server(*)
                ↓
         @carta/web-client
                ↓
         @carta/desktop
```

All packages exist as shown. `@carta/types` provides platform-agnostic graph types (`CartaNode`, `CartaEdge`) used by adapters, hooks, and presentation layer — no React Flow or rendering dependencies. `@carta/geometry` provides geometry primitives and layout algorithms; `@carta/schema` re-exports geometry utilities via its `utils/` barrel. The compiler is merged into `@carta/document` — there is no separate `@carta/compiler` package.

### Barrel Exports

Packages and feature directories use barrel exports (`index.ts`) for organized public APIs:

**Packages:**
- `@carta/geometry` exports geometry primitives and layout algorithms
- `@carta/schema` exports from subdirectories: types, ports, schemas, utils, guides (utils re-exports `@carta/geometry`)
- `@carta/document` exports all shared Yjs helpers, file format, migrations, and compilation engine

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
User compiles -> compiler receives schemas -> generates relationship semantics -> AI output
```
