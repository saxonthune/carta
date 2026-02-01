---
title: Architecture Overview
status: active
---

# Architecture Overview

Carta is structured as three decoupled layers that can evolve independently, plus a shared domain package.

## Layers

```
Domain Layer (@carta/domain)
  Core types, port registry, built-in schemas, utilities
  Platform-agnostic — no React, no Yjs

Document Adapter Layer (src/stores/, src/contexts/)
  Yjs Y.Doc state management, IndexedDB persistence
  DocumentAdapter interface with Yjs implementation
  Does not know about React Flow or rendering

Visual Editor Layer (src/components/, src/hooks/)
  React Flow canvas, node rendering, user interactions
  Map (instance view) and Metamap (schema view)
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
          @carta/storage  @carta/compiler
               |               |
        @carta/web-client   @carta/server
               |               |
        @carta/desktop      @carta/cli
```

Currently `@carta/domain`, `@carta/server`, `@carta/compiler`, and `@carta/storage` exist as packages. The web client lives in root `src/`.

## Data Flow

```
User adds node -> adapter fetches schema -> editor creates node with semanticId
User edits fields -> node data updated -> synced to Yjs Y.Doc -> persisted to IndexedDB
User drags port to port -> portRegistry.canConnect() validates -> connection stored on construct -> edge rendered
User compiles -> compiler receives schemas/deployables -> generates relationship semantics -> AI output
```
