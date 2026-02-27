---
name: test-builder
description: Creates integration tests (Vitest) and E2E tests (Playwright) for Carta features
---

# test-builder

Creates integration and E2E tests for Carta features. Does NOT write unit tests.

## Reference Documentation

Testing guidance lives in `.carta/` (source of truth):
- **Testing operations** (doc04.02): Test commands, CI configuration
- **Architecture overview** (doc02.01): Layer separation, data flow

Read these before writing tests:
```
tests/README.md
tests/setup/testProviders.tsx
tests/setup/testHelpers.ts
```

## Test Philosophy

### Feature Coverage over Code Coverage

This codebase changes rapidly. Every test should protect a **user-facing behavior**, not a code path. The goal is to catch regressions in what users do, while keeping maintenance cost low when internals change.

### Prioritization (highest to lowest)
1. **User feature tests** — "Can a user create a level and see it in the switcher?" Survives refactors.
2. **Data integrity tests** — "Does clearing everything actually clear all levels?" Protects against data loss.
3. **Boundary/edge case tests** — "What happens when you delete the last level?" Only plausible user paths.
4. **Integration plumbing tests** — Adapter method interactions. Write sparingly.

### What NOT to test
- Internal adapter structure (Y.Map nesting, observer wiring)
- CSS / layout details (use `/style-nag` instead)
- Redundant happy paths
- Getter-only methods that just read a map

## Test Types

### Integration Tests (Vitest + React Testing Library)
- Location: `tests/integration/`
- Test hooks with real Yjs adapter (in-memory, no IndexedDB)
- Test component interactions with full provider tree
- **Preferred for most new feature tests** — fast, stable

### E2E Tests (Playwright)
- Location: `tests/e2e/`
- Test user workflows through actual UI
- Page Object Model via `CartaPage` helper
- **Reserve for UI-specific behaviors** — modals, drag-drop, keyboard shortcuts

## Integration Test Pattern

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocument } from '../../src/hooks/useDocument';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { createTestNode } from '../setup/testHelpers';

describe('Feature Name', () => {
  it('should do expected behavior', async () => {
    const { result } = renderHook(
      () => ({
        document: useDocument(),
        context: useDocumentContext(),
      }),
      { wrapper: TestProviders }
    );

    await waitFor(() => {
      expect(result.current.context.isReady).toBe(true);
    });

    const { adapter } = result.current.context;

    act(() => {
      adapter.setNodes([createTestNode({ id: '1', type: 'Task' })]);
    });

    expect(result.current.document.nodes).toHaveLength(1);
  });
});
```

## E2E Test Pattern

```typescript
import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/CartaPage';

test.describe('Feature Name', () => {
  let carta: CartaPage;

  test.beforeEach(async ({ page }) => {
    carta = new CartaPage(page);
    await carta.goto();
  });

  test('should do expected behavior', async () => {
    await carta.someAction();
    await expect(carta.someElement).toBeVisible();
  });
});
```

## Design Principles

1. **Test user outcomes, not implementation details** — assert through hooks, not Yjs internals
2. **Prefer scenario tests over micro-tests** — one test that creates, switches, and verifies beats three that duplicate setup
3. **Use semantic test data** — `createTestNode({ type: 'Task', semanticId: 'user-task' })` over magic values
4. **Extract setup helpers per file** — when provider shape changes, fix one place
5. **Avoid brittle assertions** — use relative (`toHaveLength(before + 1)`) over absolute counts
6. **Extend CartaPage for E2E** — add locators and methods for new UI elements
7. **Add data-testid attributes** — note any missing ones that should be added

## Choosing Test Type

**Integration when:** Testing hook logic, state flows, adapter behavior, fast feedback needed.

**E2E when:** Testing user workflows, UI interactions (modals, menus, drag-drop), persistence across reloads.

## Running Tests

```bash
npm test                                          # All integration tests
npm test -- tests/integration/{feature}.test.tsx  # Specific feature
npx playwright test tests/e2e/{feature}.spec.ts   # Specific E2E
```

## Output Format

After creating tests, report:
```markdown
## Tests Created

### Integration Tests
- `tests/integration/{feature}.test.tsx`
  - {test description}

### E2E Tests (if any)
- `tests/e2e/{feature}.spec.ts`
  - {test description}

### Missing data-testid (if any)
- `{component}`: needs `data-testid="{id}"`

### Run Tests
npm test -- tests/integration/{feature}.test.tsx
```
