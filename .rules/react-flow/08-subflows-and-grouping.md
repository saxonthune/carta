# React Flow: Sub-flows and Grouping

## Parent-Child Node Relationships

### Critical: Parent Must Come Before Children

```jsx
// CORRECT - parent defined first
const nodes = [
  {
    id: 'group-1',
    type: 'group',
    position: { x: 0, y: 0 },
    style: { width: 300, height: 200 },
  },
  {
    id: 'child-1',
    parentId: 'group-1',  // Reference parent
    position: { x: 20, y: 30 },  // Relative to parent!
    data: { label: 'Child Node' },
  },
];

// WRONG - child before parent causes errors
const nodes = [
  { id: 'child-1', parentId: 'group-1', ... },  // Error!
  { id: 'group-1', type: 'group', ... },
];
```

## Child Position is Relative

```jsx
// Child position { x: 20, y: 30 } means:
// - 20px from parent's left edge
// - 30px from parent's top edge

const nodes = [
  {
    id: 'parent',
    type: 'group',
    position: { x: 100, y: 100 },  // Parent at (100, 100)
    style: { width: 200, height: 150 },
  },
  {
    id: 'child',
    parentId: 'parent',
    position: { x: 10, y: 10 },  // Absolute position: (110, 110)
    data: { label: 'Child' },
  },
];
```

## Constrain Children Within Parent

```jsx
const childNode = {
  id: 'child',
  parentId: 'parent',
  extent: 'parent',  // Cannot drag outside parent bounds
  position: { x: 10, y: 10 },
  data: { label: 'Constrained Child' },
};
```

## Use 'parentId' Not 'parentNode'

```jsx
// CORRECT (v12+)
{ id: 'child', parentId: 'group-1', ... }

// DEPRECATED (v11 and earlier)
{ id: 'child', parentNode: 'group-1', ... }  // Still works but deprecated
```

## Group Node Type

The built-in `group` type has no handles:

```jsx
const groupNode = {
  id: 'group',
  type: 'group',
  position: { x: 0, y: 0 },
  style: {
    width: 300,
    height: 200,
    backgroundColor: 'rgba(240, 240, 240, 0.5)',
  },
};
```

## Custom Parent Node

For parent nodes with handles:

```jsx
function ParentNode({ data }) {
  return (
    <div style={{ padding: 10, minWidth: 200, minHeight: 100 }}>
      <Handle type="target" position={Position.Top} />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { parent: ParentNode };
```

## Nested Sub-flows

```jsx
const nodes = [
  // Level 1
  { id: 'outer', type: 'group', position: { x: 0, y: 0 }, style: { width: 400, height: 300 } },

  // Level 2
  { id: 'inner', type: 'group', parentId: 'outer', position: { x: 20, y: 20 }, style: { width: 200, height: 150 } },

  // Level 3
  { id: 'deep-child', parentId: 'inner', position: { x: 10, y: 10 }, data: { label: 'Deep' } },
];
```

## Expand/Collapse Groups

```jsx
function ExpandableGroup({ id, data }) {
  const { setNodes } = useReactFlow();

  const toggleChildren = () => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.parentId === id) {
          return { ...node, hidden: !node.hidden };
        }
        return node;
      })
    );
  };

  return (
    <div>
      <button onClick={toggleChildren} className="nodrag">
        Toggle Children
      </button>
    </div>
  );
}
```

## Important Considerations

1. **Deleting parent** - children remain but become orphaned
2. **Moving parent** - children move with it automatically
3. **Layouting libraries** - Dagre has issues with sub-flows connected to external nodes; use ELK for complex cases
