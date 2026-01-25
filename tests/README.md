# Carta Test Suite

## Overview

This directory contains the test infrastructure for Carta. Tests are organized by type:

```
tests/
+-- setup/                    # Test configuration and helpers
|   +-- vitest.setup.ts       # Global test setup
|   +-- testProviders.tsx     # React context wrappers for tests
|   +-- testAdapter.ts        # In-memory Yjs adapter for testing
+-- unit/                     # Pure function tests (no React)
+-- integration/              # Hook + component tests
|   +-- hooks/                # useDocument, useGraphOperations, etc.
|   +-- components/           # Component integration tests
+-- e2e/                      # Playwright end-to-end tests (future)
|   +-- helpers/
|   +-- specs/
```

## Running Tests

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run specific file
npm test -- tests/integration/hooks/useDocument.test.ts
```

## Test Philosophy

### Integration over Unit

For a state-heavy app like Carta, integration tests provide more value:
- Test hooks with real Yjs adapter (in-memory, no IndexedDB)
- Test components with full provider tree
- Verify state flows correctly between layers

### Declarative Test Data

Tests use semantic descriptions, not implementation details:

```typescript
// Good: Describes intent
const node = createTestNode({ type: 'Task', title: 'My Task' });

// Bad: Exposes implementation
const node = { id: '1', type: 'construct', data: { constructType: 'Task', ... } };
```

### AI-Friendly Structure

Tests are structured for future AI generation:
- Clear scenario names describe what's being tested
- Fixtures are composable and reusable
- Assertions verify observable outcomes

## Adding Tests

1. **For hooks**: Add to `tests/integration/hooks/`
2. **For components**: Add to `tests/integration/components/`
3. **For pure functions**: Add to `tests/unit/`

Use existing tests as templates. See `tests/integration/clear-document.test.tsx` for a complete example.
