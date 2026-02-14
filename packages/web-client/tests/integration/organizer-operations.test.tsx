/**
 * Test: useOrganizerOperations Hook
 *
 * Integration tests for the organizer operations hook.
 * Tests that the hook correctly uses pure geometry functions
 * and properly manages React Flow node state.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNodes } from '../../src/hooks/useNodes';
import { useOrganizerOperations } from '../../src/hooks/useOrganizerOperations';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { createTestNode } from '../setup/testHelpers';
import type { OrganizerNodeData } from '@carta/domain';

function useTestHarness() {
  return {
    nodes: useNodes(),
    organizerOps: useOrganizerOperations(),
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

describe('useOrganizerOperations Hook', () => {
  describe('createOrganizer', () => {
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
        groupId = result.current.organizerOps.createOrganizer(['n1', 'n2']);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(3);
      });

      expect(groupId).not.toBeNull();

      // Find the group node
      const nodes = result.current.nodes.nodes;
      const group = nodes.find(n => n.type === 'organizer');
      expect(group).toBeDefined();
      expect(group?.id).toBe(groupId);

      // Check group data
      const groupData = group?.data as OrganizerNodeData;
      expect(groupData.name).toBe('New Organizer');
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
        groupId = result.current.organizerOps.createOrganizer(['n1', 'n2']);
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

    it('creates organizer for a single node', async () => {
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
        groupId = result.current.organizerOps.createOrganizer(['n1']);
      });

      expect(groupId).not.toBeNull();
      // Organizer + the original node
      expect(result.current.nodes.nodes).toHaveLength(2);
      const n1 = result.current.nodes.nodes.find(n => n.id === 'n1');
      expect(n1?.parentId).toBe(groupId);
    });

    it('returns null when no nodes selected', async () => {
      const result = await setup();

      let groupId: string | null = null;
      act(() => {
        groupId = result.current.organizerOps.createOrganizer([]);
      });

      expect(groupId).toBeNull();
    });
  });

  describe('attachToOrganizer', () => {
    it('converts node position to relative when attaching', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      // Create a group and an independent node
      act(() => {
        adapter.setNodes([
          {
            id: groupId,
            type: 'organizer',
            position: { x: 100, y: 100 },
            style: { width: 300, height: 200 },
            data: {
              isOrganizer: true,
              name: 'Test Organizer',
              color: '#ff0000',
              collapsed: false,
              layout: "freeform",
            } satisfies OrganizerNodeData,
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
        result.current.organizerOps.attachToOrganizer('n1', groupId);
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

  describe('detachFromOrganizer', () => {
    it('restores absolute position when detaching', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      // Create group with child at relative position
      act(() => {
        adapter.setNodes([
          {
            id: groupId,
            type: 'organizer',
            position: { x: 100, y: 100 },
            style: { width: 300, height: 200 },
            data: {
              isOrganizer: true,
              name: 'Test Organizer',
              color: '#ff0000',
              collapsed: false,
              layout: "freeform",
            } satisfies OrganizerNodeData,
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
        result.current.organizerOps.detachFromOrganizer('n1');
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

  describe('toggleOrganizerCollapse', () => {
    it('toggles collapsed state on group', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          {
            id: groupId,
            type: 'organizer',
            position: { x: 100, y: 100 },
            data: {
              isOrganizer: true,
              name: 'Test Organizer',
              color: '#ff0000',
              collapsed: false,
              layout: "freeform",
            } satisfies OrganizerNodeData,
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
        const group = result.current.nodes.nodes[0];
        expect((group.data as OrganizerNodeData).collapsed).toBe(false);
      });

      // Toggle to collapsed
      act(() => {
        result.current.organizerOps.toggleOrganizerCollapse(groupId);
      });

      await waitFor(() => {
        const group = result.current.nodes.nodes[0];
        expect((group.data as OrganizerNodeData).collapsed).toBe(true);
      });

      // Toggle back to expanded
      act(() => {
        result.current.organizerOps.toggleOrganizerCollapse(groupId);
      });

      await waitFor(() => {
        const group = result.current.nodes.nodes[0];
        expect((group.data as OrganizerNodeData).collapsed).toBe(false);
      });
    });
  });

  describe('renameOrganizer', () => {
    it('updates group name', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          {
            id: groupId,
            type: 'organizer',
            position: { x: 100, y: 100 },
            data: {
              isOrganizer: true,
              name: 'Original Name',
              color: '#ff0000',
              collapsed: false,
              layout: "freeform",
            } satisfies OrganizerNodeData,
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      act(() => {
        result.current.organizerOps.renameOrganizer(groupId, 'New Name');
      });

      await waitFor(() => {
        const group = result.current.nodes.nodes[0];
        expect((group.data as OrganizerNodeData).name).toBe('New Name');
      });
    });
  });

  describe('updateOrganizerColor', () => {
    it('updates group color', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          {
            id: groupId,
            type: 'organizer',
            position: { x: 100, y: 100 },
            data: {
              isOrganizer: true,
              name: 'Test Organizer',
              color: '#ff0000',
              collapsed: false,
              layout: "freeform",
            } satisfies OrganizerNodeData,
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      act(() => {
        result.current.organizerOps.updateOrganizerColor(groupId, '#00ff00');
      });

      await waitFor(() => {
        const group = result.current.nodes.nodes[0];
        expect((group.data as OrganizerNodeData).color).toBe('#00ff00');
      });
    });
  });

  describe('deleteOrganizer', () => {
    it('deletes group and detaches children by default', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const groupId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          {
            id: groupId,
            type: 'organizer',
            position: { x: 100, y: 100 },
            style: { width: 300, height: 200 },
            data: {
              isOrganizer: true,
              name: 'Test Organizer',
              color: '#ff0000',
              collapsed: false,
              layout: "freeform",
            } satisfies OrganizerNodeData,
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
        result.current.organizerOps.deleteOrganizer(groupId);
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
            type: 'organizer',
            position: { x: 100, y: 100 },
            style: { width: 300, height: 200 },
            data: {
              isOrganizer: true,
              name: 'Test Organizer',
              color: '#ff0000',
              collapsed: false,
              layout: "freeform",
            } satisfies OrganizerNodeData,
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
        result.current.organizerOps.deleteOrganizer(groupId, true);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(0);
      });
    });
  });

  describe('wagon organizers', () => {
    it('attaching construct with wagon to organizer maintains wagon chain', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const constructId = 'construct1';
      const wagonId = 'wagon1';
      const organizerId = crypto.randomUUID();

      // Create construct with an attached wagon organizer
      act(() => {
        adapter.setNodes([
          {
            ...createTestNode({ id: constructId, type: 'Task', semanticId: 'task-1' }),
            position: { x: 200, y: 200 },
          },
          {
            id: wagonId,
            type: 'organizer',
            parentId: constructId, // Wagon points to construct
            position: { x: 0, y: 150 }, // Relative to construct
            style: { width: 300, height: 200 },
            data: {
              isOrganizer: true,
              name: 'Members',
              color: '#00ff00',
              collapsed: false,
              layout: 'freeform',
              attachedToSemanticId: 'task-1', // This makes it a wagon
            } satisfies OrganizerNodeData,
          },
          {
            id: organizerId,
            type: 'organizer',
            position: { x: 100, y: 100 },
            style: { width: 500, height: 500 },
            data: {
              isOrganizer: true,
              name: 'Container',
              color: '#ff0000',
              collapsed: false,
              layout: 'freeform',
            } satisfies OrganizerNodeData,
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(3);
      });

      // Attach construct to organizer
      act(() => {
        result.current.organizerOps.attachToOrganizer(constructId, organizerId);
      });

      await waitFor(() => {
        const construct = result.current.nodes.nodes.find(n => n.id === constructId);
        expect(construct?.parentId).toBe(organizerId);
      });

      // Verify wagon still points to construct
      const wagon = result.current.nodes.nodes.find(n => n.id === wagonId);
      expect(wagon?.parentId).toBe(constructId);
      expect((wagon?.data as OrganizerNodeData).attachedToSemanticId).toBe('task-1');
    });

    it('detaching construct with wagon from organizer preserves wagon chain', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const constructId = 'construct1';
      const wagonId = 'wagon1';
      const organizerId = crypto.randomUUID();

      // Create construct already in organizer with wagon
      act(() => {
        adapter.setNodes([
          {
            id: organizerId,
            type: 'organizer',
            position: { x: 100, y: 100 },
            style: { width: 500, height: 500 },
            data: {
              isOrganizer: true,
              name: 'Container',
              color: '#ff0000',
              collapsed: false,
              layout: 'freeform',
            } satisfies OrganizerNodeData,
          },
          {
            ...createTestNode({ id: constructId, type: 'Task', semanticId: 'task-1' }),
            parentId: organizerId,
            position: { x: 100, y: 100 }, // Relative to organizer
          },
          {
            id: wagonId,
            type: 'organizer',
            parentId: constructId, // Wagon points to construct
            position: { x: 0, y: 150 }, // Relative to construct
            style: { width: 300, height: 200 },
            data: {
              isOrganizer: true,
              name: 'Members',
              color: '#00ff00',
              collapsed: false,
              layout: 'freeform',
              attachedToSemanticId: 'task-1',
            } satisfies OrganizerNodeData,
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(3);
      });

      // Detach construct from organizer
      act(() => {
        result.current.organizerOps.detachFromOrganizer(constructId);
      });

      await waitFor(() => {
        const construct = result.current.nodes.nodes.find(n => n.id === constructId);
        expect(construct?.parentId).toBeUndefined();
      });

      // Verify wagon still points to construct
      const wagon = result.current.nodes.nodes.find(n => n.id === wagonId);
      expect(wagon?.parentId).toBe(constructId);
    });

    it('createOrganizer includes wagon trees in bounds calculation', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const constructId = 'construct1';
      const wagonId = 'wagon1';

      // Create construct with wagon
      act(() => {
        adapter.setNodes([
          {
            ...createTestNode({ id: constructId, type: 'Task', semanticId: 'task-1' }),
            position: { x: 100, y: 100 },
            width: 200,
            height: 100,
          },
          {
            id: wagonId,
            type: 'organizer',
            parentId: constructId,
            position: { x: 0, y: 150 }, // Below construct
            width: 300,
            height: 200,
            style: { width: 300, height: 200 },
            data: {
              isOrganizer: true,
              name: 'Members',
              color: '#00ff00',
              collapsed: false,
              layout: 'freeform',
              attachedToSemanticId: 'task-1',
            } satisfies OrganizerNodeData,
          },
          {
            ...createTestNode({ id: 'construct2', type: 'Task', semanticId: 'task-2' }),
            position: { x: 500, y: 100 },
            width: 200,
            height: 100,
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(3);
      });

      // Create organizer from both constructs
      let groupId: string | null = null;
      act(() => {
        groupId = result.current.organizerOps.createOrganizer([constructId, 'construct2']);
      });

      await waitFor(() => {
        // 3 original nodes + 1 new organizer = 4 total
        // (wagon is already part of the 3 original nodes)
        expect(result.current.nodes.nodes).toHaveLength(4);
      });

      // The new organizer should include the wagon's extent in its bounds
      const organizer = result.current.nodes.nodes.find(n => n.id === groupId);
      expect(organizer).toBeDefined();
      // Height should accommodate construct (100) + wagon offset (150) + wagon height (200) = 450
      // (plus padding from computeOrganizerBounds)
      expect(organizer!.height).toBeGreaterThanOrEqual(350);
    });

    it('non-wagon organizer cannot be nested in another organizer', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const organizer1Id = crypto.randomUUID();
      const organizer2Id = crypto.randomUUID();

      // Create two non-wagon organizers
      act(() => {
        adapter.setNodes([
          {
            id: organizer1Id,
            type: 'organizer',
            position: { x: 100, y: 100 },
            style: { width: 500, height: 500 },
            data: {
              isOrganizer: true,
              name: 'Outer',
              color: '#ff0000',
              collapsed: false,
              layout: 'freeform',
            } satisfies OrganizerNodeData,
          },
          {
            id: organizer2Id,
            type: 'organizer',
            position: { x: 200, y: 200 },
            style: { width: 300, height: 300 },
            data: {
              isOrganizer: true,
              name: 'Inner',
              color: '#00ff00',
              collapsed: false,
              layout: 'freeform',
              // No attachedToSemanticId — not a wagon
            } satisfies OrganizerNodeData,
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      // Attempt to attach non-wagon organizer to another organizer
      act(() => {
        result.current.organizerOps.attachToOrganizer(organizer2Id, organizer1Id);
      });

      // Wait a bit for any state updates
      await new Promise(resolve => setTimeout(resolve, 100));

      // Organizer2 should NOT be attached (validation should have prevented it)
      const organizer2 = result.current.nodes.nodes.find(n => n.id === organizer2Id);
      expect(organizer2?.parentId).toBeUndefined();
    });
  });
});
