# Test Builder Command

Create integration tests or E2E tests for Carta features.

## Usage

Invoke with a description of what to test:

```
launch test-builder
```

Or provide specific instructions:

```
"launch test-builder for the connection validation feature"
```

## What This Agent Does

1. Reads the test infrastructure (`tests/README.md`, existing tests)
2. Identifies the feature/code to test
3. Creates appropriate tests:
   - **Integration tests** for hooks, state management, adapter behavior
   - **E2E tests** for user workflows, UI interactions
4. Extends `CartaPage` helper if needed for E2E
5. Notes any missing `data-testid` attributes

## Scope

**Creates:**
- Integration tests (Vitest + React Testing Library)
- E2E tests (Playwright)

**Does NOT create:**
- Unit tests for pure functions
- Snapshot tests
- Performance tests

## Test Locations

```
tests/
├── integration/     # Hook and component tests
│   └── {feature}.test.tsx
└── e2e/
    ├── helpers/
    │   └── CartaPage.ts  # Page Object Model
    └── {feature}.spec.ts
```

## Running Created Tests

```bash
# Integration tests
npm test -- tests/integration/{feature}.test.tsx

# E2E tests
npx playwright test tests/e2e/{feature}.spec.ts
```

## Reference

See `.claude/agents/test-builder.md` for full patterns and templates.
