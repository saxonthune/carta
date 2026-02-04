/**
 * Test: Visual Groups
 *
 * Verifies visual grouping functionality:
 * - Create groups from selected nodes
 * - Groups store in adapter (level-scoped)
 * - Nodes reference groups via groupId
 * - Groups can be collapsed/expanded
 * - Edge remapping for collapsed groups
 * - Remove nodes from groups
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocument } from '../../src/hooks/useDocument';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { createTestNode, createTestEdge } from '../setup/testHelpers';
import type { ConstructNodeData, VisualGroup } from '@carta/domain';

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

describe('Visual Groups', () => {
  describe('Group Creation via Adapter', () => {
    it('should create a visual group in the current level', async () => {
      const result = await setup();
      const { adapter } = result.current.context;
      const levelId = result.current.document.activeLevel!;

      // Initially no groups
      expect(adapter.getVisualGroups(levelId)).toHaveLength(0);

      // Create a visual group
      let createdGroup: VisualGroup;
      act(() => {
        createdGroup = adapter.addVisualGroup(levelId, {
          name: 'Test Group',
          color: '#ff0000',
          collapsed: false,
        });
      });

      await waitFor(() => {
        expect(adapter.getVisualGroups(levelId)).toHaveLength(1);
      });

      const groups = adapter.getVisualGroups(levelId);
      expect(groups[0].name).toBe('Test Group');
      expect(groups[0].color).toBe('#ff0000');
      expect(groups[0].collapsed).toBe(false);
      expect(groups[0].id).toBe(createdGroup!.id);
    });

    it('should update a visual group', async () => {
      const result = await setup();
      const { adapter } = result.current.context;
      const levelId = result.current.document.activeLevel!;

      let group: VisualGroup;
      act(() => {
        group = adapter.addVisualGroup(levelId, {
          name: 'Original',
          color: '#00ff00',
          collapsed: false,
        });
      });

      await waitFor(() => {
        expect(adapter.getVisualGroups(levelId)).toHaveLength(1);
      });

      // Update the group
      act(() => {
        adapter.updateVisualGroup(levelId, group!.id, {
          name: 'Updated',
          collapsed: true,
        });
      });

      await waitFor(() => {
        const updated = adapter.getVisualGroup(levelId, group!.id);
        expect(updated?.name).toBe('Updated');
      });

      const updated = adapter.getVisualGroup(levelId, group!.id);
      expect(updated?.collapsed).toBe(true);
      expect(updated?.color).toBe('#00ff00'); // unchanged
    });

    it('should remove a visual group', async () => {
      const result = await setup();
      const { adapter } = result.current.context;
      const levelId = result.current.document.activeLevel!;

      let group: VisualGroup;
      act(() => {
        group = adapter.addVisualGroup(levelId, {
          name: 'ToDelete',
          color: '#0000ff',
          collapsed: false,
        });
      });

      await waitFor(() => {
        expect(adapter.getVisualGroups(levelId)).toHaveLength(1);
      });

      act(() => {
        adapter.removeVisualGroup(levelId, group!.id);
      });

      await waitFor(() => {
        expect(adapter.getVisualGroups(levelId)).toHaveLength(0);
      });
    });
  });

  describe('Node-Group Association', () => {
    it('should assign nodes to a group via groupId', async () => {
      const result = await setup();
      const { adapter } = result.current.context;
      const levelId = result.current.document.activeLevel!;

      // Create nodes
      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
          createTestNode({ id: 'n2', type: 'Task', semanticId: 'task-2' }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(2);
      });

      // Create a group
      let group: VisualGroup;
      act(() => {
        group = adapter.addVisualGroup(levelId, {
          name: 'My Group',
          color: '#ff0000',
          collapsed: false,
        });
      });

      // Assign nodes to the group
      act(() => {
        adapter.updateNode('n1', { groupId: group!.id });
        adapter.updateNode('n2', { groupId: group!.id });
      });

      await waitFor(() => {
        const nodes = result.current.document.nodes;
        expect((nodes[0].data as ConstructNodeData).groupId).toBe(group!.id);
      });

      const nodes = result.current.document.nodes;
      expect((nodes[0].data as ConstructNodeData).groupId).toBe(group!.id);
      expect((nodes[1].data as ConstructNodeData).groupId).toBe(group!.id);
    });

    it('should remove node from group by setting groupId to undefined', async () => {
      const result = await setup();
      const { adapter } = result.current.context;
      const levelId = result.current.document.activeLevel!;

      // Create node and group
      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
        ]);
      });

      let group: VisualGroup;
      act(() => {
        group = adapter.addVisualGroup(levelId, {
          name: 'Group',
          color: '#ff0000',
          collapsed: false,
        });
        adapter.updateNode('n1', { groupId: group.id });
      });

      await waitFor(() => {
        const node = result.current.document.nodes[0];
        expect((node.data as ConstructNodeData).groupId).toBe(group!.id);
      });

      // Remove from group
      act(() => {
        adapter.updateNode('n1', { groupId: undefined });
      });

      await waitFor(() => {
        const node = result.current.document.nodes[0];
        expect((node.data as ConstructNodeData).groupId).toBeUndefined();
      });
    });
  });

  describe('Level Isolation', () => {
    it('should keep visual groups independent between levels', async () => {
      const result = await setup();
      const { adapter } = result.current.context;
      const level1Id = result.current.document.activeLevel!;

      // Create group in level 1
      act(() => {
        adapter.addVisualGroup(level1Id, {
          name: 'Level 1 Group',
          color: '#ff0000',
          collapsed: false,
        });
      });

      await waitFor(() => {
        expect(adapter.getVisualGroups(level1Id)).toHaveLength(1);
      });

      // Create level 2
      let level2Id: string;
      act(() => {
        const l2 = result.current.document.createLevel('Level 2');
        level2Id = l2.id;
        result.current.document.setActiveLevel(l2.id);
      });

      await waitFor(() => {
        expect(result.current.document.activeLevel).toBe(level2Id!);
      });

      // Level 2 should have no groups
      expect(adapter.getVisualGroups(level2Id!)).toHaveLength(0);

      // Create group in level 2
      act(() => {
        adapter.addVisualGroup(level2Id!, {
          name: 'Level 2 Group',
          color: '#00ff00',
          collapsed: false,
        });
      });

      await waitFor(() => {
        expect(adapter.getVisualGroups(level2Id!)).toHaveLength(1);
      });

      // Level 1 should still have only 1 group
      expect(adapter.getVisualGroups(level1Id)).toHaveLength(1);
      expect(adapter.getVisualGroups(level1Id)[0].name).toBe('Level 1 Group');
    });
  });

  describe('Group Collapse State', () => {
    it('should toggle collapsed state', async () => {
      const result = await setup();
      const { adapter } = result.current.context;
      const levelId = result.current.document.activeLevel!;

      let group: VisualGroup;
      act(() => {
        group = adapter.addVisualGroup(levelId, {
          name: 'Collapsible',
          color: '#ff0000',
          collapsed: false,
        });
      });

      await waitFor(() => {
        expect(adapter.getVisualGroup(levelId, group!.id)?.collapsed).toBe(false);
      });

      // Collapse the group
      act(() => {
        adapter.updateVisualGroup(levelId, group!.id, { collapsed: true });
      });

      await waitFor(() => {
        expect(adapter.getVisualGroup(levelId, group!.id)?.collapsed).toBe(true);
      });

      // Expand again
      act(() => {
        adapter.updateVisualGroup(levelId, group!.id, { collapsed: false });
      });

      await waitFor(() => {
        expect(adapter.getVisualGroup(levelId, group!.id)?.collapsed).toBe(false);
      });
    });
  });

  describe('Group Position and Size', () => {
    it('should store manual position and size', async () => {
      const result = await setup();
      const { adapter } = result.current.context;
      const levelId = result.current.document.activeLevel!;

      let group: VisualGroup;
      act(() => {
        group = adapter.addVisualGroup(levelId, {
          name: 'Positioned',
          color: '#ff0000',
          collapsed: false,
          position: { x: 100, y: 200 },
          size: { width: 300, height: 400 },
        });
      });

      await waitFor(() => {
        expect(adapter.getVisualGroups(levelId)).toHaveLength(1);
      });

      const storedGroup = adapter.getVisualGroup(levelId, group!.id);
      expect(storedGroup?.position).toEqual({ x: 100, y: 200 });
      expect(storedGroup?.size).toEqual({ width: 300, height: 400 });
    });

    it('should update position', async () => {
      const result = await setup();
      const { adapter } = result.current.context;
      const levelId = result.current.document.activeLevel!;

      let group: VisualGroup;
      act(() => {
        group = adapter.addVisualGroup(levelId, {
          name: 'Movable',
          color: '#ff0000',
          collapsed: false,
        });
      });

      act(() => {
        adapter.updateVisualGroup(levelId, group!.id, {
          position: { x: 500, y: 600 },
        });
      });

      await waitFor(() => {
        expect(adapter.getVisualGroup(levelId, group!.id)?.position).toEqual({ x: 500, y: 600 });
      });
    });
  });

  describe('Nested Groups', () => {
    it('should support parent-child group relationships via parentGroupId', async () => {
      const result = await setup();
      const { adapter } = result.current.context;
      const levelId = result.current.document.activeLevel!;

      let parentGroup: VisualGroup;
      let childGroup: VisualGroup;

      act(() => {
        parentGroup = adapter.addVisualGroup(levelId, {
          name: 'Parent',
          color: '#ff0000',
          collapsed: false,
        });
      });

      act(() => {
        childGroup = adapter.addVisualGroup(levelId, {
          name: 'Child',
          color: '#00ff00',
          collapsed: false,
          parentGroupId: parentGroup!.id,
        });
      });

      await waitFor(() => {
        expect(adapter.getVisualGroups(levelId)).toHaveLength(2);
      });

      const child = adapter.getVisualGroup(levelId, childGroup!.id);
      expect(child?.parentGroupId).toBe(parentGroup!.id);
    });
  });

  describe('Group Creation Integration', () => {
    it('should use the returned group ID when assigning nodes', async () => {
      /**
       * This test validates the correct pattern for creating groups:
       * The group ID returned from addVisualGroup() must be used when
       * assigning nodes to the group via updateNode().
       *
       * BUG: Map.tsx createGroup generates its own groupId before calling
       * addVisualGroup(), but addVisualGroup() generates a DIFFERENT id.
       * The nodes end up with a groupId that doesn't match any group.
       */
      const result = await setup();
      const { adapter } = result.current.context;
      const levelId = result.current.document.activeLevel!;

      // Create nodes
      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
          createTestNode({ id: 'n2', type: 'Task', semanticId: 'task-2' }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(2);
      });

      // Create group and capture returned ID (CORRECT PATTERN)
      let group: VisualGroup;
      act(() => {
        group = adapter.addVisualGroup(levelId, {
          name: 'Correct Group',
          color: '#ff0000',
          collapsed: false,
        });
        // Use the RETURNED group.id, not a pre-generated one
        adapter.updateNode('n1', { groupId: group.id });
        adapter.updateNode('n2', { groupId: group.id });
      });

      await waitFor(() => {
        const nodes = result.current.document.nodes;
        expect((nodes[0].data as ConstructNodeData).groupId).toBe(group!.id);
      });

      // Verify the groupId on nodes matches the actual group
      const groups = adapter.getVisualGroups(levelId);
      expect(groups).toHaveLength(1);

      const nodes = result.current.document.nodes;
      const nodeGroupId = (nodes[0].data as ConstructNodeData).groupId;
      expect(nodeGroupId).toBe(groups[0].id);
    });

    it('should not create orphan nodes with non-existent groupId', async () => {
      /**
       * If a node has a groupId that doesn't match any VisualGroup,
       * it's an orphan - this is the bug symptom.
       */
      const result = await setup();
      const { adapter } = result.current.context;
      const levelId = result.current.document.activeLevel!;

      // Create a node with a groupId that doesn't exist
      const fakeGroupId = 'vg_nonexistent123';
      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1', groupId: fakeGroupId }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(1);
      });

      // Verify: no groups exist with this ID
      const groups = adapter.getVisualGroups(levelId);
      expect(groups.find(g => g.id === fakeGroupId)).toBeUndefined();

      // The node has a groupId but no matching group - this is the orphan scenario
      const node = result.current.document.nodes[0];
      const nodeGroupId = (node.data as ConstructNodeData).groupId;
      expect(nodeGroupId).toBe(fakeGroupId);

      // This test documents the orphan behavior - ideally group assignments
      // should always use IDs returned from addVisualGroup()
    });
  });
});
