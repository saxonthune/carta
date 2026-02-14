/**
 * Test: Menu -> Clear -> Clear Everything
 *
 * Verifies that "Clear Everything" removes all document content
 * (nodes, edges, schemas) while preserving the title.
 *
 * This is an integration test that exercises:
 * - Document adapter (Yjs)
 * - useDocument hook
 * - Clear functionality from App.tsx
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNodes } from '../../src/hooks/useNodes';
import { useEdges } from '../../src/hooks/useEdges';
import { useSchemas } from '../../src/hooks/useSchemas';
import { useDocumentMeta } from '../../src/hooks/useDocumentMeta';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { createTestNode, createTestEdge } from '../setup/testHelpers';

describe('Clear Document', () => {
  describe('Clear Everything', () => {
    it('should clear nodes, edges, and schemas but preserve title', async () => {
      // Arrange: Set up a document with content
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      // Wait for adapter to initialize
      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Set initial state with content
      act(() => {
        // Set a title
        adapter.setTitle('My Test Project');

        // Add nodes
        const nodes = [
          createTestNode({ id: '1', type: 'Task', semanticId: 'task-1' }),
          createTestNode({ id: '2', type: 'Service', semanticId: 'service-1' }),
        ];
        adapter.setNodes(nodes);

        // Add edges
        const edges = [createTestEdge({ source: '1', target: '2' })];
        adapter.setEdges(edges);

        // Add a custom schema
        adapter.addSchema({
          type: 'CustomType',
          fields: [{ name: 'name', type: 'string', displayTier: 'marker' }],
          ports: [],
        });
      });

      // Verify content exists before clear
      await waitFor(() => {
        expect(result.current.nodes.nodes.length).toBeGreaterThan(0);
      });

      expect(result.current.nodes.nodes).toHaveLength(2);
      expect(result.current.edges.edges).toHaveLength(1);
      expect(result.current.meta.title).toBe('My Test Project');

      // Act: Clear everything (simulating what handleClear('all') does)
      act(() => {
        adapter.transaction(() => {
          adapter.setNodes([]);
          adapter.setEdges([]);
          adapter.setSchemas([]);
          adapter.setPortSchemas([]);
          // Note: Title is NOT cleared - this is the expected behavior
        });
      });

      // Assert: Document content is cleared
      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(0);
      });

      expect(result.current.nodes.nodes).toHaveLength(0);
      expect(result.current.edges.edges).toHaveLength(0);
      expect(result.current.schemas.schemas).toHaveLength(0);

      // Assert: Title is preserved (the key requirement)
      expect(result.current.meta.title).toBe('My Test Project');
    });

    it('should allow setting a new title after clearing', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Set initial title and content
      act(() => {
        adapter.setTitle('Original Title');
        adapter.setNodes([createTestNode({ id: '1' })]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      // Clear everything
      act(() => {
        adapter.transaction(() => {
          adapter.setNodes([]);
          adapter.setEdges([]);
          adapter.setSchemas([]);
        });
      });

      // Change title after clear
      act(() => {
        adapter.setTitle('New Project');
      });

      await waitFor(() => {
        expect(result.current.meta.title).toBe('New Project');
      });

      expect(result.current.nodes.nodes).toHaveLength(0);
      expect(result.current.meta.title).toBe('New Project');
    });
  });

  describe('Clear Instances Only', () => {
    it('should clear nodes and edges but preserve schemas', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Set up document with content
      act(() => {
        adapter.setTitle('Instance Clear Test');

        adapter.setNodes([
          createTestNode({ id: '1', type: 'Task' }),
          createTestNode({ id: '2', type: 'Task' }),
        ]);

        adapter.setEdges([createTestEdge({ source: '1', target: '2' })]);

        adapter.addSchema({
          type: 'PreservedSchema',
          fields: [{ name: 'name', type: 'string', displayTier: 'marker' }],
          ports: [],
        });
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      const schemaCountBefore = result.current.schemas.schemas.length;

      // Clear instances only
      act(() => {
        adapter.transaction(() => {
          adapter.setNodes([]);
          adapter.setEdges([]);
          // Schemas NOT cleared
        });
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(0);
      });

      // Nodes and edges cleared
      expect(result.current.nodes.nodes).toHaveLength(0);
      expect(result.current.edges.edges).toHaveLength(0);

      // Schemas preserved
      expect(result.current.schemas.schemas.length).toBe(schemaCountBefore);

      // Title preserved
      expect(result.current.meta.title).toBe('Instance Clear Test');
    });
  });

  describe('Edge Cases', () => {
    it('should handle clearing an already empty document', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Start with empty document
      act(() => {
        adapter.setNodes([]);
        adapter.setEdges([]);
        adapter.setSchemas([]);
        adapter.setTitle('Empty Doc');
      });

      await waitFor(() => {
        expect(result.current.meta.title).toBe('Empty Doc');
      });

      // Clear should not throw
      act(() => {
        adapter.transaction(() => {
          adapter.setNodes([]);
          adapter.setEdges([]);
          adapter.setSchemas([]);
        });
      });

      expect(result.current.nodes.nodes).toHaveLength(0);
      expect(result.current.meta.title).toBe('Empty Doc');
    });

    it('should clear connections stored on nodes', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Create nodes with connection data
      act(() => {
        adapter.setNodes([
          createTestNode({
            id: '1',
            type: 'Task',
            semanticId: 'source-task',
            connections: [
              {
                portId: 'flow-out',
                targetSemanticId: 'target-task',
                targetPortId: 'flow-in',
              },
            ],
          }),
          createTestNode({
            id: '2',
            type: 'Task',
            semanticId: 'target-task',
          }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      // Verify connection data exists
      const sourceNode = result.current.nodes.nodes.find((n) => n.id === '1');
      expect(sourceNode?.data.connections).toHaveLength(1);

      // Clear
      act(() => {
        adapter.setNodes([]);
        adapter.setEdges([]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(0);
      });

      // All node data including connections is gone
      expect(result.current.nodes.nodes).toHaveLength(0);
    });
  });
});
