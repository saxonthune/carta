---
title: Process Flow
summary: Process flow (flowchart) structure — data model, UI design, canvas interactions, and engine requirements
tags: [project, process-flow, flowchart, ui, structures, canvas]
deps: [doc05.01.03, doc01.08.10, doc03.07]
---

# Process Flow

Ordered sequence of steps with conditions and branching. Rendered as a flowchart on the canvas. This is a Phase 2 structure — it requires canvas node-and-edge primitives.

## Data model

A process flow has **steps** (nodes) and **transitions** (edges).

Steps have:
- **key** — stable string identifier
- **label** — display text (editable inline on canvas)
- **kind** — `action` (do something) or `decision` (branch)
- **remark** — optional description

Transitions have:
- **from** / **to** — step keys
- **label** — optional edge label (e.g., "yes" / "no" on decision branches)

## YAML format

```carta
name: Employee Onboarding
type: process-flow
---
steps:
  - key: collect-info
    label: Collect personal info
    kind: action
  - key: verify-ssn
    label: Verify SSN
    kind: action
  - key: ssn-valid
    label: SSN valid?
    kind: decision
  - key: setup-payroll
    label: Set up payroll
    kind: action
  - key: reject
    label: Reject application
    kind: action
transitions:
  - from: collect-info
    to: verify-ssn
  - from: verify-ssn
    to: ssn-valid
  - from: ssn-valid
    to: setup-payroll
    label: "yes"
  - from: ssn-valid
    to: reject
    label: "no"
```

## UI

Rendered as a flowchart inside a file container on the canvas. Action steps render as rounded rectangles; decision steps render as diamonds. Transitions render as directed edges with optional labels.

### UI actions

| Action | Surface | Trigger | Behavior |
|--------|---------|---------|----------|
| Drag step | Canvas | Drag node | Move step to new position. Canvas engine `useNodeDrag` |
| Edit label | Inline | Click step text | Inline text edit on the node. `data-no-pan` prevents canvas pan during typing |
| Add step after | Context menu | Right-click terminal step | Insert new action step, connected from the clicked step |
| Insert step on edge | Context menu | Right-click edge | Split edge: new step inserted between source and target. Old edge becomes two edges |
| Add decision branch | Context menu | Right-click step (action or decision) | Convert to decision (if action), add new branch edge + target step |
| Delete step | Context menu | Right-click step | Remove step and reconnect surrounding edges (or leave gap). Warn if multiple incoming/outgoing |
| Delete transition | Context menu | Right-click edge | Remove edge |
| Edit transition label | Inline | Click edge label | Inline text edit on the edge label |
| Select | Canvas | Click step or box-select | Canvas engine `useSelection` |
| Connect steps | Canvas | Drag from connection handle | Draw new transition edge. Canvas engine `useConnectionDrag` |

### On-screen buttons

- **Add step** (`+` button) — adds a disconnected action step to the canvas. User then connects it manually.

## Canvas engine requirements

What the canvas engine (doc03.07 — Canvas Engine) needs to provide for this structure:

| Requirement | Status | Notes |
|-------------|--------|-------|
| Node drag | Exists | `useNodeDrag` — works as-is |
| Node selection | Exists | `useSelection` — works as-is |
| Connection drag | Exists | `useConnectionDrag` + `ConnectionHandle` — works as-is |
| Viewport (pan/zoom) | Exists | `useViewport` — works as-is |
| Keyboard shortcuts | Exists | `useKeyboardShortcuts` — works as-is (delete selected, etc.) |
| **Edge hit-testing** | **Missing** | Right-click on edge to insert node or delete edge. Engine currently only hit-tests connection *targets*, not existing edges |
| **Context menu positioning** | **Missing** | Need screen position of right-click on node/edge, plus which node/edge was clicked. Not an engine primitive today — structure editors handle their own `onContextMenu` |
| **Inline text editing on nodes** | **Not engine** | Plain React — render `<input>` inside node component with `data-no-pan`. No engine change needed |

### Edge hit-testing detail

The biggest engine gap. Options:
- **(A) SVG pointer events on edge paths** — render edges with `pointer-events: stroke` or a wider invisible hit area. `onContextMenu` on the `<path>` element. Simple, browser-native.
- **(B) Engine-level edge hit-test hook** — `useEdgeInteraction` that manages hit-testing and reports which edge was clicked/right-clicked.

Option A is simpler and sufficient for now. The edge `<path>` is already rendered by the consumer — just add pointer event handlers to it. No engine change needed if we're willing to put the hit area in the consumer's edge rendering.

## Open questions

- What happens when you delete a step that has multiple incoming and outgoing edges? Options: (a) reconnect all incoming to all outgoing (combinatorial explosion), (b) reconnect only if 1-in-1-out otherwise leave disconnected, (c) always leave disconnected.
- Should there be auto-layout (Sugiyama/flow) for process flows, or is manual positioning sufficient?
- How do decision branches get labeled? Auto-prompt "yes/no" on creation? User types freely?
