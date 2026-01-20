# React Flow: Advanced Patterns

## Data Flow Between Nodes

### Pattern: Using updateNodeData

```jsx
import { useReactFlow, useHandleConnections, useNodesData } from '@xyflow/react';

// Source node: write data
function InputNode({ id }) {
  const { updateNodeData } = useReactFlow();

  return (
    <input
      className="nodrag"
      onChange={(e) => updateNodeData(id, { value: e.target.value })}
    />
  );
}

// Target node: read connected node data
function OutputNode() {
  const connections = useHandleConnections({ type: 'target' });
  const nodesData = useNodesData(connections.map(c => c.source));

  const combinedValue = nodesData.map(n => n.data.value).join(', ');

  return <div>Received: {combinedValue}</div>;
}
```

### Warning: Don't Use Node Data as Input State

```jsx
// WRONG - causes cursor jump due to async updates
function BadInputNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  return (
    <input
      value={data.value}  // Don't bind to node data!
      onChange={(e) => updateNodeData(id, { value: e.target.value })}
    />
  );
}

// CORRECT - use local state, sync to node data
function GoodInputNode({ id }) {
  const [value, setValue] = useState('');
  const { updateNodeData } = useReactFlow();

  const onChange = (e) => {
    setValue(e.target.value);
    updateNodeData(id, { value: e.target.value });
  };

  return <input value={value} onChange={onChange} className="nodrag" />;
}
```

## SSR/SSG Configuration

```jsx
// For server-side rendering, provide dimensions
const nodes = [
  {
    id: '1',
    position: { x: 0, y: 0 },
    data: { label: 'SSR Node' },
    width: 150,        // Fixed width
    height: 40,        // Fixed height
    handles: [         // Manual handle positions
      { type: 'target', position: Position.Top, x: 75, y: 0 },
      { type: 'source', position: Position.Bottom, x: 75, y: 40 },
    ],
  },
];

// Provide container dimensions for fitView
<ReactFlow
  nodes={nodes}
  edges={edges}
  fitView
  width={1000}   // Container width
  height={500}   // Container height
/>
```

## Controlled Viewport

```jsx
import { useViewport } from '@xyflow/react';

function Flow() {
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  return (
    <ReactFlow
      viewport={viewport}
      onViewportChange={setViewport}
    />
  );
}
```

## Programmatic Actions

```jsx
import { useReactFlow } from '@xyflow/react';

function Controls() {
  const {
    fitView,
    zoomIn,
    zoomOut,
    setCenter,
    getNodes,
    getEdges,
    setNodes,
    setEdges,
    addNodes,
    addEdges,
    deleteElements,
  } = useReactFlow();

  const centerOnNode = (nodeId) => {
    const node = getNodes().find(n => n.id === nodeId);
    if (node) {
      setCenter(node.position.x, node.position.y, { zoom: 1.5 });
    }
  };

  const addNewNode = () => {
    addNodes({
      id: `node-${Date.now()}`,
      position: { x: 100, y: 100 },
      data: { label: 'New' }
    });
  };

  return (
    <div>
      <button onClick={() => fitView()}>Fit</button>
      <button onClick={() => zoomIn()}>+</button>
      <button onClick={() => zoomOut()}>-</button>
      <button onClick={addNewNode}>Add Node</button>
    </div>
  );
}
```

## Connection Line Customization

```jsx
function CustomConnectionLine({ fromX, fromY, toX, toY }) {
  return (
    <g>
      <path
        fill="none"
        stroke="#222"
        strokeWidth={1.5}
        d={`M${fromX},${fromY} C ${fromX} ${toY} ${fromX} ${toY} ${toX},${toY}`}
      />
      <circle cx={toX} cy={toY} fill="#fff" r={3} stroke="#222" strokeWidth={1.5} />
    </g>
  );
}

<ReactFlow connectionLineComponent={CustomConnectionLine} />
```

## Reconnecting Edges

```jsx
import { reconnectEdge } from '@xyflow/react';

function Flow() {
  const onReconnect = useCallback((oldEdge, newConnection) => {
    setEdges((edges) => reconnectEdge(oldEdge, newConnection, edges));
  }, []);

  return (
    <ReactFlow
      onReconnect={onReconnect}
      // Optional: customize reconnect behavior
      reconnectRadius={25}
    />
  );
}
```

## Keyboard Navigation

```jsx
<ReactFlow
  nodesFocusable={true}     // Tab to navigate nodes
  edgesFocusable={true}     // Tab to navigate edges
  disableKeyboardA11y={false}  // Enable keyboard controls
  // Arrow keys move selected nodes when nodesDraggable={true}
/>
```

## Dark Mode

```jsx
<ReactFlow
  colorMode="dark"    // 'light' | 'dark' | 'system'
/>
```

## CSS Variables for Theming

```css
.react-flow {
  --xy-background-color-default: #1a1a1a;
  --xy-background-pattern-dots-color-default: #444;
  --xy-node-background-color-default: #2d2d2d;
  --xy-node-border-color-default: #555;
  --xy-edge-stroke-default: #666;
  --xy-handle-background-color-default: #fff;
}
```
