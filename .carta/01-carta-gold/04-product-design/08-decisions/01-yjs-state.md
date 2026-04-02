---
title: Use Yjs as single state store
status: active
summary: ADR: Yjs as single state store
tags: [adr, yjs, state]
deps: [doc01.05.02]
---

# Decision 001: Use Yjs as Single State Store

## Context

Carta needs persistent state management with the option for real-time collaboration. Options included Redux + REST API, Zustand + WebSocket, and Yjs CRDT.

## Decision

Use Yjs Y.Doc as the sole state store with y-indexeddb for local persistence and optional y-websocket for collaboration.

## Consequences

- Single source of truth — no sync bugs between stores
- Collaboration is "free" once Yjs is in place
- Undo/redo via Y.UndoManager (local per-user)
- CRDT merge semantics handle conflicts automatically
- More complex than plain useState/Redux for simple operations
- All state access goes through DocumentAdapter abstraction
