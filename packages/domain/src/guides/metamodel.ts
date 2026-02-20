/**
 * Metamodel Guide - How to read and understand Carta documents
 *
 * This guide teaches AI agents how Carta's three-level metamodel works,
 * how to traverse connections, and how to interpret document structure.
 */

export const METAMODEL_GUIDE = `# Carta Metamodel Guide

## Overview

Carta uses a three-level metamodel to represent software architectures. Documents contain multiple pages, each with constructs (typed nodes), connections, and organizers (visual grouping containers).

## The Three Levels

**M2: Fixed Primitives** - Built into Carta, cannot be changed:
- \`DataKind\`: string, number, boolean, date, enum
- \`Polarity\`: source, sink, bidirectional, relay, intercept
- \`PortSchema\`: Defines port types with polarity and compatibility

**M1: User-Defined Schemas** - Construct types defined per-document:

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

Use \`carta_list_port_types\` to see all port types and their compatibility rules for a specific document.

## Organizers

Organizers are visual grouping containers. Constructs are placed inside via \`parentId\` field. Organizers are **not compiled** — they exist purely for visual organization on the canvas.

## Pages

Documents have multiple pages. Each page is a separate canvas view. MCP tools target the active page by default unless a \`pageId\` is specified.

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

**To understand a document's full structure:**
- Use \`carta_compile\` to get the complete AI-readable representation.

**To explore incrementally:**
1. Use \`carta_list_pages\` to see all pages
2. Use \`carta_set_active_page\` to switch views
3. Use \`carta_get_document_summary\` with \`include: ['constructs', 'schemas']\` to see page contents

**To read a specific construct:**
- Use \`carta_get_construct\` with its \`semanticId\`.

**To modify the document:**
- Use \`carta_create_construct\`, \`carta_update_construct\`, \`carta_delete_construct\`
- Use \`carta_connect_constructs\`, \`carta_disconnect_constructs\`
- Use \`carta_create_schema\`, \`carta_update_schema\` to define new construct types

## Cookbook — Common Tool Patterns

### Create and connect in one call

Use \`carta_batch_mutate\` with \`@N\` placeholders to create constructs and connect them atomically:

\`\`\`json
{
  "documentId": "...",
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
  "documentId": "...",
  "operations": [
    { "op": "create", "constructType": "service", "values": { "name": "User DB" }, "parentId": "org-abc123" },
    { "op": "create", "constructType": "service", "values": { "name": "Session DB" }, "parentId": "org-abc123" }
  ]
}
\`\`\`

When \`parentId\` is set, x/y positions are relative to the organizer. Omit x/y for auto-placement.

### Discover schemas before creating constructs

1. \`carta_list_schemas\` with \`output: "compact"\` — see all available types
2. \`carta_get_schema\` — get field names, types, and port configurations for a specific type
3. Then create constructs with the correct \`values\` keys

### Arrange nodes with flow layout

\`\`\`json
{
  "documentId": "...",
  "direction": "LR",
  "layerGap": 250,
  "nodeGap": 150
}
\`\`\`

Use \`carta_flow_layout\` for topological DAG arrangement. Supports TB/BT/LR/RL.

### Arrange nodes with constraints

\`\`\`json
{
  "documentId": "...",
  "strategy": "preserve",
  "constraints": [
    { "type": "group", "by": "constructType", "axis": "x" },
    { "type": "spacing", "equal": true },
    { "type": "align", "axis": "y", "alignment": "center" }
  ]
}
\`\`\`

Use \`carta_arrange\` for declarative constraint-based layout. Strategies: "grid" (initial), "preserve" (adjust), "force" (spring layout).

### Move a construct between organizers

\`\`\`json
{
  "documentId": "...",
  "semanticId": "service-abc123",
  "parentId": "org-target456"
}
\`\`\`

Use \`carta_move_construct\`. Set \`parentId\` to \`null\` to detach from an organizer.

### Analyze an existing document

1. \`carta_get_document_summary\` with \`include: ["constructs", "schemas"]\` — get everything in one call
2. \`carta_compile\` — get the AI-readable output for full context
3. Look for orphan constructs (no connections), empty fields, unused schemas
`;
