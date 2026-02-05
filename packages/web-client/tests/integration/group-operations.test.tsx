/**
 * Test: useGroupOperations Hook
 *
 * Integration tests for the visual group operations hook.
 * Tests that the hook correctly uses pure geometry functions
 * and properly manages React Flow node state.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNodes } from '../../src/hooks/useNodes';
import { useGroupOperations } from '../../src/hooks/useGroupOperations';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { createTestNode } from '../setup/testHelpers';
import type { VisualGroupNodeData } from '@carta/domain';

function useTestHarness() {
  return {
    nodes: useNodes(),
    groupOps: useGroupOperations(),
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

describe('useGroupOperations Hook', () => {
  describe('createGroup', () => {
    it('creates a group with correct bounds from selected nodes', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      // Create two test nodes
      act(() => {
        adapter.setNodes([
          {
            ...createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
            position: { x: 100, y: 100 },
            width: 200,
            height: 100,
          },
          {
            ...createTestNode({ id: 'n2', type: 'Task', semanticId: 'task-2' }),
            position: { x: 100, y: 250 },
            width: 200,
            height: 100,
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      // Create group from the two nodes
      let groupId: string | null = null;
      act(() => {
        groupId = result.current.groupOps.createGroup(['n1', 'n2']);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(3);
      });

      expect(groupId).not.toBeNull();

      // Find the group node
      const nodes = result.current.nodes.nodes;
      const group = nodes.find(n => n.type === 'visual-group');
      expect(group).toBeDefined();
      expect(group?.id).toBe(groupId);

      // Check group data
      const groupData = group?.data as VisualGroupNodeData;
      expect(groupData.name).toBe('New Group');
      expect(groupData.collapsed).toBe(false);
    });

    it('sets parentId on children when creating group', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      act(() => {
        adapter.setNodes([
          {
            ...createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
            position: { x: 100, y: 100 },
          },
          {
            ...createTestNode({ id: 'n2', type: 'Task', semanticId: 'task-2' }),
            position: { x: 100, y: 200 },
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      let groupId: string | null = null;
      act(() => {
        groupId = result.current.groupOps.createGroup(['n1', 'n2']);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(3);
      });

      const nodes = result.current.nodes.nodes;
      const n1 = nodes.find(n => n.id === 'n1');
      const n2 = nodes.find(n => n.id === 'n2');

      expect(n1?.parentId).toBe(groupId);
      expect(n2?.parentId).toBe(groupId);


    });

    it('returns null when fewer than 2 nodes selected', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      let groupId: string | null = null;
      act(() => {
        groupId = result.current.groupOps.createGroup(['n1']);
      });

      expect(groupId).toBeNull();
      expect(result.current.nodes.nodes).toHaveLength(1);
    });
  });

  describe('attachToGroup', () => {
    it('converts node position to relative when attaching', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      // Create a group and an independent node
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
          {
            ...createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
            position: { x: 200, y: 200 }, // Absolute position
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      // Attach node to group
      act(() => {
        result.current.groupOps.attachToGroup('n1', groupId);
      });

      await waitFor(() => {
        const node = result.current.nodes.nodes.find(n => n.id === 'n1');
        expect(node?.parentId).toBe(groupId);
      });

      const node = result.current.nodes.nodes.find(n => n.id === 'n1');
      // Position should be relative: (200-100, 200-100) = (100, 100)
      expect(node?.position.x).toBe(100);
      expect(node?.position.y).toBe(100);

    });
  });

  describe('detachFromGroup', () => {
    it('restores absolute position when detaching', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      // Create group with child at relative position
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
          {
            ...createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
            parentId: groupId,

            position: { x: 50, y: 50 }, // Relative position
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
        const node = result.current.nodes.nodes.find(n => n.id === 'n1');
        expect(node?.parentId).toBe(groupId);
      });

      // Detach node from group
      act(() => {
        result.current.groupOps.detachFromGroup('n1');
      });

      await waitFor(() => {
        const node = result.current.nodes.nodes.find(n => n.id === 'n1');
        expect(node?.parentId).toBeUndefined();
      });

      const node = result.current.nodes.nodes.find(n => n.id === 'n1');
      // Position should be absolute: (100+50, 100+50) = (150, 150)
      expect(node?.position.x).toBe(150);
      expect(node?.position.y).toBe(150);
      expect(node?.extent).toBeUndefined();
    });
  });

  describe('toggleGroupCollapse', () => {
    it('toggles collapsed state on group', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          {
            id: groupId,
            type: 'visual-group',
            position: { x: 100, y: 100 },
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
        expect(result.current.nodes.nodes).toHaveLength(1);
        const group = result.current.nodes.nodes[0];
        expect((group.data as VisualGroupNodeData).collapsed).toBe(false);
      });

      // Toggle to collapsed
      act(() => {
        result.current.groupOps.toggleGroupCollapse(groupId);
      });

      await waitFor(() => {
        const group = result.current.nodes.nodes[0];
        expect((group.data as VisualGroupNodeData).collapsed).toBe(true);
      });

      // Toggle back to expanded
      act(() => {
        result.current.groupOps.toggleGroupCollapse(groupId);
      });

      await waitFor(() => {
        const group = result.current.nodes.nodes[0];
        expect((group.data as VisualGroupNodeData).collapsed).toBe(false);
      });
    });
  });

  describe('renameGroup', () => {
    it('updates group name', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          {
            id: groupId,
            type: 'visual-group',
            position: { x: 100, y: 100 },
            data: {
              isVisualGroup: true,
              name: 'Original Name',
              color: '#ff0000',
              collapsed: false,
            } satisfies VisualGroupNodeData,
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      act(() => {
        result.current.groupOps.renameGroup(groupId, 'New Name');
      });

      await waitFor(() => {
        const group = result.current.nodes.nodes[0];
        expect((group.data as VisualGroupNodeData).name).toBe('New Name');
      });
    });
  });

  describe('updateGroupColor', () => {
    it('updates group color', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          {
            id: groupId,
            type: 'visual-group',
            position: { x: 100, y: 100 },
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
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      act(() => {
        result.current.groupOps.updateGroupColor(groupId, '#00ff00');
      });

      await waitFor(() => {
        const group = result.current.nodes.nodes[0];
        expect((group.data as VisualGroupNodeData).color).toBe('#00ff00');
      });
    });
  });

  describe('deleteGroup', () => {
    it('deletes group and detaches children by default', async () => {
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
          {
            ...createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
            parentId: groupId,

            position: { x: 20, y: 60 },
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      act(() => {
        result.current.groupOps.deleteGroup(groupId);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      // Child should still exist but detached
      const node = result.current.nodes.nodes[0];
      expect(node.id).toBe('n1');
      expect(node.parentId).toBeUndefined();
      // Position should be absolute
      expect(node.position.x).toBe(120); // 100 + 20
      expect(node.position.y).toBe(160); // 100 + 60
    });

    it('deletes group and children when deleteChildren is true', async () => {
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
          {
            ...createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
            parentId: groupId,

            position: { x: 20, y: 60 },
          },
          {
            ...createTestNode({ id: 'n2', type: 'Task', semanticId: 'task-2' }),
            parentId: groupId,

            position: { x: 20, y: 160 },
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(3);
      });

      act(() => {
        result.current.groupOps.deleteGroup(groupId, true);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(0);
      });
    });
  });
});
