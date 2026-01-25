# Replay Testing: Event-Sourced Test Paradigm

This document describes an approach to testing where tests are defined as sequences of semantic events that are deterministically replayed against application state. This enables composable test scenarios, automated permutation generation, and fuzzing.

## Inspiration: Game Replays

In games like Starcraft, a replay file contains a list of timestamped events:

```
[frame 0] Player 1: Select unit 5
[frame 12] Player 1: Right-click position (1024, 768)
[frame 45] Player 2: Build Spawning Pool at (512, 512)
```

Despite complex game logic, replays are deterministic because:
1. The engine is a pure function: `(state, event) → new state`
2. Random seeds are captured
3. Events are atomic and timestamped

This same principle applies to UI applications.

## Core Concept

Instead of imperative test code that manipulates the UI directly, tests become **sequences of semantic events**:

```typescript
// Traditional test
test('deletes node', async () => {
  await page.click('[data-testid="canvas"]', { button: 'right', position: { x: 100, y: 100 } });
  await page.click('text=Task');
  await page.click('[data-testid="node-0"]');
  await page.keyboard.press('Delete');
  expect(await page.locator('[data-testid^="node-"]').count()).toBe(0);
});

// Replay test
test('deletes node', () => {
  const events = [
    { type: 'CREATE_CONSTRUCT', constructType: 'Task', position: { x: 100, y: 100 } },
    { type: 'SELECT_NODE', nodeIndex: 0 },
    { type: 'DELETE_SELECTED' },
  ];

  const state = replay(events);
  expect(state.nodes).toHaveLength(0);
});
```

## Event Vocabulary

Define all possible user actions as typed events:

```typescript
type CartaEvent =
  // Node operations
  | { type: 'CREATE_CONSTRUCT'; constructType: string; position: Position }
  | { type: 'SELECT_NODE'; nodeIndex: number }
  | { type: 'SELECT_NODES'; nodeIndices: number[] }
  | { type: 'DELETE_SELECTED' }
  | { type: 'RENAME_NODE'; nodeIndex: number; newName: string }
  | { type: 'EXPAND_NODE'; nodeIndex: number }
  | { type: 'COLLAPSE_NODE'; nodeIndex: number }

  // Connection operations
  | { type: 'CONNECT'; sourceIndex: number; targetIndex: number; ports: [string, string] }
  | { type: 'DISCONNECT'; edgeIndex: number }

  // History operations
  | { type: 'UNDO' }
  | { type: 'REDO' }

  // Clipboard operations
  | { type: 'COPY' }
  | { type: 'PASTE'; offset?: Position }

  // Document operations
  | { type: 'CLEAR'; mode: 'instances' | 'all' }
  | { type: 'SET_TITLE'; title: string }

  // Schema operations
  | { type: 'CREATE_SCHEMA'; schema: ConstructSchema }
  | { type: 'DELETE_SCHEMA'; schemaType: string }

  // Deployable operations
  | { type: 'SET_DEPLOYABLE'; nodeIndex: number; deployableIndex: number | null }

  // UI operations
  | { type: 'OPEN_PANEL'; panel: 'viewer' | 'constructs' | 'deploy' | 'ports' }
  | { type: 'KEYBOARD'; shortcut: string };
```

Note: Events use **indices** rather than IDs to maintain determinism across replays.

## The Replay Engine

A pure function that applies events to state:

```typescript
interface ReplayState {
  nodes: Node[];
  edges: Edge[];
  selectedIndices: number[];
  clipboard: Node[] | null;
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  schemas: ConstructSchema[];
  title: string;
}

function replay(events: CartaEvent[], initialState?: ReplayState): ReplayState {
  let state = initialState ?? createEmptyState();

  for (const event of events) {
    state = applyEvent(state, event);
  }

  return state;
}

function applyEvent(state: ReplayState, event: CartaEvent): ReplayState {
  switch (event.type) {
    case 'CREATE_CONSTRUCT': {
      const newNode = createNode(event.constructType, event.position, state.nodes.length);
      return {
        ...state,
        nodes: [...state.nodes, newNode],
        undoStack: [...state.undoStack, snapshot(state)],
        redoStack: [],
      };
    }

    case 'SELECT_NODE': {
      return {
        ...state,
        selectedIndices: [event.nodeIndex],
      };
    }

    case 'DELETE_SELECTED': {
      const toDelete = new Set(state.selectedIndices);
      const remaining = state.nodes.filter((_, i) => !toDelete.has(i));
      const remainingIds = new Set(remaining.map(n => n.id));

      return {
        ...state,
        nodes: remaining,
        edges: state.edges.filter(e =>
          remainingIds.has(e.source) && remainingIds.has(e.target)
        ),
        selectedIndices: [],
        undoStack: [...state.undoStack, snapshot(state)],
        redoStack: [],
      };
    }

    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        ...restore(prev),
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, snapshot(state)],
      };
    }

    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        ...restore(next),
        undoStack: [...state.undoStack, snapshot(state)],
        redoStack: state.redoStack.slice(0, -1),
      };
    }

    // ... additional event handlers
  }
}
```

## Writing Tests

Tests become declarative event sequences:

```typescript
describe('Undo/Redo', () => {
  it('undoes node creation', () => {
    const events: CartaEvent[] = [
      { type: 'CREATE_CONSTRUCT', constructType: 'Task', position: { x: 100, y: 100 } },
      { type: 'UNDO' },
    ];

    const state = replay(events);
    expect(state.nodes).toHaveLength(0);
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(1);
  });

  it('redo restores undone node', () => {
    const events: CartaEvent[] = [
      { type: 'CREATE_CONSTRUCT', constructType: 'Task', position: { x: 100, y: 100 } },
      { type: 'UNDO' },
      { type: 'REDO' },
    ];

    const state = replay(events);
    expect(state.nodes).toHaveLength(1);
  });

  it('new action clears redo stack', () => {
    const events: CartaEvent[] = [
      { type: 'CREATE_CONSTRUCT', constructType: 'Task', position: { x: 100, y: 100 } },
      { type: 'UNDO' },
      { type: 'CREATE_CONSTRUCT', constructType: 'Service', position: { x: 200, y: 100 } },
    ];

    const state = replay(events);
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].data.constructType).toBe('Service');
    expect(state.redoStack).toHaveLength(0);
  });
});
```

## Permutation Testing

The primary advantage: generating test variations automatically.

### Insert-at-each-position

Test what happens when an action occurs at different points in a flow:

```typescript
function insertAtEachPosition<T>(arr: T[], item: T | T[]): T[][] {
  const items = Array.isArray(item) ? item : [item];
  const result: T[][] = [];

  for (let i = 0; i <= arr.length; i++) {
    result.push([...arr.slice(0, i), ...items, ...arr.slice(i)]);
  }

  return result;
}

// Base scenario
const baseFlow: CartaEvent[] = [
  { type: 'CREATE_CONSTRUCT', constructType: 'Task', position: { x: 0, y: 0 } },
  { type: 'CREATE_CONSTRUCT', constructType: 'Service', position: { x: 200, y: 0 } },
  { type: 'SELECT_NODE', nodeIndex: 0 },
  { type: 'CONNECT', sourceIndex: 0, targetIndex: 1, ports: ['flow-out', 'flow-in'] },
];

// Generate: "what if we undo at each step?"
const undoPermutations = insertAtEachPosition(baseFlow, { type: 'UNDO' });

// Generate: "what if we undo then redo at each step?"
const undoRedoPermutations = insertAtEachPosition(baseFlow, [
  { type: 'UNDO' },
  { type: 'REDO' },
]);
```

### Invariant Checking

Define properties that must always hold, then verify across all permutations:

```typescript
interface Invariant {
  name: string;
  check: (state: ReplayState) => boolean;
}

const invariants: Invariant[] = [
  {
    name: 'No orphaned edges',
    check: (state) => state.edges.every(e =>
      state.nodes.some(n => n.id === e.source) &&
      state.nodes.some(n => n.id === e.target)
    ),
  },
  {
    name: 'Selection indices valid',
    check: (state) => state.selectedIndices.every(i =>
      i >= 0 && i < state.nodes.length
    ),
  },
  {
    name: 'Connections match edges',
    check: (state) => {
      const connectionCount = state.nodes.reduce((sum, n) =>
        sum + (n.data.connections?.length ?? 0), 0);
      return connectionCount === state.edges.length;
    },
  },
  {
    name: 'Undo stack bounded',
    check: (state) => state.undoStack.length <= MAX_UNDO_HISTORY,
  },
];

// Run all permutations against all invariants
describe('Invariants hold across permutations', () => {
  const allPermutations = [
    ...insertAtEachPosition(baseFlow, { type: 'UNDO' }),
    ...insertAtEachPosition(baseFlow, { type: 'DELETE_SELECTED' }),
    ...insertAtEachPosition(baseFlow, [{ type: 'COPY' }, { type: 'PASTE' }]),
  ];

  for (const events of allPermutations) {
    it(`sequence: ${summarize(events)}`, () => {
      const state = replay(events);

      for (const inv of invariants) {
        expect(inv.check(state), inv.name).toBe(true);
      }
    });
  }
});
```

## Fuzzing

Generate random event sequences to discover edge cases:

```typescript
function generateRandomEvents(count: number, seed: number): CartaEvent[] {
  const rng = seedRandom(seed);
  const events: CartaEvent[] = [];
  let nodeCount = 0;

  for (let i = 0; i < count; i++) {
    const event = randomEvent(rng, nodeCount);
    events.push(event);

    // Track state changes that affect valid future events
    if (event.type === 'CREATE_CONSTRUCT') nodeCount++;
    if (event.type === 'DELETE_SELECTED') nodeCount = Math.max(0, nodeCount - 1);
    if (event.type === 'UNDO') nodeCount = Math.max(0, nodeCount - 1);
  }

  return events;
}

function randomEvent(rng: RNG, nodeCount: number): CartaEvent {
  const eventTypes = [
    { type: 'CREATE_CONSTRUCT', weight: 10 },
    { type: 'SELECT_NODE', weight: nodeCount > 0 ? 8 : 0 },
    { type: 'DELETE_SELECTED', weight: nodeCount > 0 ? 5 : 0 },
    { type: 'CONNECT', weight: nodeCount > 1 ? 6 : 0 },
    { type: 'UNDO', weight: 4 },
    { type: 'REDO', weight: 3 },
    { type: 'COPY', weight: nodeCount > 0 ? 3 : 0 },
    { type: 'PASTE', weight: 2 },
  ];

  const selected = weightedRandom(rng, eventTypes);
  return buildEvent(selected.type, rng, nodeCount);
}

// Run fuzz tests
describe('Fuzz testing', () => {
  for (let seed = 0; seed < 1000; seed++) {
    it(`random sequence seed=${seed}`, () => {
      const events = generateRandomEvents(50, seed);
      const state = replay(events);

      for (const inv of invariants) {
        expect(inv.check(state), `${inv.name} (seed ${seed})`).toBe(true);
      }
    });
  }
});
```

## Debugging Failures

When a test fails, minimize the event sequence to find the root cause:

```typescript
function minimizeSequence(
  events: CartaEvent[],
  failsInvariant: (state: ReplayState) => boolean
): CartaEvent[] {
  // Binary search to find minimal failing sequence
  let minimal = events;

  // Try removing events one at a time
  for (let i = minimal.length - 1; i >= 0; i--) {
    const candidate = [...minimal.slice(0, i), ...minimal.slice(i + 1)];
    const state = replay(candidate);

    if (failsInvariant(state)) {
      minimal = candidate;
    }
  }

  return minimal;
}

// Usage when a fuzz test fails
const failingEvents = generateRandomEvents(50, 847);
const state = replay(failingEvents);

if (hasOrphanedEdges(state)) {
  const minimal = minimizeSequence(failingEvents, hasOrphanedEdges);
  console.log('Minimal reproduction:', JSON.stringify(minimal, null, 2));
  // [
  //   { type: 'CREATE_CONSTRUCT', constructType: 'Task', position: { x: 0, y: 0 } },
  //   { type: 'CREATE_CONSTRUCT', constructType: 'Task', position: { x: 100, y: 0 } },
  //   { type: 'CONNECT', sourceIndex: 0, targetIndex: 1, ports: ['flow-out', 'flow-in'] },
  //   { type: 'SELECT_NODE', nodeIndex: 0 },
  //   { type: 'DELETE_SELECTED' },
  // ]
}
```

## Bridging to Real UI

The same events can drive actual UI for E2E testing:

```typescript
async function replayInBrowser(page: Page, events: CartaEvent[]): Promise<void> {
  const carta = new CartaPage(page);
  await page.goto('/');
  await carta.waitForCanvasReady();

  for (const event of events) {
    await executeEventInBrowser(carta, event);
  }
}

async function executeEventInBrowser(carta: CartaPage, event: CartaEvent): Promise<void> {
  switch (event.type) {
    case 'CREATE_CONSTRUCT':
      await carta.createConstruct(event.constructType, event.position);
      break;

    case 'SELECT_NODE':
      await carta.selectNodeByIndex(event.nodeIndex);
      break;

    case 'DELETE_SELECTED':
      await carta.page.keyboard.press('Delete');
      break;

    case 'UNDO':
      await carta.page.keyboard.press('Control+z');
      break;

    case 'REDO':
      await carta.page.keyboard.press('Control+Shift+z');
      break;

    // ... other events
  }
}
```

## Comparison

| Aspect | Traditional Testing | Replay Testing |
|--------|---------------------|----------------|
| Test definition | Imperative UI commands | Declarative event sequences |
| Selector stability | Fragile (tied to DOM) | Stable (semantic events) |
| Generating variations | Manual | Automated permutation |
| Edge case discovery | Manual | Fuzzing |
| Debugging | Read test code, add logs | Replay to exact failure, minimize |
| Coverage metric | Lines executed | State space explored |

## Implementation Structure

```
src/testing/
├── events.ts           # Event type definitions
├── replay.ts           # Pure replay engine
├── invariants.ts       # Invariant definitions
├── permutations.ts     # Permutation generators
├── fuzz.ts             # Random event generation
└── minimize.ts         # Failure minimization

e2e/
└── helpers/
    └── eventExecutor.ts  # Bridge events to Playwright
```

## Limitations

- Events must be designed to be deterministic (no timestamps, random IDs)
- UI-only state (hover, focus) may not be captured
- Some interactions (drag gestures, animations) are harder to model
- Initial implementation requires defining all event types upfront

---

# Part 2: Achieving Determinism

The replay system's value depends on determinism. Critically, the replay engine must test **real code**, not a simulation. Determinism is achieved through environment control, not by building a separate model.

## The Core Principle: Test Real Code

The replay engine executes events through the **actual hooks and adapter**, with determinism achieved by controlling the environment:

```
┌─────────────────────────────────────────────────────────────┐
│  Replay Engine (Test Harness)                               │
│  └── Controls: randomness, time, async timing               │
│  └── Drives: REAL hooks (useGraphOperations, useDocument)   │
│  └── Observes: REAL state (from Yjs adapter)                │
└─────────────────────────────────────────────────────────────┘
```

This is how game replays work — they replay through the real game engine, not a simulation. The same principle applies here.

## Sources of Non-Determinism

| Source | Example | Impact |
|--------|---------|--------|
| Random IDs | `crypto.randomUUID()` | Node IDs differ across runs |
| Timestamps | `Date.now()` in semanticId | IDs like `task-1706123456789` vary |
| Async timing | React render batching | State observed mid-update |
| Floating point | Position calculations | `100.00000001` vs `100` |
| Object key order | `JSON.stringify()` | Snapshot comparison fails |
| External state | localStorage, IndexedDB | Polluted between tests |
| Viewport/mouse | Canvas coordinates | Position depends on window size |
| Concurrent React | Suspense, transitions | Render order varies |

## Principle 1: Environment Control via Mocking

Instead of simulating, mock the non-deterministic parts at the environment level:

```typescript
// tests/replay/env.ts

export function createDeterministicEnv(seed: number = 0) {
  let uuidCounter = 0;
  let virtualTime = 1700000000000; // Fixed start time

  // Mock crypto.randomUUID
  const originalRandomUUID = crypto.randomUUID;
  crypto.randomUUID = () => {
    return `00000000-0000-4000-8000-${String(uuidCounter++).padStart(12, '0')}`;
  };

  // Mock Date.now
  const originalDateNow = Date.now;
  Date.now = () => virtualTime;

  // Mock Math.random with seeded PRNG
  const originalMathRandom = Math.random;
  const rng = seedRandom(seed);
  Math.random = () => rng();

  return {
    advanceTime: (ms: number) => { virtualTime += ms; },
    reset: () => { uuidCounter = 0; virtualTime = 1700000000000; },
    cleanup: () => {
      crypto.randomUUID = originalRandomUUID;
      Date.now = originalDateNow;
      Math.random = originalMathRandom;
    },
  };
}
```

## Principle 2: Event Executor Drives Real Hooks

The event executor calls **actual application code**:

```typescript
// tests/replay/executor.ts

interface ReplayContext {
  document: ReturnType<typeof useDocument>;
  graphOps: ReturnType<typeof useGraphOperations>;
  connections: ReturnType<typeof useConnections>;
  undoRedo: ReturnType<typeof useUndoRedo>;
  setSelectedNodeIds: (ids: string[]) => void;
}

function applyEvent(ctx: ReplayContext, event: CartaEvent): void {
  const { graphOps, connections, document, undoRedo } = ctx;

  switch (event.type) {
    case 'CREATE_CONSTRUCT': {
      const schema = document.getSchema(event.constructType);
      // Calls the REAL useGraphOperations.addConstruct
      graphOps.addConstruct(schema!, event.position.x, event.position.y);
      break;
    }

    case 'SELECT_NODE': {
      const node = document.nodes[event.nodeIndex];
      if (node) {
        ctx.setSelectedNodeIds([node.id]);
      }
      break;
    }

    case 'DELETE_SELECTED': {
      // Calls the REAL useGraphOperations.deleteSelectedNodes
      graphOps.deleteSelectedNodes();
      break;
    }

    case 'CONNECT': {
      const source = document.nodes[event.sourceIndex];
      const target = document.nodes[event.targetIndex];
      // Calls the REAL useConnections.onConnect
      connections.onConnect({
        source: source.id,
        target: target.id,
        sourceHandle: event.ports[0],
        targetHandle: event.ports[1],
      });
      break;
    }

    case 'UNDO': {
      undoRedo.undo();
      break;
    }

    case 'REDO': {
      undoRedo.redo();
      break;
    }

    case 'CLEAR': {
      const { adapter } = document;
      adapter.transaction(() => {
        adapter.setNodes([]);
        adapter.setEdges([]);
        if (event.mode === 'all') {
          adapter.setSchemas([]);
          adapter.setDeployables([]);
        }
      });
      break;
    }
  }
}
```

## Principle 3: The Replay Runner

Combines environment control with event execution:

```typescript
// tests/replay/runner.ts

import { renderHook, act, waitFor } from '@testing-library/react';
import { TestProviders } from '../setup/testProviders';
import { createDeterministicEnv } from './env';
import { applyEvent } from './executor';

export async function replayEvents(events: CartaEvent[], seed: number = 0) {
  const env = createDeterministicEnv(seed);

  try {
    const { result } = renderHook(
      () => {
        const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
        return {
          document: useDocument(),
          graphOps: useGraphOperations({ selectedNodeIds, setSelectedNodeIds, ... }),
          connections: useConnections(),
          undoRedo: useUndoRedo(),
          setSelectedNodeIds,
          selectedNodeIds,
        };
      },
      { wrapper: TestProviders }
    );

    // Wait for initialization
    await waitFor(() => expect(result.current.document.isReady).toBe(true));

    // Execute each event through REAL hooks
    for (const event of events) {
      act(() => {
        applyEvent(result.current, event);
      });
    }

    // Return the REAL state
    return {
      nodes: result.current.document.nodes,
      edges: result.current.document.edges,
      schemas: result.current.document.schemas,
      selectedNodeIds: result.current.selectedNodeIds,
      canUndo: result.current.undoRedo.canUndo,
      canRedo: result.current.undoRedo.canRedo,
    };

  } finally {
    env.cleanup();
  }
}
```

## Principle 4: Tests Use the Runner

Tests become declarative while testing real code:

```typescript
describe('Replay: Undo/Redo', () => {
  it('undoes node creation through real hooks', async () => {
    const events: CartaEvent[] = [
      { type: 'CREATE_CONSTRUCT', constructType: 'Task', position: { x: 100, y: 100 } },
      { type: 'UNDO' },
    ];

    const state = await replayEvents(events);

    // This is REAL state from REAL hooks
    expect(state.nodes).toHaveLength(0);
    expect(state.canRedo).toBe(true);
  });

  it('redo restores undone node', async () => {
    const events: CartaEvent[] = [
      { type: 'CREATE_CONSTRUCT', constructType: 'Task', position: { x: 100, y: 100 } },
      { type: 'UNDO' },
      { type: 'REDO' },
    ];

    const state = await replayEvents(events);

    expect(state.nodes).toHaveLength(1);
    expect(state.canUndo).toBe(true);
  });
});
```

## Principle 5: Self-Healing Determinism Detection

Run every test twice with the same seed. If results differ, something is non-deterministic:

```typescript
export async function replayWithDeterminismCheck(
  events: CartaEvent[],
  seed: number = 0
): Promise<ReplayState> {
  const state1 = await replayEvents(events, seed);
  const state2 = await replayEvents(events, seed);

  if (!statesEqual(state1, state2)) {
    // Binary search to find which event introduced non-determinism
    for (let i = 1; i <= events.length; i++) {
      const prefix = events.slice(0, i);
      const s1 = await replayEvents(prefix, seed);
      const s2 = await replayEvents(prefix, seed);

      if (!statesEqual(s1, s2)) {
        throw new NonDeterministicEventError(
          `Event ${i} (${events[i-1].type}) produces non-deterministic results`,
          events[i-1],
          { state1: s1, state2: s2 }
        );
      }
    }
  }

  return state1;
}
```

When this fails, it identifies exactly which event handler has non-deterministic behavior, pointing to code that needs fixing.

## Principle 6: Canonical State for Comparison

When comparing states, normalize to avoid false negatives:

```typescript
function canonicalize(state: ReplayState): object {
  return {
    nodeCount: state.nodes.length,
    edgeCount: state.edges.length,
    // Sort by deterministic ID for stable comparison
    nodeTypes: [...state.nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(n => n.data.constructType),
    // Round positions
    nodePositions: state.nodes.map(n => ({
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
    })),
    canUndo: state.canUndo,
    canRedo: state.canRedo,
  };
}

function statesEqual(a: ReplayState, b: ReplayState): boolean {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}
```

## Principle 7: Quarantine Inherently Non-Deterministic Events

Some events involve behavior that's hard to make deterministic (e.g., drag positions affected by React Flow internals). Mark these explicitly:

```typescript
type CartaEvent =
  | DeterministicEvent
  | NonDeterministicEvent;

type NonDeterministicEvent =
  | { type: 'DRAG_NODE'; nodeIndex: number; delta: Position; _nondeterministic: true }
  | { type: 'VIEWPORT_PAN'; delta: Position; _nondeterministic: true };
```

For these events, use tolerance-based assertions:

```typescript
it('drag moves node approximately correctly', async () => {
  const events: CartaEvent[] = [
    { type: 'CREATE_CONSTRUCT', constructType: 'Task', position: { x: 100, y: 100 } },
    { type: 'SELECT_NODE', nodeIndex: 0 },
    { type: 'DRAG_NODE', nodeIndex: 0, delta: { x: 50, y: 50 }, _nondeterministic: true },
  ];

  const state = await replayEvents(events);

  // Use tolerance for position
  expect(state.nodes[0].position.x).toBeCloseTo(150, 0);
  expect(state.nodes[0].position.y).toBeCloseTo(150, 0);
});
```

## Principle 8: Testing Weak Spots Directly

The replay system has blind spots where the environment control doesn't fully cover behavior. Test these explicitly:

| Weak Spot | Test Approach |
|-----------|---------------|
| Async race conditions | Rapid sequential mutations without waiting |
| React batching | Multiple state changes in single act() |
| Yjs observer timing | Mutations during observer callbacks |
| Concurrent updates | Interleaved operations from multiple "users" |

```typescript
describe('Weak spot: rapid mutations', () => {
  it('handles 100 rapid title changes', async () => {
    const env = createDeterministicEnv();

    try {
      const { result } = renderHook(() => useDocument(), { wrapper: TestProviders });
      await waitFor(() => expect(result.current.isReady).toBe(true));

      // Fire many updates without yielding
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.adapter.setTitle(`Title ${i}`);
        }
      });

      // Final state should be consistent
      expect(result.current.title).toBe('Title 99');

    } finally {
      env.cleanup();
    }
  });
});
```

## Why Real Code Matters

| Aspect | Simulation Approach | Real Code Approach |
|--------|--------------------|--------------------|
| What's tested | A model of the app | The actual app |
| Bugs found | Only if model matches reality | Real bugs in real code |
| Maintenance | Must keep model in sync | No sync needed |
| Confidence | "Model works" | "App works" |
| Determinism source | By construction | By environment control |

## Implementation Structure

```
tests/
├── replay/
│   ├── env.ts              # Deterministic environment (mocks)
│   ├── executor.ts         # applyEvent calling REAL hooks
│   ├── runner.ts           # replayEvents orchestration
│   ├── invariants.ts       # Invariant checkers
│   ├── permutations.ts     # Permutation generators
│   ├── fuzz.ts             # Random event generation
│   └── minimize.ts         # Failure sequence minimization
├── replay-tests/
│   ├── undo-redo.test.ts
│   ├── connections.test.ts
│   ├── clear.test.ts
│   └── fuzz.test.ts
└── weak-spots/
    ├── rapid-mutations.test.ts
    ├── concurrent-updates.test.ts
    └── observer-timing.test.ts
```

## The Testing Stack

```
┌─────────────────────────────────────────────────────────────┐
│  Fuzz Tests (10,000 random sequences)                       │
│  └── Uses: replayEvents() with random seed                  │
│  └── Tests: REAL hooks                                      │
│  └── Checks: Invariants hold                                │
├─────────────────────────────────────────────────────────────┤
│  Permutation Tests (event orderings)                        │
│  └── Uses: replayEvents() with permuted sequences           │
│  └── Tests: REAL hooks                                      │
│  └── Checks: State transitions correct                      │
├─────────────────────────────────────────────────────────────┤
│  Determinism Tests (same seed, same result)                 │
│  └── Uses: replayWithDeterminismCheck()                     │
│  └── Tests: Environment control completeness                │
│  └── Catches: Unmocked non-determinism                      │
├─────────────────────────────────────────────────────────────┤
│  Weak Spot Tests (race conditions, timing)                  │
│  └── Uses: Direct hook testing with stress                  │
│  └── Catches: Async bugs, batching issues                   │
├─────────────────────────────────────────────────────────────┤
│  E2E Smoke Tests (browser)                                  │
│  └── Uses: Playwright executing same event sequences        │
│  └── Catches: DOM/browser-specific issues                   │
└─────────────────────────────────────────────────────────────┘
```

The replay engine is a **test harness**, not a simulation. It controls the environment and drives real code, giving permutation and fuzzing benefits while testing the actual implementation.
