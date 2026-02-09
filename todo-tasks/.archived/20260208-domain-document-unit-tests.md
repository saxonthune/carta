# Domain & Document Unit Tests

## Motivation

`@carta/domain` and `@carta/document` contain pure functions (layout algorithms, string utils, display helpers, doc operations) with zero direct test coverage. These are only tested indirectly through web-client integration tests. Agent-written code like `flowLayout.ts` has cycle breaking, barycenter heuristics, and centroid preservation — silent regressions in graph algorithms are hard to debug. Adding unit tests to these packages catches bugs at the source.

## Design Constraint

Add vitest configs and unit tests to `@carta/domain` and `@carta/document`. Tests cover pure functions only — no React, no providers, no DOM.

## Do NOT

- Do NOT add React testing dependencies to these packages
- Do NOT duplicate coverage that web-client integration tests already handle well — specifically, do NOT add `organizer-geometry` tests (already has 34 test cases in `packages/web-client/tests/integration/organizer-geometry.test.ts`)
- Do NOT add test infrastructure beyond vitest config — no custom setup files needed for pure function tests
- Do NOT modify existing source code — this is purely additive test files
- Do NOT import from barrel exports with `.js` extensions in test files — import directly from source `.ts` files (vitest resolves them natively)

## Files to Modify

1. **NEW** `packages/domain/vitest.config.ts` — vitest config for domain package
2. **NEW** `packages/domain/tests/flowLayout.test.ts` — unit tests for `computeFlowLayout` algorithm
3. **NEW** `packages/domain/tests/identity.test.ts` — unit tests for `generateSemanticId`, `toKebabCase`, `toSnakeCase`
4. **NEW** `packages/domain/tests/display.test.ts` — unit tests for `getDisplayName`, `getFieldsForTier`, `semanticIdToLabel`
5. **NEW** `packages/document/vitest.config.ts` — vitest config for document package
6. **NEW** `packages/document/tests/doc-operations.test.ts` — unit tests for doc operations (page CRUD, flowLayout op)
7. `packages/domain/package.json` — add vitest as devDependency, add test script
8. `packages/document/package.json` — add vitest as devDependency, add test script
9. `package.json` (root) — update `pnpm test` script to include domain and document test runs

## Implementation Steps

### Step 1: Add vitest config to @carta/domain

Create `packages/domain/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
```

Add to `packages/domain/package.json`:
- Add `"test": "vitest run"` to scripts
- Add `"vitest": "^3.0.0"` as devDependency (check root `pnpm-lock.yaml` for the exact version already in the workspace — use that version)

### Step 2: Write flowLayout tests

Create `packages/domain/tests/flowLayout.test.ts`.

Import directly from source:
```ts
import { computeFlowLayout, type FlowLayoutInput, type FlowLayoutEdge, type FlowLayoutOptions } from '../src/utils/flowLayout';
```

The function signature is:
```ts
function computeFlowLayout(
  nodes: FlowLayoutInput[],
  edges: FlowLayoutEdge[],
  options: FlowLayoutOptions
): FlowLayoutResult
```

Where:
```ts
interface FlowLayoutInput {
  id: string;
  semanticId: string;
  x: number; y: number;
  width: number; height: number;
}

interface FlowLayoutEdge {
  sourceId: string; targetId: string;
  sourcePortId: string; targetPortId: string;
}

interface FlowLayoutOptions {
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  sourcePort?: string;   // default: "flow-out"
  sinkPort?: string;     // default: "flow-in"
  layerGap?: number;     // default: 250
  nodeGap?: number;      // default: 150
}

interface FlowLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  layers: Map<string, number>;
  layerOrder: Map<string, number>;
}
```

Helper to create test nodes:
```ts
function node(id: string, x = 0, y = 0): FlowLayoutInput {
  return { id, semanticId: `test-${id}`, x, y, width: 200, height: 100 };
}

function edge(sourceId: string, targetId: string): FlowLayoutEdge {
  return { sourceId, targetId, sourcePortId: 'flow-out', targetPortId: 'flow-in' };
}

const defaultOptions: FlowLayoutOptions = { direction: 'TB' };
```

Test cases:

**`describe('computeFlowLayout')` > `describe('basic layout')`:**
- `it('should return empty result for empty input')` — `computeFlowLayout([], [], defaultOptions)` returns positions.size === 0
- `it('should handle single node')` — one node, no edges → position exists for that node
- `it('should layout linear chain in layers')` — A→B→C with direction TB: A.y < B.y < C.y (each in a different layer)
- `it('should place converging sources in same layer')` — A→C, B→C: A and B in layer 0, C in layer 1

**`describe('computeFlowLayout')` > `describe('cycle handling')`:**
- `it('should handle cycles without hanging')` — A→B→C→A: returns positions for all 3 nodes (algorithm breaks cycles)
- `it('should handle self-loops')` — A→A: returns position for A

**`describe('computeFlowLayout')` > `describe('centroid preservation')`:**
- `it('should preserve centroid of input positions')` — nodes centered at (500, 500): result centroid should be near (500, 500), not at origin. Tolerance: ±50px.

**`describe('computeFlowLayout')` > `describe('direction')`:**
- `it('should layout LR with x-axis layers')` — A→B with direction LR: A.x < B.x (horizontal layout)

### Step 3: Write identity tests

Create `packages/domain/tests/identity.test.ts`.

Import from `../src/utils/identity`:
```ts
import { generateSemanticId, generateDocumentId, toKebabCase, toSnakeCase } from '../src/utils/identity';
```

Test cases:

**`describe('toKebabCase')`:**
- `it('should convert camelCase')` — `'myServiceName'` → `'my-service-name'`
- `it('should handle already-kebab')` — `'my-name'` → `'my-name'`
- `it('should handle PascalCase')` — `'MyService'` → `'my-service'`
- `it('should handle spaces')` — `'My Service'` → `'my-service'`

**`describe('toSnakeCase')`:**
- `it('should convert camelCase')` — `'myServiceName'` → `'my_service_name'`

**`describe('generateSemanticId')`:**
- `it('should include construct type in kebab form')` — `generateSemanticId('apiEndpoint')` should contain `'api-endpoint'`
- `it('should generate unique IDs')` — two calls return different strings

**`describe('generateDocumentId')`:**
- `it('should return a non-empty string')` — basic sanity check

### Step 4: Write display tests

Create `packages/domain/tests/display.test.ts`.

Import from `../src/utils/display`:
```ts
import { getDisplayName, getFieldsForTier, getFieldsForSummary, semanticIdToLabel } from '../src/utils/display';
```

Read `packages/domain/src/utils/display.ts` to understand what types `getDisplayName` expects (likely `ConstructNodeData` and `ConstructSchema`). Build minimal mocks matching the actual interfaces.

Test cases:

**`describe('semanticIdToLabel')`:**
- `it('should convert kebab-case to title case')` — `'api-endpoint-001'` → something human-readable
- `it('should handle simple IDs')` — `'service-1'` → readable label

**`describe('getFieldsForTier')`:**
- `it('should filter fields by display tier')` — create a mock schema with fields at different tiers, verify only matching tier fields are returned

**`describe('getDisplayName')`:**
- `it('should use displayField value when available')` — mock node data with a field matching the schema's displayField
- `it('should fall back to semanticId')` — mock node data without displayField value

### Step 5: Add vitest config to @carta/document

Create `packages/document/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@carta/domain': path.resolve(__dirname, '../domain/src/index.ts'),
      '@carta/compiler': path.resolve(__dirname, '../compiler/src/index.ts'),
    },
  },
});
```

**Note:** `@carta/document` depends on `@carta/domain` and `@carta/compiler`. The aliases must match the dependency graph. Check `packages/document/package.json` dependencies and `packages/web-client/vitest.config.ts` for the alias pattern.

Add to `packages/document/package.json`:
- Add `"test": "vitest run"` to scripts
- Add `"vitest": "^3.0.0"` as devDependency (match workspace version)

### Step 6: Write doc-operations tests

Create `packages/document/tests/doc-operations.test.ts`.

These tests need a real Y.Doc (from `yjs`, already a dependency). Read `packages/document/src/doc-operations.ts` to understand the Y.Doc structure — specifically how pages, nodes, and edges are stored in Y.Maps/Y.Arrays.

The pattern:
```ts
import * as Y from 'yjs';
// Import the functions to test from doc-operations
```

Read the source to find how to set up a valid Y.Doc structure. Look for functions like `createPage`, `listPages` — start by testing those since they're simpler and establish the doc structure pattern for more complex tests.

Test cases (minimal — prove the pattern works):

**`describe('page operations')`:**
- `it('should create a page and list it')` — `createPage(doc, 'Test')` then `listPages(doc)` returns it
- `it('should delete a page')` — create two pages, delete one, verify only one remains
- `it('should update page name')` — create page, update name, verify via listPages

**`describe('flowLayout operation')`:**
- `it('should apply layout to page with nodes')` — create a page with nodes and edges in the Y.Doc, run `flowLayout`, verify node positions changed
- `it('should handle empty page')` — run flowLayout on page with no nodes, verify no errors

### Step 7: Update root pnpm test script

Read root `package.json`. The current test script is:
```json
"test": "pnpm --filter @carta/document typecheck && pnpm --filter @carta/web-client test && pnpm --filter @carta/server test"
```

Update to:
```json
"test": "pnpm --filter @carta/document typecheck && pnpm --filter @carta/domain test && pnpm --filter @carta/document test && pnpm --filter @carta/web-client test && pnpm --filter @carta/server test"
```

### Step 8: Verify

```bash
pnpm build && pnpm test
```

All existing tests plus new domain/document tests should pass. Also verify standalone:
```bash
cd packages/domain && pnpm test
cd packages/document && pnpm test
```

## Constraints

- `erasableSyntaxOnly` — no constructor parameter shorthand
- Barrel exports use `.js` extensions in source code, but test files import directly from `.ts` source
- No React dependencies in these packages
- Tests must be deterministic — no timing-dependent assertions
- vitest config follows the pattern from `packages/server/vitest.config.ts` (node environment, globals: true)

## Verification

- `pnpm build` passes
- `pnpm test` passes and includes domain + document test output
- `packages/domain/tests/flowLayout.test.ts` has at least 8 passing tests
- `packages/domain/tests/identity.test.ts` has at least 6 passing tests
- `packages/domain/tests/display.test.ts` has at least 4 passing tests
- `packages/document/tests/doc-operations.test.ts` has at least 4 passing tests
- Running `cd packages/domain && pnpm test` works standalone
- Running `cd packages/document && pnpm test` works standalone

## Plan-Specific Checks

```bash
# Verify no organizer-geometry test file was created in domain package
! ls packages/domain/tests/organizer-geometry* 2>/dev/null | grep .

# Verify no React imports in domain or document tests
! grep -r 'from.*react' packages/domain/tests/ packages/document/tests/ 2>/dev/null | grep .
```
