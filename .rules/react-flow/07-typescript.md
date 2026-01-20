# React Flow: TypeScript

## Define Node Types

```tsx
import type { Node, NodeProps } from '@xyflow/react';

// Use 'type' NOT 'interface' for node data
type TextNodeData = { text: string };
type NumberNodeData = { value: number };

// Node type with data and type discriminator
type TextNode = Node<TextNodeData, 'text'>;
type NumberNode = Node<NumberNodeData, 'number'>;

// Union of all custom node types
type AppNode = TextNode | NumberNode;
```

## Why 'type' Not 'interface'

```tsx
// CORRECT - type works with generic constraints
type NodeData = { label: string };

// WRONG - interface may cause type inference issues
interface NodeData { label: string }  // Avoid for node/edge data
```

## Custom Node Component

```tsx
import type { NodeProps } from '@xyflow/react';

type CustomNodeData = { label: string; count: number };
type CustomNode = Node<CustomNodeData, 'custom'>;

function CustomNode({ data }: NodeProps<CustomNode>) {
  // data.label and data.count are fully typed
  return <div>{data.label}: {data.count}</div>;
}
```

## Custom Edge Types

```tsx
import type { Edge, EdgeProps } from '@xyflow/react';

type CustomEdgeData = { label: string };
type CustomEdge = Edge<CustomEdgeData, 'custom'>;

function CustomEdge({ data }: EdgeProps<CustomEdge>) {
  return <BaseEdge label={data?.label} path={...} />;
}
```

## Type-Safe Hooks

```tsx
import { useReactFlow, useStore } from '@xyflow/react';
import type { ReactFlowState } from '@xyflow/react';

// Typed useReactFlow
const { getNodes, getEdges } = useReactFlow<AppNode, AppEdge>();

// Typed useStore
const nodes = useStore((state: ReactFlowState<AppNode, AppEdge>) => state.nodes);
```

## Type Guards for Node Filtering

```tsx
type AppNode = TextNode | NumberNode;

function isTextNode(node: AppNode): node is TextNode {
  return node.type === 'text';
}

function isNumberNode(node: AppNode): node is NumberNode {
  return node.type === 'number';
}

// Usage
const textNodes = nodes.filter(isTextNode);
// textNodes is TextNode[]
```

## nodeTypes and edgeTypes Typing

```tsx
import type { NodeTypes, EdgeTypes } from '@xyflow/react';

const nodeTypes: NodeTypes = {
  text: TextNodeComponent,
  number: NumberNodeComponent,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdgeComponent,
};
```

## Typed onChange Handlers

```tsx
import type { OnNodesChange, OnEdgesChange, OnConnect } from '@xyflow/react';

const onNodesChange: OnNodesChange<AppNode> = useCallback(
  (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
  [],
);

const onEdgesChange: OnEdgesChange<AppEdge> = useCallback(
  (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
  [],
);

const onConnect: OnConnect = useCallback(
  (params) => setEdges((eds) => addEdge(params, eds)),
  [],
);
```

## Full Typed Example

```tsx
import { useState, useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';

type CustomNodeData = { label: string };
type CustomNode = Node<CustomNodeData, 'custom'>;
type CustomEdge = Edge<{ weight: number }, 'weighted'>;

const initialNodes: CustomNode[] = [
  { id: '1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Start' } },
];

const initialEdges: CustomEdge[] = [];

function Flow() {
  const [nodes, setNodes] = useState<CustomNode[]>(initialNodes);
  const [edges, setEdges] = useState<CustomEdge[]>(initialEdges);

  const onNodesChange: OnNodesChange<CustomNode> = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange: OnEdgesChange<CustomEdge> = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  return (
    <ReactFlow<CustomNode, CustomEdge>
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
    />
  );
}
```
