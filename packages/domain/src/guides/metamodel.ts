/**
 * Metamodel Guide - How to read and understand Carta documents
 *
 * This guide teaches AI agents how Carta's three-level metamodel works,
 * how to traverse connections, and how to interpret document structure.
 */

export const METAMODEL_GUIDE = `# Carta Metamodel Guide

## Overview

Carta is a visual architecture editor that uses a three-level metamodel to represent software designs. Understanding this structure is essential for interpreting Carta documents and generating code from them.

## The Three Levels

### M2: Fixed Primitives (Built into Carta)

These types are fixed and cannot be changed by users:

**DataKind** - The five primitive field types:
- \`string\` - Text data
- \`number\` - Numeric data
- \`boolean\` - True/false
- \`date\` - Date values
- \`enum\` - Fixed choices from a list

**Polarity** - Connection direction semantics (5 values):
- \`source\` - Initiates connections (flow-out, parent)
- \`sink\` - Receives connections (flow-in, child)
- \`bidirectional\` - Can both initiate and receive (symmetric)
- \`relay\` - Pass-through output, bypasses type checking
- \`intercept\` - Pass-through input, bypasses type checking

**PortSchema** - Defines port types with their polarity and compatibility rules.

### M1: User-Defined Schemas (Stored in Document)

Users define construct types via schemas. Each schema specifies:

\`\`\`typescript
interface ConstructSchema {
  type: string;           // Unique identifier: 'controller', 'table', etc.
  displayName: string;    // Human-readable name
  color: string;          // Visual accent color (hex)
  semanticDescription?: string;   // AI context for compilation
  fields: FieldSchema[];  // Data fields (use displayTier on fields to control visibility)
  ports?: PortConfig[];   // Connection points
  backgroundColorPolicy?: 'defaultOnly' | 'tints' | 'any';  // Instance color picker mode
  portDisplayPolicy?: 'inline' | 'collapsed';                 // Port visibility mode
}
\`\`\`

### M0: Construct Instances (Nodes on Canvas)

Instances are the actual nodes with data:

\`\`\`typescript
interface ConstructNodeData {
  constructType: string;     // References schema.type
  semanticId: string;        // Human/AI-readable identifier
  values: Record<string, unknown>;  // Field values
  connections?: ConnectionValue[];  // Outgoing connections
  deployableId?: string;     // Logical grouping
  instanceColor?: string;    // Hex color override (visual only, not compiled)
}
\`\`\`

## Understanding Connections

### Connection Storage

Connections are stored on the **source** construct in its \`connections\` array:

\`\`\`typescript
interface ConnectionValue {
  portId: string;           // Port on THIS construct (e.g., 'flow-out')
  targetSemanticId: string; // Target construct's semanticId
  targetPortId: string;     // Port on target construct (e.g., 'flow-in')
}
\`\`\`

### Port Types and Their Meaning

| Port Type | Polarity | Typical Usage |
|-----------|----------|---------------|
| \`flow-in\` | sink | Receives data/control flow |
| \`flow-out\` | source | Sends data/control flow |
| \`parent\` | source | Owns child constructs |
| \`child\` | sink | Belongs to parent construct |
| \`symmetric\` | bidirectional | Peer-to-peer relationship |
| \`intercept\` | intercept | Pass-through input (connects to any source) |
| \`relay\` | relay | Pass-through output (connects to any sink) |

### Common Relationship Patterns

**Parent-Child (Ownership)**
- A Database owns Tables: Database.parent → Table.child
- A Table owns Attributes: Table.parent → Attribute.child
- A Controller owns API Models: Controller.parent → ApiModel.child

**Flow (Data/Control)**
- UI Event triggers Controller: UIEvent.flow-out → Controller.flow-in
- Controller accesses Database: Controller.flow-out → Database.link-in

## Traversal Patterns

### Finding Children of a Construct

To find all children of a construct (e.g., all attributes of a table):

\`\`\`javascript
function findChildren(allNodes, parentSemanticId) {
  return allNodes.filter(node =>
    node.data.connections?.some(conn =>
      conn.targetSemanticId === parentSemanticId &&
      conn.portId === 'parent'  // Child's parent port points to parent
    )
  );
}
\`\`\`

### Finding Parent of a Construct

To find the parent of a construct:

\`\`\`javascript
function findParent(allNodes, childNode) {
  const parentConnection = childNode.data.connections?.find(
    conn => conn.portId === 'parent'
  );
  if (!parentConnection) return null;

  return allNodes.find(
    node => node.data.semanticId === parentConnection.targetSemanticId
  );
}
\`\`\`

### Following Flow Connections

To trace data flow from a UI event to backend:

\`\`\`javascript
function traceFlow(allNodes, startNode) {
  const path = [startNode];
  let current = startNode;

  while (true) {
    const flowOut = current.data.connections?.find(
      conn => conn.portId === 'flow-out'
    );
    if (!flowOut) break;

    const next = allNodes.find(
      node => node.data.semanticId === flowOut.targetSemanticId
    );
    if (!next) break;

    path.push(next);
    current = next;
  }

  return path;
}
\`\`\`

### Building Complete Hierarchy

To build a tree structure from a root construct:

\`\`\`javascript
function buildHierarchy(allNodes, rootSemanticId) {
  const root = allNodes.find(n => n.data.semanticId === rootSemanticId);
  if (!root) return null;

  const children = findChildren(allNodes, rootSemanticId);

  return {
    ...root.data,
    children: children.map(child =>
      buildHierarchy(allNodes, child.data.semanticId)
    )
  };
}
\`\`\`

## Understanding Deployables

Deployables are logical groupings that help organize constructs:

\`\`\`typescript
interface Deployable {
  id: string;
  name: string;        // e.g., "User Service API"
  description: string;
  color?: string;
}
\`\`\`

Constructs reference deployables via \`deployableId\`. This helps:
- Group related constructs (all API endpoints for a service)
- Plan deployment boundaries
- Generate code into appropriate modules

## Schema Semantic Descriptions

The \`semanticDescription\` field on schemas, fields, and port configs provides semantic context for AI:

- **Schema.semanticDescription**: "HTTP REST API endpoint controller" - Explains what this construct type represents
- **Field.semanticDescription**: "URL path pattern for this endpoint" - Explains what this field means
- **PortConfig.semanticDescription**: "Outgoing data flow to downstream services" - Explains the port's purpose

For enum fields, each option can also have a \`semanticDescription\`:
\`\`\`typescript
options: [
  { value: "GET", semanticDescription: "Read-only retrieval" },
  { value: "POST", semanticDescription: "Create a new resource" }
]
\`\`\`

Use these descriptions to understand the intended purpose when generating code.

## Node Identity

Constructs have two identifiers:
- **Node.id**: Internal UUID, never shown to users
- **semanticId**: Human-readable identifier like "controller-user-api"

Always use \`semanticId\` when referencing constructs in connections and generated code.

## Display Names and Display Tiers

Each field has a \`displayTier\` property controlling when it appears:
- \`pill\`: Used as the node title in pill/compact modes (max 1 per schema)
- \`minimal\`: Shown in collapsed/summary view
- \`details\`: Shown in expanded details view
- \`full\`: Only shown in full view modal (default)

Node titles are derived using:
1. If a field has \`displayTier: 'pill'\`, use that field's value
2. Otherwise, use \`semanticId\`

For example, a Controller with a \`route\` field at \`displayTier: 'pill'\` shows "/api/users" as its title.

## Visual Customization (Not Compiled)

### Background Color Policy

Schemas can control how users customize instance background colors via \`backgroundColorPolicy\`:

- \`defaultOnly\` (default): No color picker shown, instances use schema color only
- \`tints\`: Shows 7 tint swatches derived from schema color (92% lightness to 45% lightness)
- \`any\`: Shows full HTML5 color picker, allows any hex color

Instance colors are stored in \`instanceColor\` field and are visual-only (not included in compilation output). Setting \`instanceColor\` to null resets to the schema's default color.

**Example**: The built-in "Note" schema uses \`backgroundColorPolicy: 'any'\` to allow fully customizable note colors.

### Port Display Policy

Schemas can control how ports are displayed via \`portDisplayPolicy\`:

- \`inline\` (default): Port handles visible on node edges at all times
- \`collapsed\`: Ports hidden by default; click port icon in header to reveal PortPickerPopover

Collapsed ports reduce visual clutter for simple nodes like notes where connections are secondary to content.

**Example**: The built-in "Note" schema uses \`portDisplayPolicy: 'collapsed'\`.

### Edge Bundling

When multiple edges connect the same two nodes using the same port types (determined by source/target port IDs), they are automatically bundled into a single visual edge with a badge showing the count. This reduces visual clutter while preserving all connection data.

Edge bundling is visual-only and doesn't affect the underlying connection data structure. Each connection is still stored individually in the source construct's \`connections\` array.

**Edge Style**: Carta uses smoothstep (curved) edges for all connections, creating a cleaner visual appearance than straight lines.
`;
