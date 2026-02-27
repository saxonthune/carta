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
| Document | Yjs Y.Doc via adapter | Nodes, edges, schemas, pages |
| Component | useState | Modal open/close, hover, rename mode |
| URL | URL params | `?doc={id}` in server mode |

### Document State (Yjs)

- **Nodes**: Construct instances with field values, positions, connections
- **Edges**: Visual representations of connections (derived from node data)
- **Schemas**: Construct type definitions (shared across pages)
- **Port Schemas**: Port type definitions (shared across pages)
- **Schema Groups**: Schema organization metadata
- **Organizers**: Visual grouping containers with layout strategies (per-page). See doc02.09
- **Pages**: Separate architectural views, each with own nodes/edges
- **Spec Groups**: Document-level organizational groups containing ordered list of pages (doc02.06)

### Persistence

- **Static mode**: IndexedDB via y-indexeddb. Single document, no server. Document registry maintained in separate IndexedDB database (`packages/web-client/src/stores/documentRegistry.ts`).
- **Server mode**: WebSocket sync to server (no IndexedDB — server is source of truth).

### Undo/Redo

Y.UndoManager wraps the Yjs document. Undo history is per-page and per-user (local, not shared in collaboration). The manager is recreated when switching pages.

## Adapter Interface

All state operations go through DocumentAdapter methods. Components access state via hooks. The adapter abstracts away Yjs internals — consumers don't interact with Y.Doc directly.

### Focused Hooks Pattern

The codebase provides **focused hooks** that subscribe to specific slices of document state. This pattern prevents unnecessary re-renders by ensuring components only react to changes in the state they actually use.

**Focused hooks**:
- `useNodes()` — nodes, setNodes, updateNode, getNextNodeId
- `useEdges()` — edges, setEdges
- `useSchemas()` — schemas, schemaById, getSchema, add/update/remove
- `usePortSchemas()` — portSchemas, getPortSchema, add/update/remove
- `useSchemaGroups()` — schemaGroups, getSchemaGroup, add/update/remove
- `usePages()` — pages, activePage, setActivePage, create/delete/update (renamed from useLevels)
- `useDocumentMeta()` — title, description, setTitle, setDescription
- `useSpecGroups()` — specGroups, create/update/delete/assign/remove
- `useOrganizerOperations()` — organizer operations (create, attach, detach, toggle collapse, rename, resize, delete, change layout)
- `useLayoutActions()` — layout operations (organizer-scoped: spread/flow/grid/fit, attach/detach nodes; top-level: spread/compact/hierarchical)
- `usePresentation()` — transforms domain state into view state (node visibility, positioning, edge remapping) via the presentation model (doc02.09)
- `useNarrative()` — narrator announcements for screen readers and visual feedback
- `useSchemaUndoRedo()` — undo/redo for metamap schema operations

**Implementation detail**: Each focused hook uses `adapter.subscribeToX()` (if available) to subscribe only to changes in that state slice. If the adapter doesn't provide a focused subscription method, it falls back to the global `adapter.subscribe()` and filters in the hook.

## Adapter Lifecycle

### Initialization

The adapter initializes asynchronously, setting up Y.Doc, IndexedDB persistence (in local mode), or WebSocket connection (in server mode). The DocumentProvider gates child rendering until the adapter is ready — children only render once the adapter and Y.Doc are fully initialized. Internal helpers (e.g. `getActivePageNodes()`) return `null` rather than sentinel objects when state doesn't exist yet, and callers handle the absence explicitly. See "Make Invalid States Unrepresentable" in doc01.02.

### Disposal and Cleanup

Proper cleanup prevents memory leaks and race conditions, especially in React StrictMode (which mounts → unmounts → remounts components in development).

**Disposal flags:**
- `isDisposed` flag tracked internally to abort in-flight initialization
- Checked after async operations (IndexedDB sync, database deletion) to bail out if component unmounted

**Timeout cancellation:**
- IndexedDB sync uses a timeout to detect corrupt databases (when 'synced' event never fires)
- `activeSyncTimeout` tracked and cleared on disposal to prevent timeouts firing after cleanup

**Y.Doc destruction:**
- Adapter calls `ydoc.destroy()` on disposal to unsubscribe all internal listeners
- Critical for y-indexeddb cleanup, as it doesn't unsubscribe listeners on its own `destroy()` method
- Prevents "closed database" errors from stale ResizeObserver or timer callbacks

**React StrictMode handling:**
- Development mode causes mount → unmount → mount cycle
- Disposal checks at async checkpoints prevent operations on destroyed Y.Doc instances
- Tests verify no "closed database" errors during double-mount lifecycle

**Subscription cleanup:**
- Adapter maintains `listeners` Set for external subscribers
- `dispose()` clears listener set to prevent stale callback invocations
- External `unsubscribe()` functions safe to call even after disposal

See `packages/web-client/tests/integration/adapter-lifecycle.test.tsx` for comprehensive lifecycle tests.

### Workspace Canvas Mode

In workspace mode, each `.canvas.json` file maps to its own Y.Doc room on the
server. The client creates a `DocumentAdapter` per canvas with `workspaceCanvas`
mode enabled by passing `workspaceCanvas: WorkspaceCanvasSchemas` to `createYjsAdapter`.

- **Schemas**: Injected from `GET /api/workspace/schemas`, not stored in Y.Doc.
  All schema accessor methods (`getSchemas`, `getPortSchemas`, etc.) read from the
  injected payload. All schema mutation methods are no-ops (log a warning).
- **Pages**: Single synthetic page (`WORKSPACE_CANVAS_PAGE_ID = 'canvas'`). Page
  management methods (`createPage`, `deletePage`, `setActivePage`) are no-ops.
- **Persistence**: Server-side only (no IndexedDB). The server maintains a binary
  `.ystate` sidecar for fast reconnect.
- **Migrations**: Skipped entirely — workspace canvas Y.Docs are always fresh.
- **Switching canvases**: `DocumentProvider` uses `key={selectedCanvas}` so React
  unmounts and remounts the provider when the user selects a different canvas.
  The old adapter is disposed via the useEffect cleanup, closing the WebSocket.
- **Node/edge CRUD**: Works normally — nodes and edges are stored in the Y.Doc
  and synced to the server via the WebSocket connection.
