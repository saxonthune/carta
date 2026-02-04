---
title: State Management
status: active
---

# State Management

## Single Source of Truth

All document state lives in a Yjs Y.Doc, accessed through the DocumentAdapter interface. There is no secondary state store.

## State Partitioning

### By Lifetime

| Lifetime | Where | Examples |
|----------|-------|----------|
| App (global) | Context / localStorage | Theme, AI API key |
| Document | Yjs Y.Doc via adapter | Nodes, edges, schemas, deployables, levels |
| Component | useState | Modal open/close, hover, rename mode |
| URL | URL params | `?doc={id}` in server mode |

### Document State (Yjs)

- **Nodes**: Construct instances with field values, positions, connections
- **Edges**: Visual representations of connections (derived from node data)
- **Schemas**: Construct type definitions (shared across levels)
- **Port Schemas**: Port type definitions (shared across levels)
- **Schema Groups**: Schema organization metadata
- **Deployables**: Logical groupings (per-level)
- **Levels**: Separate architectural views, each with own nodes/edges/deployables

### Persistence

- **Static mode**: IndexedDB via y-indexeddb. Single document, no server.
- **Server mode**: WebSocket sync to server (no IndexedDB — server is source of truth).

### Undo/Redo

Y.UndoManager wraps the Yjs document. Undo history is per-level and per-user (local, not shared in collaboration). The manager is recreated when switching levels.

## Adapter Interface

All state operations go through DocumentAdapter methods. Components access state via `useDocument()` hook. The adapter abstracts away Yjs internals — consumers don't interact with Y.Doc directly.
