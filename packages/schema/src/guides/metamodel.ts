/**
 * Metamodel Guide - How to read and understand Carta canvases
 *
 * This guide teaches AI agents how Carta's three-level metamodel works,
 * how to traverse connections, and how to interpret canvas structure.
 */

export const METAMODEL_GUIDE = `# Carta Metamodel Guide

## Overview

Carta uses a three-level metamodel to represent software architectures. Workspace canvases contain constructs (typed nodes), connections, and organizers (visual grouping containers). Each canvas is a single-page file in the workspace.

## The Three Levels

**M2: Fixed Primitives** - Built into Carta, cannot be changed:
- \`DataKind\`: string, number, boolean, date, enum
- \`Polarity\`: source, sink, bidirectional, relay, intercept
- \`PortSchema\`: Defines port types with polarity and compatibility

**M1: User-Defined Schemas** - Construct types defined per-canvas:

\`\`\`typescript
interface ConstructSchema {
  type: string;                  // Unique identifier
  displayName: string;           // Human-readable name
  color: string;                 // Visual accent (hex)
  semanticDescription?: string;  // AI context for this type
  fields: FieldSchema[];         // Data fields
  ports?: PortConfig[];          // Connection points
}
\`\`\`

**M0: Construct Instances** - Actual nodes on the canvas with data.

## Ports and Connections

Connections are stored on the source construct. Each connection references the target's \`semanticId\`.

| Port Type | Polarity | Typical Usage |
|-----------|----------|---------------|
| \`flow-in\` | sink | Receives data/control flow |
| \`flow-out\` | source | Sends data/control flow |
| \`parent\` | source | Owns child constructs |
| \`child\` | sink | Belongs to parent construct |
| \`symmetric\` | bidirectional | Peer-to-peer relationship |
| \`intercept\` | intercept | Pass-through input (connects to any source) |
| \`relay\` | relay | Pass-through output (connects to any sink) |

### Port Compatibility Matrix

Connections are only valid between compatible port types:

| Source Port | Can Connect To | Notes |
|-------------|---------------|-------|
| \`flow-out\` (source) | \`flow-in\` (sink) | Standard directional flow |
| \`parent\` (source) | \`child\` (sink) | Ownership/containment |
| \`symmetric\` (bidirectional) | \`symmetric\` (bidirectional) | Peer-to-peer, either direction |
| \`relay\` (relay) | Any sink port | Pass-through, bypasses type checking |
| Any source port | \`intercept\` (intercept) | Pass-through input, bypasses type checking |

Custom port types (e.g. \`policy-in\`, \`invoke-out\`) inherit their polarity from the base port type they extend. For example, \`policy-in\` with \`portType: "flow-in"\` is compatible with any \`flow-out\` or \`relay\` port.

Use \`carta_schema op:list_port_types\` to see all port types and their compatibility rules for a specific canvas (takes canvasId).

## Organizers

Organizers are visual grouping containers. Constructs are placed inside via \`parentId\` field. Organizers are **not compiled** — they exist purely for visual organization on the canvas.

## Workspace Canvases

Workspace canvases are single-page files in the \`.carta/\` directory. There is no multi-page concept — each canvas is its own file. Use \`carta_workspace op:status\` to see all canvases in the workspace.

## Node Identity

Constructs use \`semanticId\` as their handle — a human/AI-readable identifier. There is no \`name\` field on instances. When a schema defines a \`displayField\`, that field's value appears as the node's title; otherwise, \`semanticId\` is shown.

## Render Styles

Schemas can specify \`renderStyle\`: \`default\`, \`simple\`, \`circle\`, \`diamond\`, or \`document\`. This affects visual appearance only.

## Semantic Descriptions

The \`semanticDescription\` field appears on schemas, fields, and ports. It provides semantic context for AI understanding. Use these descriptions to interpret what constructs represent and how they relate.

For enum fields, each option can have its own \`semanticDescription\`:

\`\`\`typescript
options: [
  { value: "GET", semanticDescription: "Read-only retrieval" },
  { value: "POST", semanticDescription: "Create new resource" }
]
\`\`\`

## Tool Workflows

**To understand a canvas's full structure:**
- Use \`carta_compile\` to get the complete AI-readable representation.

**To explore incrementally:**
1. Use \`carta_workspace op:status\` to see all canvases in the workspace
2. Use \`carta_canvas op:summary\` with \`include: ['constructs', 'schemas']\` to see canvas contents
3. Use \`carta_canvas op:get\` for the full canvas with all construct data

**To modify the canvas:**
- Use \`carta_canvas op:create\`, \`carta_canvas op:update\`, \`carta_canvas op:delete\`
- Use \`carta_canvas op:connect\`, \`carta_canvas op:disconnect\`
- Use \`carta_schema op:create\`, \`carta_schema op:update\` to define new construct types

## Cookbook — Common Tool Patterns

### Create and connect in one call

Use \`carta_canvas op:batch\` with \`@N\` placeholders to create constructs and connect them atomically:

\`\`\`json
{
  "canvasId": "01-vision/domain-sketch",
  "op": "batch",
  "operations": [
    { "op": "create", "constructType": "service", "values": { "name": "Auth Service" } },
    { "op": "create", "constructType": "service", "values": { "name": "API Gateway" } },
    { "op": "connect", "sourceSemanticId": "@1", "sourcePortId": "flow-out", "targetSemanticId": "@0", "targetPortId": "flow-in" }
  ]
}
\`\`\`

\`@0\` and \`@1\` resolve to the semanticIds generated by the create operations at those indices.

### Create constructs inside an organizer

\`\`\`json
{
  "canvasId": "01-vision/domain-sketch",
  "op": "batch",
  "operations": [
    { "op": "create", "constructType": "service", "values": { "name": "User DB" }, "parentId": "org-abc123" },
    { "op": "create", "constructType": "service", "values": { "name": "Session DB" }, "parentId": "org-abc123" }
  ]
}
\`\`\`

When \`parentId\` is set, x/y positions are relative to the organizer. Omit x/y for auto-placement.

### Discover schemas before creating constructs

1. \`carta_schema op:list\` with \`output: "compact"\` — see all available types
2. \`carta_schema op:get\` — get field names, types, and port configurations for a specific type
3. Then create constructs with the correct \`values\` keys

### Arrange nodes with flow layout

\`\`\`json
{
  "canvasId": "01-vision/domain-sketch",
  "op": "flow",
  "direction": "LR",
  "layerGap": 250,
  "nodeGap": 150
}
\`\`\`

Use \`carta_layout op:flow\` for topological DAG arrangement. Supports TB/BT/LR/RL.

### Arrange nodes with constraints

\`\`\`json
{
  "canvasId": "01-vision/domain-sketch",
  "op": "arrange",
  "strategy": "preserve",
  "constraints": [
    { "type": "group", "by": "constructType", "axis": "x" },
    { "type": "spacing", "equal": true },
    { "type": "align", "axis": "y", "alignment": "center" }
  ]
}
\`\`\`

Use \`carta_layout op:arrange\` for declarative constraint-based layout. Strategies: "grid" (initial), "preserve" (adjust), "force" (spring layout).

### Move a construct between organizers

\`\`\`json
{
  "canvasId": "01-vision/domain-sketch",
  "op": "move",
  "semanticId": "service-abc123",
  "parentId": "org-target456"
}
\`\`\`

Use \`carta_canvas op:move\`. Set \`parentId\` to \`null\` to detach from an organizer.

### Analyze an existing canvas

1. \`carta_canvas op:summary\` with \`include: ["constructs", "schemas"]\` — get everything in one call
2. \`carta_compile\` — get the AI-readable output for full context
3. Look for orphan constructs (no connections), empty fields, unused schemas
`;
