---
title: Testing
status: active
---

# Testing

All tests must pass before committing changes.

## Test Suites

```bash
pnpm test          # Integration tests (Vitest)
pnpm test:e2e      # E2E tests (Playwright)
```

## What to Test

When modifying constructs or connections, verify:
- Create construct with custom ports in Schema Editor
- Port polarity validation works correctly
- Handles appear at correct positions (inline or collapsed mode)
- Connections store on source construct's connections array
- Parallel edges bundle visually with count badge
- Compilation output includes ports and relationships
- Import/export preserves port configurations and instance colors
- Undo/redo works for all graph operations
- Copy/paste preserves node data with new IDs
- IndexedDB persists state across page reloads

## E2E Test Coverage

E2E tests use Playwright and run on port 5273 (separate from dev server on 5173).

| Test File | Feature | Tests |
|-----------|---------|-------|
| `new-user-experience.spec.ts` | NUX (doc03.01.03.05) | First visit lands on canvas, starter nodes/edges present, nodes interactive, URL has ?doc= param, returning visit reopens last doc |
| `port-connections.spec.ts` | Ports (doc03.01.01.03) | Port drawer expand/collapse, draggable handles, connection creation, starter content edges |
| `organizers.spec.ts` | Organizers (doc02.09, doc03.01.01.01) | Create organizer via Ctrl+G, organizer name display, member count badge, collapse toggle, dragging, layout strategies |
| `organizer-nesting.spec.ts` | Organizer nesting (doc02.09) | Nested organizer hierarchy, collapse propagation, edge remapping |
| `document-browser.spec.ts` | Storage navigation (doc03.01.03.01) | Folder navigation, breadcrumb display, document creation, virtual folder structure |
| `drag-performance.spec.ts` | Canvas performance (doc03.01.01.01) | Drag operations on large graphs (150 nodes), performance benchmarking |

Test helpers live in `tests/e2e/helpers/CartaPage.ts` — a Page Object Model with `goto()` and `gotoFresh()` (both handle local mode canvas and server mode modal), plus port-related helpers like `getNode()`, `hoverNodeBottom()`, and `dragToConnect()`.

## Integration Test Coverage

### Web Client Tests
| Test File | Feature | Tests |
|-----------|---------|-------|
| `adapter-lifecycle.test.tsx` | Adapter lifecycle (doc02.02) | StrictMode double-mount handling, disposal during async init, timeout cancellation, operations on disposed adapters, subscription cleanup, rapid documentId changes |
| `port-validation.test.tsx` | Port polarity (doc03.01.01.03) | Polarity blocking (source-source, sink-sink), relay/intercept bypass, bidirectional compatibility, compatibleWith matching |
| `pages.test.tsx` | Multi-page documents (doc03.01.01.04) | Page CRUD, isolation, copy/duplicate nodes |
| `organizer.test.tsx` | Organizers (doc02.09, doc03.01.01.01) | Organizer CRUD via adapter, node-organizer association, page isolation, collapse state, nesting |
| `organizer-operations.test.tsx` | Organizer operations (doc02.09) | Attach/detach, layout strategies, business rules enforcement |
| `organizer-geometry.test.tsx` | Organizer geometry (doc02.09) | Bounds computation, overlap detection, containment checks |
| `presentation-model.test.ts` | Presentation model (doc02.09) | Visibility, positioning, edge remapping for organizers |
| `seed-loader.test.ts` | Built-in schemas (doc02.06) | Seed loading, schema validation |
| `folder-navigation.test.tsx` | Storage navigation (doc03.01.03.01) | Virtual folder derivation from forward-slash document names, breadcrumb paths, folder nesting |
| `context-menu-*.test.tsx` | Context menus | Right-click, add related constructs |
| `clear-*.test.tsx` | Document clearing | Clear instances, clear all, preserve title |

### Server Tests
| Test File | Feature | Tests |
|-----------|---------|-------|
| `document-server-core.test.ts` | Document server (doc02.05) | Document CRUD operations, page management, construct operations, connection management, organizer operations |
| `document-server-smoke.test.ts` | Server startup (doc02.05) | Basic server lifecycle, port binding, health checks |

Test providers (`testProviders.tsx`) use `skipPersistence` and `skipStarterContent` props to ensure clean test isolation.

See the full testing checklist in CLAUDE.md for static mode and server mode specifics.
