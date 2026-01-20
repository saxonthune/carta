# React Flow: Setup and Basics

## Critical Requirements

### 1. Always Import CSS
```jsx
import '@xyflow/react/dist/style.css';
```
Without this, edges won't display and styling will be broken.

### 2. Parent Container Must Have Dimensions
```jsx
// CORRECT
<div style={{ width: '100vw', height: '100vh' }}>
  <ReactFlow nodes={nodes} edges={edges} />
</div>

// WRONG - will show "Parent container needs width and height" error
<div>
  <ReactFlow nodes={nodes} edges={edges} />
</div>
```

### 3. Use the Correct Package
```jsx
// CORRECT (v12+)
import { ReactFlow } from '@xyflow/react';

// WRONG (deprecated)
import ReactFlow from 'reactflow';
```

## Minimal Working Example

```jsx
import { ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
  { id: '2', position: { x: 0, y: 100 }, data: { label: 'Node 2' } },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2' },
];

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow nodes={initialNodes} edges={initialEdges} />
    </div>
  );
}
```

## Node Structure

```typescript
{
  id: string;          // Required: unique identifier
  position: { x: number, y: number };  // Required: position in flow
  data: { label: string };             // Required: passed to node component
  type?: string;       // Optional: 'default' | 'input' | 'output' | 'group' | custom
}
```

## Edge Structure

```typescript
{
  id: string;          // Required: unique identifier
  source: string;      // Required: source node id
  target: string;      // Required: target node id
  type?: string;       // Optional: 'default' | 'smoothstep' | 'step' | 'straight' | custom
  sourceHandle?: string;  // Optional: handle id on source node
  targetHandle?: string;  // Optional: handle id on target node
}
```

## Built-in Node Types

| Type | Description |
|------|-------------|
| `default` | Has source and target handles |
| `input` | Only source handle (start node) |
| `output` | Only target handle (end node) |
| `group` | No handles, used for grouping child nodes |

## Built-in Edge Types

| Type | Description |
|------|-------------|
| `default` | Bezier curve |
| `smoothstep` | Stepped with rounded corners |
| `step` | Right-angled |
| `straight` | Direct line |
