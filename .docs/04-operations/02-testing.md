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
| `new-user-experience.spec.ts` | NUX (doc03.01.13) | First visit lands on canvas, starter nodes/edges present, nodes interactive, URL has ?doc= param, returning visit reopens last doc |
| `port-connections.spec.ts` | Ports (doc03.01.03) | Port drawer expand/collapse, draggable handles, connection creation, starter content edges |

Test helpers live in `tests/e2e/helpers/CartaPage.ts` — a Page Object Model with `goto()` and `gotoFresh()` (both handle local mode canvas and server mode modal), plus port-related helpers like `getNode()`, `hoverNodeBottom()`, and `dragToConnect()`.

## Integration Test Coverage

| Test File | Feature | Tests |
|-----------|---------|-------|
| `port-validation.test.tsx` | Port polarity (doc03.01.03) | Polarity blocking (source-source, sink-sink), relay/intercept bypass, bidirectional compatibility, compatibleWith matching |
| `node-expansion.test.tsx` | Node view levels | Default view level, view level switching, persistence across updates |
| `levels.test.tsx` | Multi-level documents (doc03.01.04) | Level CRUD, isolation, copy/duplicate nodes |
| `deployable-creation.test.tsx` | Deployables | Creation, assignment, reassignment |
| `context-menu-*.test.tsx` | Context menus | Right-click, add related constructs |
| `clear-*.test.tsx` | Document clearing | Clear instances, clear all, preserve title |
| `restore-*.test.tsx` | Schema restoration | Restore defaults, preserve instances |

Test providers (`testProviders.tsx`) use `skipPersistence` and `skipStarterContent` props to ensure clean test isolation.

See the full testing checklist in CLAUDE.md for static mode and server mode specifics.
