# React Flow: Handles

## Basic Handle Usage

```jsx
import { Handle, Position } from '@xyflow/react';

function CustomNode({ data }) {
  return (
    <div>
      <Handle type="target" position={Position.Top} />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

## Handle Positions

```jsx
import { Position } from '@xyflow/react';

Position.Top     // Handle at top of node
Position.Bottom  // Handle at bottom
Position.Left    // Handle on left side
Position.Right   // Handle on right side
```

## Multiple Handles: Always Use Unique IDs

```jsx
function MultipleOutputNode({ data }) {
  return (
    <div>
      <Handle type="target" position={Position.Left} id="input" />
      <span>{data.label}</span>
      {/* Multiple source handles need unique IDs */}
      <Handle type="source" position={Position.Right} id="a" style={{ top: '30%' }} />
      <Handle type="source" position={Position.Right} id="b" style={{ top: '70%' }} />
    </div>
  );
}

// Connect to specific handle
const edge = {
  id: 'e1',
  source: 'node1',
  target: 'node2',
  sourceHandle: 'a',  // Connect from handle 'a'
  targetHandle: 'input',
};
```

## Critical: Hiding Handles

```jsx
// CORRECT - use visibility or opacity
<Handle style={{ visibility: 'hidden' }} ... />
<Handle style={{ opacity: 0 }} ... />

// WRONG - display:none breaks edge connections!
<Handle style={{ display: 'none' }} ... />  // DON'T DO THIS
```

`display: none` reports width/height of 0, breaking edge position calculations.

## Custom Handle Styling

```jsx
<Handle
  type="source"
  position={Position.Right}
  style={{
    background: '#555',
    width: 12,
    height: 12,
    border: '2px solid white',
  }}
/>
```

## Custom Handle Content

```jsx
<Handle
  type="source"
  position={Position.Right}
  style={{ background: 'none', border: 'none' }}
>
  {/* Content inside handle - disable pointer events */}
  <CustomIcon style={{ pointerEvents: 'none' }} />
</Handle>
```

## Connection Validation

```jsx
<Handle
  type="target"
  position={Position.Top}
  isConnectable={true}  // Can receive connections
  isValidConnection={(connection) => {
    // Only allow connections from specific node types
    return connection.source !== connection.target;
  }}
/>
```

## Dynamic Handles

When programmatically adding/removing handles:

```jsx
import { useUpdateNodeInternals } from '@xyflow/react';

function DynamicNode({ id, data }) {
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    // After handles change, update internals
    updateNodeInternals(id);
  }, [data.handles, id, updateNodeInternals]);

  return (
    <div>
      {data.handles.map((handle) => (
        <Handle
          key={handle.id}
          type={handle.type}
          position={handle.position}
          id={handle.id}
        />
      ))}
    </div>
  );
}
```

## useHandleConnections Hook

Get connections for a specific handle:

```jsx
import { useHandleConnections } from '@xyflow/react';

function CustomNode({ id }) {
  const connections = useHandleConnections({
    type: 'target',
    id: 'input-handle', // optional: specific handle
  });

  return (
    <div>
      Connected to {connections.length} nodes
    </div>
  );
}
```
