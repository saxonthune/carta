# React Flow: Common Errors and Solutions

## "Seems like you have not used zustand provider as an ancestor"

**Causes:**
1. Two different versions of `@xyflow/react` installed
2. Using hooks outside `ReactFlowProvider`

**Solutions:**
```bash
# Check for duplicate packages
npm ls @xyflow/react

# Fix duplicates
npm dedupe
```

```jsx
// Wrap with provider
<ReactFlowProvider>
  <FlowComponent />  {/* Can use hooks here */}
</ReactFlowProvider>
```

## "It looks like you've created a new nodeTypes or edgeTypes object"

**Cause:** Creating new object reference inside component

**Solution:**
```jsx
// WRONG
function Flow() {
  const nodeTypes = { custom: CustomNode };  // New object every render
  return <ReactFlow nodeTypes={nodeTypes} />;
}

// CORRECT
const nodeTypes = { custom: CustomNode };  // Outside component
function Flow() {
  return <ReactFlow nodeTypes={nodeTypes} />;
}
```

## "Node type not found"

**Cause:** Type string doesn't match nodeTypes key

**Solution:**
```jsx
const nodeTypes = { customNode: CustomNode };  // Key is 'customNode'

// Node must use exact key
const node = { id: '1', type: 'customNode', ... };  // CORRECT
const node = { id: '1', type: 'CustomNode', ... };  // WRONG - case sensitive
const node = { id: '1', type: 'custom', ... };      // WRONG - different string
```

## "The React Flow parent container needs a width and a height"

**Cause:** Parent div has no dimensions

**Solution:**
```jsx
// WRONG
<div>
  <ReactFlow />
</div>

// CORRECT
<div style={{ width: '100vw', height: '100vh' }}>
  <ReactFlow />
</div>

// Or via CSS
<div className="flow-container">  {/* .flow-container { width: 100%; height: 500px; } */}
  <ReactFlow />
</div>
```

## Edges Not Displaying

**Possible Causes:**

1. **CSS not imported:**
```jsx
import '@xyflow/react/dist/style.css';  // Add this!
```

2. **Custom nodes missing handles:**
```jsx
function CustomNode({ data }) {
  return (
    <div>
      <Handle type="target" position={Position.Top} />  {/* Add handles! */}
      {data.label}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

3. **External CSS overriding styles:**
```css
/* Tailwind/Bulma may add this - override it */
.react-flow__edges {
  overflow: visible !important;
}
```

4. **Need to update node internals:**
```jsx
const updateNodeInternals = useUpdateNodeInternals();
// After async operations that affect handles:
updateNodeInternals(nodeId);
```

## Edges Not Connecting to Correct Position

**Cause:** Using `display: none` on handles

**Solution:**
```jsx
// WRONG - breaks edge calculations
<Handle style={{ display: 'none' }} />

// CORRECT - hides visually but maintains dimensions
<Handle style={{ visibility: 'hidden' }} />
<Handle style={{ opacity: 0 }} />
```

## Multiple Handles Not Working

**Cause:** Missing unique IDs

**Solution:**
```jsx
// WRONG
<Handle type="source" position={Position.Right} />
<Handle type="source" position={Position.Right} />  // Same type, no ID

// CORRECT
<Handle type="source" position={Position.Right} id="a" />
<Handle type="source" position={Position.Right} id="b" />
```

## Input/Select Not Working in Custom Node

**Cause:** Node drag intercepting events

**Solution:**
```jsx
// Add nodrag class to interactive elements
<input className="nodrag" type="text" />
<select className="nodrag">...</select>
<button className="nodrag nopan">Click</button>
```

## Changes Not Reflecting

**Cause:** Mutating objects instead of creating new ones

**Solution:**
```jsx
// WRONG - mutation
const updateNode = (id, newData) => {
  const node = nodes.find(n => n.id === id);
  node.data = newData;  // Mutation!
  setNodes([...nodes]);
};

// CORRECT - new object
const updateNode = (id, newData) => {
  setNodes(nodes.map(node =>
    node.id === id
      ? { ...node, data: { ...node.data, ...newData } }
      : node
  ));
};
```

## SSR/Hydration Errors

**Cause:** Missing node dimensions for server rendering

**Solution:**
```jsx
const nodes = [
  {
    id: '1',
    position: { x: 0, y: 0 },
    data: { label: 'Node' },
    width: 150,   // Required for SSR
    height: 40,   // Required for SSR
  },
];
```
