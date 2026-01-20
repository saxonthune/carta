# React Flow: Performance

## Memoize Custom Components

```jsx
import { memo } from 'react';

// Always memo custom nodes and edges
const CustomNode = memo(({ data }) => {
  return <div>{data.label}</div>;
});

const CustomEdge = memo(({ id, sourceX, sourceY, targetX, targetY }) => {
  // ...
});
```

## Memoize Callbacks

```jsx
const onNodesChange = useCallback(
  (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
  [],
);

const onNodeClick = useCallback((event, node) => {
  console.log('clicked', node.id);
}, []);
```

## Memoize Object Props

```jsx
// WRONG - creates new object every render
<ReactFlow
  defaultEdgeOptions={{ animated: true }}
  snapGrid={[15, 15]}
/>

// CORRECT - stable references
const defaultEdgeOptions = useMemo(() => ({ animated: true }), []);
const snapGrid = useMemo(() => [15, 15], []);

<ReactFlow
  defaultEdgeOptions={defaultEdgeOptions}
  snapGrid={snapGrid}
/>
```

## Avoid useStore with Full Arrays

```jsx
// BAD - re-renders on ANY node change
const nodes = useStore((state) => state.nodes);
const selectedNodes = nodes.filter(n => n.selected);

// GOOD - only re-renders when selection changes
const selectedNodeIds = useStore((state) =>
  state.nodes.filter(n => n.selected).map(n => n.id)
);
```

## Use Selectors for Specific Data

```jsx
import { useStore } from '@xyflow/react';

// Access only what you need
const nodeCount = useStore((state) => state.nodes.length);
const hasSelection = useStore((state) => state.nodes.some(n => n.selected));

// For node lookups, use nodeLookup (Map)
const specificNode = useStore((state) => state.nodeLookup.get('node-1'));
```

## Collapse Hidden Subtrees

```jsx
// Use hidden property to toggle visibility
const nodes = [
  { id: '1', data: { label: 'Visible' }, position: { x: 0, y: 0 } },
  { id: '2', data: { label: 'Hidden' }, position: { x: 100, y: 0 }, hidden: true },
];

// Better than filtering out nodes - maintains state
```

## Simplify Styles

Expensive CSS properties affect performance:
- Avoid complex `box-shadow`
- Minimize `filter` and `backdrop-filter`
- Reduce gradient complexity
- Limit animations on many nodes

## Large Flow Optimization

For flows with 1000+ nodes:

1. **Virtualization is built-in** - nodes outside viewport don't render
2. **Use simpler node components** - less DOM = faster
3. **Batch updates** when adding many nodes
4. **Consider `nodesDraggable={false}`** if drag not needed

## useNodesData for Cross-Node Communication

```jsx
// Efficient way to read connected node data
import { useNodesData, useHandleConnections } from '@xyflow/react';

function ReceiverNode({ id }) {
  const connections = useHandleConnections({ type: 'target' });
  const sourceIds = connections.map(c => c.source);
  const nodesData = useNodesData(sourceIds);

  // Only re-renders when connected nodes' data changes
  return <div>{nodesData.map(n => n.data.value).join(', ')}</div>;
}
```
