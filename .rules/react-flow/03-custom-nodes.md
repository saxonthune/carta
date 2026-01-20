# React Flow: Custom Nodes

## Basic Custom Node

```jsx
import { Handle, Position } from '@xyflow/react';

function CustomNode({ data }) {
  return (
    <div className="custom-node">
      <Handle type="target" position={Position.Top} />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

## Critical: Define nodeTypes Outside Component

```jsx
// CORRECT - defined outside, object reference is stable
const nodeTypes = { custom: CustomNode };

function Flow() {
  return <ReactFlow nodeTypes={nodeTypes} />;
}

// WRONG - creates new object every render, causes warnings
function Flow() {
  const nodeTypes = { custom: CustomNode }; // BAD!
  return <ReactFlow nodeTypes={nodeTypes} />;
}

// ACCEPTABLE - if you must define inside, use useMemo
function Flow() {
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);
  return <ReactFlow nodeTypes={nodeTypes} />;
}
```

## Multiple Handles Require Unique IDs

```jsx
function MultiHandleNode({ data }) {
  return (
    <div>
      <Handle type="source" position={Position.Right} id="output-a" />
      <Handle type="source" position={Position.Right} id="output-b" style={{ top: 20 }} />
      <Handle type="target" position={Position.Left} id="input" />
      {data.label}
    </div>
  );
}

// Connect to specific handle via sourceHandle/targetHandle
const edge = {
  id: 'e1',
  source: 'node1',
  target: 'node2',
  sourceHandle: 'output-a',
  targetHandle: 'input',
};
```

## Interactive Elements Need Utility Classes

```jsx
function InteractiveNode({ data }) {
  return (
    <div>
      {/* nodrag: prevents node dragging when interacting */}
      <input className="nodrag" type="text" />

      {/* nodrag nopan: prevents dragging AND panning */}
      <button className="nodrag nopan">Click me</button>

      {/* nowheel: prevents zoom when scrolling */}
      <div className="nowheel" style={{ overflow: 'auto', height: 100 }}>
        <p>Scrollable content...</p>
      </div>
    </div>
  );
}
```

## Utility Classes Reference

| Class | Effect |
|-------|--------|
| `nodrag` | Prevents node drag when interacting with element |
| `nopan` | Prevents canvas pan when interacting with element |
| `nowheel` | Prevents zoom when scrolling over element |

## Accessing Node Props

```jsx
function CustomNode({
  id,                    // Node id
  data,                  // Custom data object
  type,                  // Node type string
  selected,              // Is node selected
  isConnectable,         // Can create connections
  positionAbsoluteX,     // Absolute X position (v12+)
  positionAbsoluteY,     // Absolute Y position (v12+)
  dragging,              // Is being dragged
}) {
  return <div>Node: {id}</div>;
}
```

## TypeScript: Custom Node Types

```tsx
import type { Node, NodeProps } from '@xyflow/react';

// Define node data type (use 'type', not 'interface')
type CustomNodeData = { label: string; value: number };

// Define node type with data and type discriminator
type CustomNode = Node<CustomNodeData, 'custom'>;

// Component receives typed props
function CustomNode({ data }: NodeProps<CustomNode>) {
  return <div>{data.label}: {data.value}</div>;
}
```

## Dynamic Handles

When adding/removing handles programmatically, update internals:

```jsx
import { useUpdateNodeInternals } from '@xyflow/react';

function DynamicHandleNode({ id, data }) {
  const updateNodeInternals = useUpdateNodeInternals();

  const addHandle = () => {
    // After modifying handles in data...
    updateNodeInternals(id);
  };

  return (
    <div>
      {data.handles.map((h) => (
        <Handle key={h.id} type={h.type} position={h.position} id={h.id} />
      ))}
      <button onClick={addHandle}>Add Handle</button>
    </div>
  );
}
```
