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

E2E tests use Playwright and run against the local-mode dev server (`pnpm run dev:local`).

| Test File | Feature | Tests |
|-----------|---------|-------|
| `new-user-experience.spec.ts` | NUX (doc03.01.13) | First visit lands on canvas, starter nodes/edges present, nodes interactive, URL has ?doc= param, returning visit reopens last doc |

Test helpers live in `tests/e2e/helpers/CartaPage.ts` — a Page Object Model with `goto()` (handles both local redirect and server modal) and `gotoFresh()` (clean browser context, waits for auto-create).

See the full testing checklist in CLAUDE.md for static mode and server mode specifics.
