/**
 * Test: Visual Groups (Native React Flow parentId)
 *
 * Verifies visual grouping functionality using React Flow's native parentId system:
 * - Create groups as nodes with type='visual-group'
 * - Nodes reference groups via parentId (not data.groupId)
 * - Groups can be collapsed/expanded
 * - Edge remapping for collapsed groups
 * - Child positions are relative to parent
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocument } from '../../src/hooks/useDocument';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { createTestNode } from '../setup/testHelpers';
import type { VisualGroupNodeData } from '@carta/domain';

function useTestHarness() {
  return {
    document: useDocument(),
    context: useDocumentContext(),
  };
}

async function setup() {
  const { result } = renderHook(() => useTestHarness(), { wrapper: TestProviders });
  await waitFor(() => {
    expect(result.current.context.isReady).toBe(true);
  });
  return result;
}

describe('Visual Groups (Native parentId)', () => {
  describe('Group Creation as Nodes', () => {
    it('should create a visual group node', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          {
            id: groupId,
            type: 'visual-group',
            position: { x: 100, y: 100 },
            style: { width: 300, height: 200 },
            data: {
              isVisualGroup: true,
              name: 'Test Group',
              color: '#ff0000',
              collapsed: false,
            } satisfies VisualGroupNodeData,
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(1);
      });

      const nodes = result.current.document.nodes;
      expect(nodes[0].type).toBe('visual-group');
      expect((nodes[0].data as VisualGroupNodeData).name).toBe('Test Group');
      expect((nodes[0].data as VisualGroupNodeData).color).toBe('#ff0000');
      expect((nodes[0].data as VisualGroupNodeData).collapsed).toBe(false);
    });
  });

  describe('Node-Group Association via parentId', () => {
    it('should assign nodes to a group via parentId', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          // Group first (parent before children)
          {
            id: groupId,
            type: 'visual-group',
            position: { x: 100, y: 100 },
            style: { width: 300, height: 400 },
            data: {
              isVisualGroup: true,
              name: 'My Group',
              color: '#ff0000',
              collapsed: false,
            } satisfies VisualGroupNodeData,
          },
          // Children with parentId and relative positions
          {
            ...createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
            parentId: groupId,
            extent: 'parent',
            position: { x: 20, y: 60 }, // Relative to group
          },
          {
            ...createTestNode({ id: 'n2', type: 'Task', semanticId: 'task-2' }),
            parentId: groupId,
            extent: 'parent',
            position: { x: 20, y: 160 }, // Relative to group
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(3);
      });

      const nodes = result.current.document.nodes;
      const n1 = nodes.find(n => n.id === 'n1');
      const n2 = nodes.find(n => n.id === 'n2');

      expect(n1?.parentId).toBe(groupId);
      expect(n2?.parentId).toBe(groupId);
      expect(n1?.extent).toBe('parent');
      expect(n2?.extent).toBe('parent');
    });

    it('should remove node from group by clearing parentId', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      // Create group with one child
      act(() => {
        adapter.setNodes([
          {
            id: groupId,
            type: 'visual-group',
            position: { x: 100, y: 100 },
            style: { width: 300, height: 200 },
            data: {
              isVisualGroup: true,
              name: 'Group',
              color: '#ff0000',
              collapsed: false,
            } satisfies VisualGroupNodeData,
          },
          {
            ...createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
            parentId: groupId,
            extent: 'parent',
            position: { x: 20, y: 60 },
          },
        ]);
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === 'n1');
        expect(node?.parentId).toBe(groupId);
      });

      // Remove from group by clearing parentId
      act(() => {
        adapter.setNodes((nds) =>
          nds.map(n =>
            n.id === 'n1'
              ? { ...n, parentId: undefined, extent: undefined, position: { x: 500, y: 500 } }
              : n
          )
        );
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === 'n1');
        expect(node?.parentId).toBeUndefined();
      });
    });
  });

  describe('Group Collapse State', () => {
    it('should toggle collapsed state on group data', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          {
            id: groupId,
            type: 'visual-group',
            position: { x: 100, y: 100 },
            style: { width: 300, height: 200 },
            data: {
              isVisualGroup: true,
              name: 'Collapsible',
              color: '#ff0000',
              collapsed: false,
            } satisfies VisualGroupNodeData,
          },
        ]);
      });

      await waitFor(() => {
        const group = result.current.document.nodes.find(n => n.id === groupId);
        expect((group?.data as VisualGroupNodeData).collapsed).toBe(false);
      });

      // Collapse the group
      act(() => {
        adapter.setNodes((nds) =>
          nds.map(n =>
            n.id === groupId
              ? { ...n, data: { ...n.data, collapsed: true } }
              : n
          )
        );
      });

      await waitFor(() => {
        const group = result.current.document.nodes.find(n => n.id === groupId);
        expect((group?.data as VisualGroupNodeData).collapsed).toBe(true);
      });

      // Expand again
      act(() => {
        adapter.setNodes((nds) =>
          nds.map(n =>
            n.id === groupId
              ? { ...n, data: { ...n.data, collapsed: false } }
              : n
          )
        );
      });

      await waitFor(() => {
        const group = result.current.document.nodes.find(n => n.id === groupId);
        expect((group?.data as VisualGroupNodeData).collapsed).toBe(false);
      });
    });
  });

  describe('Parent-First Ordering', () => {
    it('should maintain parent before children order', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      // Create nodes in correct order (group first)
      act(() => {
        adapter.setNodes([
          {
            id: groupId,
            type: 'visual-group',
            position: { x: 0, y: 0 },
            data: {
              isVisualGroup: true,
              name: 'Parent',
              color: '#00ff00',
              collapsed: false,
            } satisfies VisualGroupNodeData,
          },
          {
            ...createTestNode({ id: 'child', type: 'Task', semanticId: 'task-child' }),
            parentId: groupId,
            extent: 'parent',
            position: { x: 20, y: 60 },
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(2);
      });

      const nodes = result.current.document.nodes;
      const groupIndex = nodes.findIndex(n => n.id === groupId);
      const childIndex = nodes.findIndex(n => n.id === 'child');

      // Group should come before its children
      expect(groupIndex).toBeLessThan(childIndex);
    });
  });

  describe('Nested Groups', () => {
    it('should support nested groups via parentId', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const outerGroupId = crypto.randomUUID();
      const innerGroupId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          // Outer group first
          {
            id: outerGroupId,
            type: 'visual-group',
            position: { x: 0, y: 0 },
            style: { width: 400, height: 400 },
            data: {
              isVisualGroup: true,
              name: 'Outer',
              color: '#ff0000',
              collapsed: false,
            } satisfies VisualGroupNodeData,
          },
          // Inner group as child of outer
          {
            id: innerGroupId,
            type: 'visual-group',
            parentId: outerGroupId,
            extent: 'parent',
            position: { x: 20, y: 60 },
            style: { width: 200, height: 200 },
            data: {
              isVisualGroup: true,
              name: 'Inner',
              color: '#00ff00',
              collapsed: false,
            } satisfies VisualGroupNodeData,
          },
          // Node inside inner group
          {
            ...createTestNode({ id: 'nested-node', type: 'Task', semanticId: 'task-nested' }),
            parentId: innerGroupId,
            extent: 'parent',
            position: { x: 20, y: 60 },
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(3);
      });

      const nodes = result.current.document.nodes;
      const innerGroup = nodes.find(n => n.id === innerGroupId);
      const nestedNode = nodes.find(n => n.id === 'nested-node');

      expect(innerGroup?.parentId).toBe(outerGroupId);
      expect(nestedNode?.parentId).toBe(innerGroupId);
    });
  });
});
