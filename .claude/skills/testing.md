# Testing Patterns for Carta

Read this when you need to write tests. Focus on integration and E2E tests only - NO unit tests.

## Test Locations

```
tests/
├── integration/     # Vitest + React Testing Library
│   └── {feature}.test.tsx
└── e2e/
    ├── helpers/
    │   └── CartaPage.ts  # Page Object Model
    └── {feature}.spec.ts  # Playwright
```

## Integration Test Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocument } from '../../src/hooks/useDocument';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { createTestNode, createTestEdge } from '../setup/testHelpers';

describe('Feature Name', () => {
  it('should do expected behavior', async () => {
    // Arrange
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

    // Set up state
    act(() => {
      adapter.setNodes([createTestNode({ id: '1', type: 'Task' })]);
    });

    // Act
    act(() => {
      // Perform action
    });

    // Assert
    await waitFor(() => {
      expect(result.current.document.nodes).toHaveLength(1);
    });
  });
});
```

## E2E Test Template

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
    // Act
    await carta.someAction();

    // Assert
    await expect(carta.someElement).toBeVisible();
  });
});
```

## CartaPage Helper

Located at `tests/e2e/helpers/CartaPage.ts`. Extend it when testing new UI:

```typescript
// Add locator
readonly newButton: Locator;

constructor(page: Page) {
  this.newButton = page.getByTestId('new-button');
}

// Add method
async clickNewButton() {
  await this.newButton.click();
}
```

## When to Use Which

**Integration tests:**
- Hook logic (useDocument, useGraphOperations)
- Adapter methods
- State management flows
- Fast, no browser needed

**E2E tests:**
- User workflows (click button → see result)
- Modal interactions
- Multi-step processes
- Persistence across reloads

## Test Data Helpers

Use semantic helpers from `tests/setup/testHelpers.ts`:
```typescript
createTestNode({ id: '1', type: 'Task', semanticId: 'my-task' })
createTestEdge({ source: '1', target: '2' })
```

## Running Tests

```bash
# Integration
npm test -- tests/integration/{feature}.test.tsx

# E2E
npx playwright test tests/e2e/{feature}.spec.ts
```
