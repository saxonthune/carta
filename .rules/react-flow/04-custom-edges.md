# React Flow: Custom Edges

## Basic Custom Edge

```jsx
import { BaseEdge, getStraightPath } from '@xyflow/react';

function CustomEdge({ id, sourceX, sourceY, targetX, targetY }) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return <BaseEdge id={id} path={edgePath} />;
}

// Define outside component (same rule as nodeTypes)
const edgeTypes = { custom: CustomEdge };
```

## Edge Path Helpers

```jsx
import {
  getStraightPath,
  getSmoothStepPath,
  getBezierPath,
  getSimpleBezierPath,
} from '@xyflow/react';

// All return [path, labelX, labelY, offsetX, offsetY]
const [edgePath, labelX, labelY] = getBezierPath({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
});
```

## Edge with Interactive Label

```jsx
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';

function ButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      <EdgeLabelRenderer>
        <button
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all', // Required for interaction!
          }}
          className="nodrag nopan" // Prevent drag/pan interference
          onClick={() => console.log('clicked')}
        >
          Delete
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
```

## Critical: EdgeLabelRenderer Rules

1. **Position manually** - labels are not auto-positioned
2. **Add `pointerEvents: 'all'`** - default is `none`, blocking interaction
3. **Use `nodrag nopan` classes** - prevent canvas interaction when clicking

## Define edgeTypes Outside Component

```jsx
// CORRECT
const edgeTypes = { button: ButtonEdge };

function Flow() {
  return <ReactFlow edgeTypes={edgeTypes} />;
}

// WRONG - same issue as nodeTypes
function Flow() {
  const edgeTypes = { button: ButtonEdge }; // BAD!
  return <ReactFlow edgeTypes={edgeTypes} />;
}
```

## Edge Props Reference

```jsx
function CustomEdge({
  id,              // Edge id
  source,          // Source node id
  target,          // Target node id
  sourceX,         // Source handle X
  sourceY,         // Source handle Y
  targetX,         // Target handle X
  targetY,         // Target handle Y
  sourcePosition,  // Position enum (Top, Bottom, Left, Right)
  targetPosition,  // Position enum
  data,            // Custom data object
  selected,        // Is edge selected
  animated,        // Has animation
  style,           // Custom styles
  markerEnd,       // End marker
  markerStart,     // Start marker
}) {
  // ...
}
```

## TypeScript: Custom Edge Types

```tsx
import type { Edge, EdgeProps } from '@xyflow/react';

type CustomEdgeData = { label: string };
type CustomEdge = Edge<CustomEdgeData, 'custom'>;

function CustomEdge({ data }: EdgeProps<CustomEdge>) {
  return <BaseEdge path={...} label={data?.label} />;
}
```
