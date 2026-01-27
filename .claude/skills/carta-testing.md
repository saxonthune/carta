---
name: carta-testing
description: Testing best practices for Carta - integration tests, E2E patterns, and AI-friendly test design
---

# Carta Testing Guide

This skill provides context for writing integration and E2E tests for Carta.

## Test Philosophy

### Integration Over Unit

For a state-heavy app like Carta, integration tests provide more value than unit tests:
- Test hooks with real Yjs adapter (in-memory, no IndexedDB)
- Test components with full provider tree
- Verify state flows correctly between layers

### AI-Friendly Test Structure

Tests should be structured for future AI generation:
- Clear scenario names describe what's being tested
- Fixtures are composable and reusable
- Assertions verify observable outcomes, not implementation details

## Test Structure

```
tests/
├── setup/
│   ├── vitest.setup.ts       # Global setup (mocks, globals)
│   ├── testProviders.tsx     # React context wrappers
│   └── testHelpers.ts        # Utilities for creating test data
├── integration/              # Hook + component tests
│   ├── hooks/                # useDocument, useGraphOperations, etc.
│   └── components/           # Component integration tests
└── e2e/                      # Playwright tests (future)
    ├── helpers/carta.ts      # Page Object Model
    └── specs/                # Test specifications
```

## Integration Test Patterns

### Test Provider Setup

Always use `TestProviders` from `tests/setup/testProviders.tsx`:

```tsx
import { TestProviders } from '../setup/testProviders';

const { result } = renderHook(
  () => useDocument(),
  { wrapper: TestProviders }
);
```

The `TestProviders` wrapper:
- Uses `skipPersistence={true}` to avoid IndexedDB in jsdom
- Uses `staticMode={true}` to skip WebSocket connections
- Wraps with `ReactFlowProvider` for canvas-related hooks

### Testing Hooks with the Adapter

Access the adapter directly for setup and assertions:

```tsx
const { result } = renderHook(
  () => ({
    document: useDocument(),
    context: useDocumentContext(),
  }),
  { wrapper: TestProviders }
);

// Wait for adapter initialization
await waitFor(() => {
  expect(result.current.context.isReady).toBe(true);
});

const { adapter } = result.current.context;

// Set up state directly on adapter
act(() => {
  adapter.setNodes([createTestNode({ id: '1', type: 'Task' })]);
  adapter.setTitle('Test Document');
});

// Assert through hook's reactive state
expect(result.current.document.nodes).toHaveLength(1);
```

### Test Helpers

Use helpers from `tests/setup/testHelpers.ts`:

```tsx
import { createTestNode, createTestEdge, createSampleDocument } from '../setup/testHelpers';

// Create individual nodes
const node = createTestNode({
  id: '1',
  type: 'Task',
  semanticId: 'my-task',
  values: { name: 'Test' },
});

// Create connected nodes
const { nodes, edges } = createSampleDocument();
```

### Transaction Testing

When testing operations that should be atomic:

```tsx
act(() => {
  adapter.transaction(() => {
    adapter.setNodes([]);
    adapter.setEdges([]);
    adapter.setSchemas([]);
  });
});
```

## E2E Test Patterns (Playwright)

### Page Object Model

Create a `CartaPage` class for E2E tests:

```typescript
// e2e/helpers/carta.ts
export class CartaPage {
  readonly canvas: Locator;

  constructor(private page: Page) {
    this.canvas = page.locator('[data-testid="canvas"]');
  }

  async createConstruct(type: string, position: { x: number; y: number }) {
    await this.canvas.click({ button: 'right', position });
    await this.page.getByRole('menuitem', { name: type }).click();
  }

  async getNodeCount(): Promise<number> {
    return this.page.locator('[data-testid^="node-"]').count();
  }

  async waitForCanvasReady() {
    await this.page.waitForSelector('[data-testid="canvas"][data-loading="false"]');
  }
}
```

### Semantic Actions

Define a vocabulary of actions:

```typescript
type TestAction =
  | { action: 'create-construct'; type: string; position?: Position }
  | { action: 'select-node'; nodeId: string }
  | { action: 'connect-nodes'; source: string; target: string }
  | { action: 'keyboard'; shortcut: string }
  | { action: 'undo' }
  | { action: 'open-panel'; panel: string };
```

### Data Attributes for Testing

Components should expose stable data attributes:

```tsx
// In components
<div
  data-testid="canvas"
  data-node-count={nodes.length}
  data-loading={isLoading}
>

<div
  data-testid={`node-${node.id}`}
  data-node-type={data.constructType}
  data-selected={isSelected}
>
```

## What to Test

### Integration Tests (Vitest + React Testing Library)

| Area | What to Test |
|------|--------------|
| Hooks + Adapter | `useDocument` syncs with Yjs correctly |
| Hook + Hook | `useGraphOperations` + `useUndoRedo` create undoable operations |
| Component + Hooks | `SchemaEditor` calls adapter methods correctly |
| Clear operations | Nodes/edges cleared, title preserved |
| Connection logic | Port validation, edge creation, connection storage |

### E2E Tests (Playwright)

| Area | What to Test |
|------|--------------|
| Context menus | Right-click → create construct works |
| Connections | Drag from handle to handle creates edge |
| Keyboard shortcuts | Ctrl+Z undoes, Ctrl+C/V copies/pastes |
| Import/Export | Load file, modify, save preserves data |
| Multi-select | Shift+click, delete multiple nodes |

## Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:ui       # Visual UI
npm run test:coverage # With coverage
```

## Key Files

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Test configuration |
| `tests/setup/vitest.setup.ts` | Global mocks and setup |
| `tests/setup/testProviders.tsx` | Context wrappers |
| `tests/setup/testHelpers.ts` | Test data factories |

## Model-Driven Testing Vision

See `temp-documentation/ai-powered-testing.md` for the vision of:
- Modeling test scenarios as Carta constructs
- Compiling models to Playwright tests
- AI-powered gap analysis and test generation
- Example: `examples/test-scenarios.carta`
