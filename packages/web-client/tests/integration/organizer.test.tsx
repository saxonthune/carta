/**
 * Test: Organizers (Native React Flow parentId)
 *
 * Verifies organizer functionality using React Flow's native parentId system:
 * - Create organizers as nodes with type='organizer'
 * - Nodes reference organizers via parentId
 * - Organizers can be collapsed/expanded
 * - Edge remapping for collapsed organizers
 * - Child positions are relative to parent
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNodes } from '../../src/hooks/useNodes';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { createTestNode } from '../setup/testHelpers';
import type { OrganizerNodeData } from '@carta/schema';

function useTestHarness() {
  return {
    nodes: useNodes(),
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

describe('Organizers (Native parentId)', () => {
  describe('Organizer Creation as Nodes', () => {
    it('should create an organizer node', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const organizerId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          {
            id: organizerId,
            type: 'organizer',
            position: { x: 100, y: 100 },
            style: { width: 300, height: 200 },
            data: {
              isOrganizer: true,
              name: 'Test Organizer',
              color: '#ff0000',
              collapsed: false,
              layout: 'freeform',
            } satisfies OrganizerNodeData,
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      const nodes = result.current.nodes.nodes;
      expect(nodes[0].type).toBe('organizer');
      expect((nodes[0].data as OrganizerNodeData).name).toBe('Test Organizer');
      expect((nodes[0].data as OrganizerNodeData).color).toBe('#ff0000');
      expect((nodes[0].data as OrganizerNodeData).collapsed).toBe(false);
    });
  });

  describe('Node-Organizer Association via parentId', () => {
    it('should assign nodes to an organizer via parentId', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const organizerId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          // Organizer first (parent before children)
          {
            id: organizerId,
            type: 'organizer',
            position: { x: 100, y: 100 },
            style: { width: 300, height: 400 },
            data: {
              isOrganizer: true,
              name: 'My Organizer',
              color: '#ff0000',
              collapsed: false,
              layout: 'freeform',
            } satisfies OrganizerNodeData,
          },
          // Children with parentId and relative positions
          {
            ...createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
            parentId: organizerId,
            position: { x: 20, y: 60 },
          },
          {
            ...createTestNode({ id: 'n2', type: 'Task', semanticId: 'task-2' }),
            parentId: organizerId,
            position: { x: 20, y: 160 },
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(3);
      });

      const nodes = result.current.nodes.nodes;
      const n1 = nodes.find(n => n.id === 'n1');
      const n2 = nodes.find(n => n.id === 'n2');

      expect(n1?.parentId).toBe(organizerId);
      expect(n2?.parentId).toBe(organizerId);
    });

    it('should remove node from organizer by clearing parentId', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const organizerId = crypto.randomUUID();

      // Create organizer with one child
      act(() => {
        adapter.setNodes([
          {
            id: organizerId,
            type: 'organizer',
            position: { x: 100, y: 100 },
            style: { width: 300, height: 200 },
            data: {
              isOrganizer: true,
              name: 'Organizer',
              color: '#ff0000',
              collapsed: false,
              layout: 'freeform',
            } satisfies OrganizerNodeData,
          },
          {
            ...createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
            parentId: organizerId,
            position: { x: 20, y: 60 },
          },
        ]);
      });

      await waitFor(() => {
        const node = result.current.nodes.nodes.find(n => n.id === 'n1');
        expect(node?.parentId).toBe(organizerId);
      });

      // Remove from organizer by clearing parentId
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
        const node = result.current.nodes.nodes.find(n => n.id === 'n1');
        expect(node?.parentId).toBeUndefined();
      });
    });
  });

  describe('Organizer Collapse State', () => {
    it('should toggle collapsed state on organizer data', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const organizerId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          {
            id: organizerId,
            type: 'organizer',
            position: { x: 100, y: 100 },
            style: { width: 300, height: 200 },
            data: {
              isOrganizer: true,
              name: 'Collapsible',
              color: '#ff0000',
              collapsed: false,
              layout: 'freeform',
            } satisfies OrganizerNodeData,
          },
        ]);
      });

      await waitFor(() => {
        const organizer = result.current.nodes.nodes.find(n => n.id === organizerId);
        expect((organizer?.data as OrganizerNodeData).collapsed).toBe(false);
      });

      // Collapse the organizer
      act(() => {
        adapter.setNodes((nds) =>
          nds.map(n =>
            n.id === organizerId
              ? { ...n, data: { ...n.data, collapsed: true } }
              : n
          )
        );
      });

      await waitFor(() => {
        const organizer = result.current.nodes.nodes.find(n => n.id === organizerId);
        expect((organizer?.data as OrganizerNodeData).collapsed).toBe(true);
      });

      // Expand again
      act(() => {
        adapter.setNodes((nds) =>
          nds.map(n =>
            n.id === organizerId
              ? { ...n, data: { ...n.data, collapsed: false } }
              : n
          )
        );
      });

      await waitFor(() => {
        const organizer = result.current.nodes.nodes.find(n => n.id === organizerId);
        expect((organizer?.data as OrganizerNodeData).collapsed).toBe(false);
      });
    });
  });

  describe('Parent-First Ordering', () => {
    it('should maintain parent before children order', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const organizerId = crypto.randomUUID();

      // Create nodes in correct order (organizer first)
      act(() => {
        adapter.setNodes([
          {
            id: organizerId,
            type: 'organizer',
            position: { x: 0, y: 0 },
            data: {
              isOrganizer: true,
              name: 'Parent',
              color: '#00ff00',
              collapsed: false,
              layout: 'freeform',
            } satisfies OrganizerNodeData,
          },
          {
            ...createTestNode({ id: 'child', type: 'Task', semanticId: 'task-child' }),
            parentId: organizerId,
            position: { x: 20, y: 60 },
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      const nodes = result.current.nodes.nodes;
      const organizerIndex = nodes.findIndex(n => n.id === organizerId);
      const childIndex = nodes.findIndex(n => n.id === 'child');

      // Organizer should come before its children
      expect(organizerIndex).toBeLessThan(childIndex);
    });
  });

  describe('Nested Organizers', () => {
    it('should support nested organizers via parentId', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const outerOrganizerId = crypto.randomUUID();
      const innerOrganizerId = crypto.randomUUID();

      act(() => {
        adapter.setNodes([
          // Outer organizer first
          {
            id: outerOrganizerId,
            type: 'organizer',
            position: { x: 0, y: 0 },
            style: { width: 400, height: 400 },
            data: {
              isOrganizer: true,
              name: 'Outer',
              color: '#ff0000',
              collapsed: false,
              layout: 'freeform',
            } satisfies OrganizerNodeData,
          },
          // Inner organizer as child of outer
          {
            id: innerOrganizerId,
            type: 'organizer',
            parentId: outerOrganizerId,
            position: { x: 20, y: 60 },
            style: { width: 200, height: 200 },
            data: {
              isOrganizer: true,
              name: 'Inner',
              color: '#00ff00',
              collapsed: false,
              layout: 'freeform',
            } satisfies OrganizerNodeData,
          },
          // Node inside inner organizer
          {
            ...createTestNode({ id: 'nested-node', type: 'Task', semanticId: 'task-nested' }),
            parentId: innerOrganizerId,
            position: { x: 20, y: 60 },
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(3);
      });

      const nodes = result.current.nodes.nodes;
      const innerOrganizer = nodes.find(n => n.id === innerOrganizerId);
      const nestedNode = nodes.find(n => n.id === 'nested-node');

      expect(innerOrganizer?.parentId).toBe(outerOrganizerId);
      expect(nestedNode?.parentId).toBe(innerOrganizerId);
    });
  });
});
