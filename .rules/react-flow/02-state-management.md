# React Flow: State Management

## Controlled vs Uncontrolled

### Uncontrolled Flow (Simple Use Cases)
Use `defaultNodes` and `defaultEdges` for static or simple flows:

```jsx
<ReactFlow
  defaultNodes={initialNodes}
  defaultEdges={initialEdges}
  defaultEdgeOptions={{ animated: true }}
/>
```

### Controlled Flow (Interactive Applications)
Use `nodes`, `edges`, and change handlers for full control:

```jsx
import { useState, useCallback } from 'react';
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge
} from '@xyflow/react';

function Flow() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
    />
  );
}
```

## External State Management (Zustand)

### Store Setup
```jsx
import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';

const useStore = create((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({ edges: addEdge(connection, get().edges) });
  },
}));
```

### Critical: Never Mutate Node/Edge Objects

```jsx
// WRONG - mutating existing object
updateNodeData: (nodeId, newData) => {
  const node = get().nodes.find(n => n.id === nodeId);
  node.data = newData; // MUTATION!
  set({ nodes: [...get().nodes] });
}

// CORRECT - create new object
updateNodeData: (nodeId, newData) => {
  set({
    nodes: get().nodes.map((node) => {
      if (node.id === nodeId) {
        return { ...node, data: { ...node.data, ...newData } };
      }
      return node;
    }),
  });
}
```

## Using updateNodeData Hook

```jsx
import { useReactFlow } from '@xyflow/react';

function MyNode({ id }) {
  const { updateNodeData } = useReactFlow();

  const onChange = (e) => {
    updateNodeData(id, { value: e.target.value });
  };

  return <input onChange={onChange} className="nodrag" />;
}
```

## ReactFlowProvider

Required when using hooks outside the ReactFlow component:

```jsx
// WRONG - hook in same component as provider
function Flow() {
  const instance = useReactFlow(); // ERROR!
  return (
    <ReactFlowProvider>
      <ReactFlow />
    </ReactFlowProvider>
  );
}

// CORRECT - provider wraps from parent
function FlowWithProvider() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}

function Flow() {
  const instance = useReactFlow(); // Works!
  return <ReactFlow />;
}
```

### When ReactFlowProvider is Required
- Using `useReactFlow`, `useNodes`, `useEdges`, `useStore` hooks
- Multiple flows on same page
- Client-side routing between flow pages
