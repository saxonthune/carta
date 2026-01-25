/**
 * Test: Node Field Editing
 *
 * Verifies that expanded nodes allow editing field values:
 * - Field values can be changed via onValuesChange callback
 * - Changes persist in the document store
 *
 * This is an integration test that exercises:
 * - useDocument hook
 * - useGraphOperations hook
 * - Node data update flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocument } from '../../src/hooks/useDocument';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { createTestNode } from '../setup/testHelpers';

describe('Node Field Editing', () => {
  describe('expanded node field updates', () => {
    it('should update node values when onValuesChange is called', async () => {
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

      // Create a node with initial values
      act(() => {
        adapter.setNodes([
          createTestNode({
            id: '1',
            type: 'Task',
            semanticId: 'task-1',
            values: { description: 'Initial description' },
          }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(1);
      });

      // Verify initial value
      const initialNode = result.current.document.nodes[0];
      expect(initialNode.data.values.description).toBe('Initial description');

      // Update the values (simulating what happens when user edits a field)
      act(() => {
        adapter.updateNode('1', {
          values: { description: 'Updated description', priority: 'high' },
        });
      });

      await waitFor(() => {
        const updatedNode = result.current.document.nodes.find(n => n.id === '1');
        expect(updatedNode?.data.values.description).toBe('Updated description');
      });

      const updatedNode = result.current.document.nodes[0];
      expect(updatedNode.data.values.description).toBe('Updated description');
      expect(updatedNode.data.values.priority).toBe('high');
    });

    it('should preserve other node properties when updating values', async () => {
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

      // Create a node with connections and deployable
      act(() => {
        adapter.setNodes([
          createTestNode({
            id: '1',
            type: 'Task',
            semanticId: 'task-with-data',
            values: { name: 'Original' },
            connections: [
              { portId: 'flow-out', targetSemanticId: 'other-task', targetPortId: 'flow-in' },
            ],
          }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(1);
      });

      const originalNode = result.current.document.nodes[0];
      expect(originalNode.data.connections).toHaveLength(1);

      // Update just the values
      act(() => {
        adapter.updateNode('1', {
          values: { name: 'Updated' },
        });
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === '1');
        expect(node?.data.values.name).toBe('Updated');
      });

      // Connections should still be preserved
      const updatedNode = result.current.document.nodes[0];
      expect(updatedNode.data.connections).toHaveLength(1);
      expect(updatedNode.data.semanticId).toBe('task-with-data');
    });

    it('should handle multiple field updates atomically', async () => {
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

      act(() => {
        adapter.setNodes([
          createTestNode({
            id: '1',
            type: 'Task',
            semanticId: 'task-1',
            values: {},
          }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(1);
      });

      // Update multiple fields at once
      act(() => {
        adapter.updateNode('1', {
          values: {
            name: 'Multi-field task',
            description: 'Has multiple fields',
            priority: 'critical',
            status: 'in-progress',
          },
        });
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === '1');
        expect(node?.data.values.name).toBe('Multi-field task');
      });

      const node = result.current.document.nodes[0];
      expect(node.data.values).toEqual({
        name: 'Multi-field task',
        description: 'Has multiple fields',
        priority: 'critical',
        status: 'in-progress',
      });
    });
  });

  describe('toggle expand behavior', () => {
    it('should toggle isExpanded state on node', async () => {
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

      // Create collapsed node
      act(() => {
        adapter.setNodes([
          createTestNode({
            id: '1',
            type: 'Task',
            semanticId: 'task-1',
          }),
        ]);
        // Set isExpanded to false explicitly
        adapter.updateNode('1', { isExpanded: false });
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === '1');
        expect(node?.data.isExpanded).toBe(false);
      });

      // Toggle to expanded
      act(() => {
        adapter.updateNode('1', { isExpanded: true });
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === '1');
        expect(node?.data.isExpanded).toBe(true);
      });
    });
  });
});
