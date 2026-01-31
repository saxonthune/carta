---
title: Testing
status: active
---

# Testing

All tests must pass before committing changes.

## Test Suites

```bash
npm run test          # Integration tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
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

See the full testing checklist in CLAUDE.md for static mode and server mode specifics.
