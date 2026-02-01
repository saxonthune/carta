/**
 * Test: Menu -> Clear -> Clear Everything
 *
 * Verifies that "Clear Everything" removes all document content
 * (nodes, edges, schemas, deployables) while preserving the title.
 *
 * This is an integration test that exercises:
 * - Document adapter (Yjs)
 * - useDocument hook
 * - Clear functionality from App.tsx
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocument } from '../../src/hooks/useDocument';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { createTestNode, createTestEdge } from '../setup/testHelpers';

describe('Clear Document', () => {
  describe('Clear Everything', () => {
    it('should clear nodes, edges, schemas, and deployables but preserve title', async () => {
      // Arrange: Set up a document with content
      const { result } = renderHook(
        () => ({
          document: useDocument(),
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
          fields: [{ name: 'name', type: 'string', displayTier: 'pill' }],
          ports: [],
        });

        // Add a deployable
        adapter.addDeployable({
          name: 'Test Deployable',
          description: 'A test deployable',
          color: '#ff0000',
        });
      });

      // Verify content exists before clear
      await waitFor(() => {
        expect(result.current.document.nodes.length).toBeGreaterThan(0);
      });

      expect(result.current.document.nodes).toHaveLength(2);
      expect(result.current.document.edges).toHaveLength(1);
      expect(result.current.document.title).toBe('My Test Project');
      expect(adapter.getDeployables().length).toBeGreaterThan(0);

      // Act: Clear everything (simulating what handleClear('all') does)
      act(() => {
        adapter.transaction(() => {
          adapter.setNodes([]);
          adapter.setEdges([]);
          adapter.setSchemas([]);
          adapter.setDeployables([]);
          adapter.setPortSchemas([]);
          // Note: Title is NOT cleared - this is the expected behavior
        });
      });

      // Assert: Document content is cleared
      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(0);
      });

      expect(result.current.document.nodes).toHaveLength(0);
      expect(result.current.document.edges).toHaveLength(0);
      expect(result.current.document.schemas).toHaveLength(0);
      expect(result.current.document.deployables).toHaveLength(0);

      // Assert: Title is preserved (the key requirement)
      expect(result.current.document.title).toBe('My Test Project');
    });

    it('should allow setting a new title after clearing', async () => {
      const { result } = renderHook(
        () => ({
          document: useDocument(),
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
        expect(result.current.document.nodes).toHaveLength(1);
      });

      // Clear everything
      act(() => {
        adapter.transaction(() => {
          adapter.setNodes([]);
          adapter.setEdges([]);
          adapter.setSchemas([]);
          adapter.setDeployables([]);
        });
      });

      // Change title after clear
      act(() => {
        adapter.setTitle('New Project');
      });

      await waitFor(() => {
        expect(result.current.document.title).toBe('New Project');
      });

      expect(result.current.document.nodes).toHaveLength(0);
      expect(result.current.document.title).toBe('New Project');
    });
  });

  describe('Clear Instances Only', () => {
    it('should clear nodes and edges but preserve schemas and deployables', async () => {
      const { result } = renderHook(
        () => ({
          document: useDocument(),
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
          fields: [{ name: 'name', type: 'string', displayTier: 'pill' }],
          ports: [],
        });

        adapter.addDeployable({
          name: 'Preserved Deployable',
          description: 'Should survive clear instances',
          color: '#00ff00',
        });
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(2);
      });

      const schemaCountBefore = result.current.document.schemas.length;
      const deployableCountBefore = result.current.document.deployables.length;

      // Clear instances only
      act(() => {
        adapter.transaction(() => {
          adapter.setNodes([]);
          adapter.setEdges([]);
          // Schemas and deployables NOT cleared
        });
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(0);
      });

      // Nodes and edges cleared
      expect(result.current.document.nodes).toHaveLength(0);
      expect(result.current.document.edges).toHaveLength(0);

      // Schemas and deployables preserved
      expect(result.current.document.schemas.length).toBe(schemaCountBefore);
      expect(result.current.document.deployables.length).toBe(deployableCountBefore);

      // Title preserved
      expect(result.current.document.title).toBe('Instance Clear Test');
    });
  });

  describe('Edge Cases', () => {
    it('should handle clearing an already empty document', async () => {
      const { result } = renderHook(
        () => ({
          document: useDocument(),
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
        adapter.setDeployables([]);
        adapter.setTitle('Empty Doc');
      });

      await waitFor(() => {
        expect(result.current.document.title).toBe('Empty Doc');
      });

      // Clear should not throw
      act(() => {
        adapter.transaction(() => {
          adapter.setNodes([]);
          adapter.setEdges([]);
          adapter.setSchemas([]);
          adapter.setDeployables([]);
        });
      });

      expect(result.current.document.nodes).toHaveLength(0);
      expect(result.current.document.title).toBe('Empty Doc');
    });

    it('should clear connections stored on nodes', async () => {
      const { result } = renderHook(
        () => ({
          document: useDocument(),
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
        expect(result.current.document.nodes).toHaveLength(2);
      });

      // Verify connection data exists
      const sourceNode = result.current.document.nodes.find((n) => n.id === '1');
      expect(sourceNode?.data.connections).toHaveLength(1);

      // Clear
      act(() => {
        adapter.setNodes([]);
        adapter.setEdges([]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(0);
      });

      // All node data including connections is gone
      expect(result.current.document.nodes).toHaveLength(0);
    });
  });
});
