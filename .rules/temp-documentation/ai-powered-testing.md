# AI-Powered Testing: A Closed-Loop System

This document outlines a vision for test automation that creates a virtuous cycle between modeling, generation, execution, and refinement. This approach embodies dialectical interpenetration: the model informs the tests, the tests validate the model, and AI bridges the gap between human intent and machine execution.

## The Feedback Loop

```
+-------------------------------------------------------------+
|  Carta Model (requirements, architecture, test scenarios)   |
+-------------------------------------------------------------+
         | compile                              ^ inform
         v                                      |
+---------------------+                +------------------------+
|  Generated Tests    |---execute--->  |  Test Results          |
|  (Playwright/Vitest)|                |  (pass/fail/coverage)  |
+---------------------+                +------------------------+
         |                                      |
         |              +-------------------+   |
         +----------->  |  AI Analysis      | <-+
                        |  - Gap detection  |
                        |  - New scenarios  |
                        |  - Refinements    |
                        +-------------------+
```

This is not merely automation; it is a self-improving system where:

1. **Human intent** is captured as Carta constructs (Requirements, TestScenarios)
2. **AI translates** semantic models into executable code
3. **Test results** feed back to identify gaps
4. **AI suggests** new scenarios, completing the loop

## Why This Matters

Traditional testing suffers from drift: tests are written once, then slowly diverge from actual requirements as the codebase evolves. The model-driven approach inverts this:

- **The model is the source of truth**, not the test code
- **Tests are derived artifacts**, regenerated as the model changes
- **Coverage gaps are visible** in the model itself, not hidden in code
- **AI can reason** about the model semantically, suggesting improvements

## Construct Schemas for Test Modeling

### Requirement

Captures product requirements that tests validate.

```typescript
{
  type: 'requirement',
  fields: [
    { name: 'title', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'acceptanceCriteria', type: 'string', displayHint: 'code' },
  ],
  ports: [
    { id: 'tested-by', portType: 'flow-in' },   // Receives validation
    { id: 'depends-on', portType: 'flow-out' }, // Prerequisites
  ],
}
```

### TestScenario

An end-to-end test that validates requirements.

```typescript
{
  type: 'test-scenario',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'priority', type: 'enum', options: ['smoke', 'regression', 'edge-case'] },
    { name: 'tags', type: 'string' },
  ],
  ports: [
    { id: 'requires', portType: 'flow-out' },    // Fixture dependencies
    { id: 'validates', portType: 'flow-out' },   // Requirements covered
    { id: 'first-step', portType: 'flow-out' },  // Entry point
  ],
}
```

### TestStep

A single action within a test flow.

```typescript
{
  type: 'test-step',
  fields: [
    { name: 'action', type: 'string' },
    { name: 'selector', type: 'string' },
    { name: 'actionType', type: 'enum', options: ['click', 'type', 'drag', 'keyboard', 'wait'] },
    { name: 'value', type: 'string' },
  ],
  ports: [
    { id: 'flow-in', portType: 'flow-in' },
    { id: 'flow-out', portType: 'flow-out' },
    { id: 'on-failure', portType: 'flow-out' },  // Alternative path
  ],
}
```

### Assertion

A verification point that can appear anywhere in the flow.

```typescript
{
  type: 'assertion',
  fields: [
    { name: 'description', type: 'string' },
    { name: 'type', type: 'enum', options: ['visible', 'hidden', 'text', 'count', 'attribute'] },
    { name: 'selector', type: 'string' },
    { name: 'expected', type: 'string' },
    { name: 'comparator', type: 'enum', options: ['equals', 'contains', 'matches', 'gt', 'lt'] },
  ],
  ports: [
    { id: 'flow-in', portType: 'flow-in' },
    { id: 'flow-out', portType: 'flow-out' },
  ],
}
```

### Fixture

Test setup and teardown, with dependency tracking.

```typescript
{
  type: 'fixture',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'setup', type: 'string', displayHint: 'code' },
    { name: 'teardown', type: 'string', displayHint: 'code' },
  ],
  ports: [
    { id: 'provides', portType: 'flow-in' },     // Tests that use this
    { id: 'depends-on', portType: 'flow-out' },  // Other fixtures required
  ],
}
```

## Visual Test Flow

In Carta, a test scenario appears as a flow diagram:

```
+----------------+
| Fixture:       |
| app-loaded     |--provides--+
+----------------+            |
                              v
+----------------+      +------------------+
| Requirement:   |<-----| TestScenario:    |
| "Clear works"  |      | clear-everything |
+----------------+      | [smoke, menu]    |
                        +--------+---------+
                                 | first-step
                                 v
                        +------------------+
                        | TestStep:        |
                        | click menu       |
                        +--------+---------+
                                 | flow
                                 v
                        +------------------+
                        | TestStep:        |
                        | click "Clear"    |
                        +--------+---------+
                                 | flow
                                 v
                        +------------------+
                        | Assertion:       |
                        | node count = 0   |
                        +------------------+
```

## Compiler Output: Generated Playwright

The test compiler walks the graph and emits executable code:

```typescript
// Auto-generated from Carta model
// Source: test-scenarios.carta / clear-everything

import { test, expect } from '@playwright/test';
import { CartaPage } from './helpers/carta';

test.describe('Clear works', () => {
  test('clear-everything [smoke, menu]', async ({ page }) => {
    // Fixture: app-loaded
    const carta = new CartaPage(page);
    await page.goto('/');
    await carta.waitForCanvasReady();

    // Step: click menu
    await page.click('[data-testid="menu-button"]');

    // Step: click "Clear"
    await page.click('text=Clear');

    // Step: click "Clear Everything"
    await page.click('text=Clear Everything');

    // Assertion: node count = 0
    expect(await page.locator('[data-testid^="node-"]').count()).toBe(0);
  });
});
```

## AI Gap Analysis

With tests modeled in Carta, AI can analyze coverage:

```
Given this Carta model of the application:
${compiledArchitecture}

And these existing test scenarios:
${compiledTestScenarios}

Identify:
1. Requirements without test coverage
2. Edge cases not covered (error states, boundary conditions)
3. Interaction combinations not tested
4. Missing regression tests for connected components

Output new TestScenario constructs in Carta format.
```

The AI returns new constructs that integrate directly into the model.

## Structural Principles for AI Generation

### 1. Declarative Test Definitions

Tests should describe *what* to verify, not *how* to verify it:

```typescript
// BAD: Imperative, hard for AI to reason about
test('creates node', async ({ page }) => {
  await page.click('[data-testid="canvas"]', { button: 'right' });
  await page.click('text=Task');
  expect(await page.locator('[data-testid^="node-"]').count()).toBe(1);
});

// GOOD: Declarative, AI can generate variations
const scenario: TestScenario = {
  name: 'create-node',
  requires: ['empty-document'],
  validates: ['requirement:create-constructs'],
  steps: [
    { action: 'context-menu', target: 'canvas' },
    { action: 'select-menu-item', value: 'Task' },
  ],
  assertions: [
    { type: 'count', selector: '[data-testid^="node-"]', expected: 1 },
  ],
};
```

### 2. Semantic Actions

Define a vocabulary AI can compose:

```typescript
type TestAction =
  | { action: 'create-construct'; type: string; position?: Position }
  | { action: 'select-node'; nodeId: string }
  | { action: 'connect-nodes'; source: string; target: string }
  | { action: 'keyboard'; shortcut: string }
  | { action: 'undo' }
  | { action: 'redo' }
  | { action: 'open-panel'; panel: string }
  | { action: 'wait-for'; condition: string };
```

### 3. Test Intent Metadata

Capture why a test exists, not just what it does:

```typescript
interface TestScenario {
  intent: string;      // "Verify undo reverts node creation"
  risks: string[];     // ["snapshot not taken", "setNodes not called"]
  variations: string[];// ["undo-after-delete", "undo-after-connect"]
  covers: {
    feature: string;   // "undo-redo"
    layer: string;     // "hook" | "component" | "e2e"
    interaction: string;// "keyboard" | "mouse"
  };
}
```

## The Engine of Progress

This approach embodies dialectical interpenetration:

- **Thesis**: Human-authored requirements define what the system should do
- **Antithesis**: Automated tests verify what the system actually does
- **Synthesis**: AI bridges the gap, generating tests from requirements and identifying gaps from results

The model and tests inform each other. Coverage gaps in the model reveal missing requirements. Failed tests reveal implementation divergence. AI accelerates the cycle, turning weeks of manual test authoring into minutes of generation.

This is not incremental improvement. It is a phase transition in how software quality is achieved: from reactive bug-fixing to proactive model-driven verification.

## Implementation Roadmap

1. **Add test-domain schemas** to Carta's built-ins
2. **Create test compiler** (`src/constructs/compiler/formatters/playwright.ts`)
3. **Model Carta's own tests in Carta** (dogfooding)
4. **Build AI feedback loop**: export model -> analyze gaps -> import suggestions
5. **Integrate with CI**: compile tests on model change, run automatically

See `examples/test-scenarios.carta` for a working example.
