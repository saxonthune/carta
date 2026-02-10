/**
 * Test: Node View Level Behavior
 *
 * Verifies that nodes:
 * - Start in summary view by default when created
 * - Can be switched between summary and details view levels
 * - Preserve view level when updating other node properties
 *
 * This is an integration test that exercises:
 * - useGraphOperations hook (node creation, view level management)
 * - useDocument hook (state access)
 * - Node view level state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNodes } from '../../src/hooks/useNodes';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { useGraphOperations } from '../../src/hooks/useGraphOperations';
import { useReactFlow } from '@xyflow/react';
import { TestProviders } from '../setup/testProviders';
import { builtInConstructSchemas } from '@carta/domain';

describe('Node View Level Behavior', () => {
  describe('default view level', () => {
    it('should create nodes in summary view by default', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          context: useDocumentContext(),
          reactFlow: useReactFlow(),
          graphOps: useGraphOperations({
            selectedNodeIds: [],
            setSelectedNodeIds: () => {},
            setRenamingNodeId: () => {},
            setAddMenu: () => {},
          }),
        }),
        { wrapper: TestProviders }
      );

      // Wait for adapter to initialize
      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      // Create a construct using addConstruct (how nodes are created in the app)
      const schema = builtInConstructSchemas[0]; // Get first built-in schema
      act(() => {
        result.current.graphOps.addConstruct(schema, 100, 100);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      // Verify node starts in summary view
      const node = result.current.nodes.nodes[0];
      expect(node.data.detailMode).toBe('summary');
    });

    it('should create related constructs in summary view', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          context: useDocumentContext(),
          reactFlow: useReactFlow(),
          graphOps: useGraphOperations({
            selectedNodeIds: [],
            setSelectedNodeIds: () => {},
            setRenamingNodeId: () => {},
            setAddMenu: () => {},
          }),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      // Create source node first
      const schema = builtInConstructSchemas[0];
      act(() => {
        result.current.graphOps.addConstruct(schema, 100, 100);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      const sourceNodeId = result.current.nodes.nodes[0].id;

      // Add related construct
      act(() => {
        result.current.graphOps.addRelatedConstruct(
          sourceNodeId,
          schema.type
        );
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      // Verify both nodes are in summary view
      const nodes = result.current.nodes.nodes;
      expect(nodes[0].data.detailMode).toBe('summary');
      expect(nodes[1].data.detailMode).toBe('summary');
    });
  });

  describe('set view level', () => {
    it('should set node from summary to details', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          context: useDocumentContext(),
          reactFlow: useReactFlow(),
          graphOps: useGraphOperations({
            selectedNodeIds: [],
            setSelectedNodeIds: () => {},
            setRenamingNodeId: () => {},
            setAddMenu: () => {},
          }),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      // Create node in summary view
      const schema = builtInConstructSchemas[0];
      act(() => {
        result.current.graphOps.addConstruct(schema, 100, 100);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      const nodeId = result.current.nodes.nodes[0].id;
      expect(result.current.nodes.nodes[0].data.detailMode).toBe('summary');

      // Set to details
      act(() => {
        result.current.graphOps.setNodeViewLevel(nodeId, 'details');
      });

      await waitFor(() => {
        const node = result.current.nodes.nodes.find(n => n.id === nodeId);
        expect(node?.data.detailMode).toBe('details');
      });
    });

    it('should set node from details back to summary', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          context: useDocumentContext(),
          reactFlow: useReactFlow(),
          graphOps: useGraphOperations({
            selectedNodeIds: [],
            setSelectedNodeIds: () => {},
            setRenamingNodeId: () => {},
            setAddMenu: () => {},
          }),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const schema = builtInConstructSchemas[0];
      act(() => {
        result.current.graphOps.addConstruct(schema, 100, 100);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      const nodeId = result.current.nodes.nodes[0].id;

      // Set to details first
      act(() => {
        result.current.graphOps.setNodeViewLevel(nodeId, 'details');
      });

      await waitFor(() => {
        const node = result.current.nodes.nodes.find(n => n.id === nodeId);
        expect(node?.data.detailMode).toBe('details');
      });

      // Then back to summary
      act(() => {
        result.current.graphOps.setNodeViewLevel(nodeId, 'summary');
      });

      await waitFor(() => {
        const node = result.current.nodes.nodes.find(n => n.id === nodeId);
        expect(node?.data.detailMode).toBe('summary');
      });
    });

    it('should allow multiple view level changes in sequence', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          context: useDocumentContext(),
          reactFlow: useReactFlow(),
          graphOps: useGraphOperations({
            selectedNodeIds: [],
            setSelectedNodeIds: () => {},
            setRenamingNodeId: () => {},
            setAddMenu: () => {},
          }),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const schema = builtInConstructSchemas[0];
      act(() => {
        result.current.graphOps.addConstruct(schema, 100, 100);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      const nodeId = result.current.nodes.nodes[0].id;

      // Initial state is summary
      expect(result.current.nodes.nodes[0].data.detailMode).toBe('summary');

      // Set to details
      act(() => {
        result.current.graphOps.setNodeViewLevel(nodeId, 'details');
      });

      await waitFor(() => {
        const node = result.current.nodes.nodes.find(n => n.id === nodeId);
        expect(node?.data.detailMode).toBe('details');
      });

      // Set back to summary
      act(() => {
        result.current.graphOps.setNodeViewLevel(nodeId, 'summary');
      });

      await waitFor(() => {
        const node = result.current.nodes.nodes.find(n => n.id === nodeId);
        expect(node?.data.detailMode).toBe('summary');
      });

      // Set to details again
      act(() => {
        result.current.graphOps.setNodeViewLevel(nodeId, 'details');
      });

      await waitFor(() => {
        const node = result.current.nodes.nodes.find(n => n.id === nodeId);
        expect(node?.data.detailMode).toBe('details');
      });
    });
  });

  describe('view level persistence', () => {
    it('should preserve view level when updating node values', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          context: useDocumentContext(),
          reactFlow: useReactFlow(),
          graphOps: useGraphOperations({
            selectedNodeIds: [],
            setSelectedNodeIds: () => {},
            setRenamingNodeId: () => {},
            setAddMenu: () => {},
          }),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const schema = builtInConstructSchemas[0];
      act(() => {
        result.current.graphOps.addConstruct(schema, 100, 100);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      const nodeId = result.current.nodes.nodes[0].id;

      // Set to details
      act(() => {
        result.current.graphOps.setNodeViewLevel(nodeId, 'details');
      });

      await waitFor(() => {
        const node = result.current.nodes.nodes.find(n => n.id === nodeId);
        expect(node?.data.detailMode).toBe('details');
      });

      // Update node values
      act(() => {
        result.current.graphOps.updateNodeValues(nodeId, {
          name: 'Updated name',
        });
      });

      await waitFor(() => {
        const node = result.current.nodes.nodes.find(n => n.id === nodeId);
        expect(node?.data.values.name).toBe('Updated name');
      });

      // View level should still be details
      const node = result.current.nodes.nodes.find(n => n.id === nodeId);
      expect(node?.data.detailMode).toBe('details');
    });

  });

  describe('details pin', () => {
    it('should toggle details pin state', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          context: useDocumentContext(),
          reactFlow: useReactFlow(),
          graphOps: useGraphOperations({
            selectedNodeIds: [],
            setSelectedNodeIds: () => {},
            setRenamingNodeId: () => {},
            setAddMenu: () => {},
          }),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const schema = builtInConstructSchemas[0];
      act(() => {
        result.current.graphOps.addConstruct(schema, 100, 100);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      const nodeId = result.current.nodes.nodes[0].id;

      // Pin should be false/undefined initially
      expect(result.current.nodes.nodes[0].data.isDetailsPinned).toBeFalsy();

      // Toggle pin on
      act(() => {
        result.current.graphOps.toggleNodeDetailsPin(nodeId);
      });

      await waitFor(() => {
        const node = result.current.nodes.nodes.find(n => n.id === nodeId);
        expect(node?.data.isDetailsPinned).toBe(true);
      });

      // Toggle pin off
      act(() => {
        result.current.graphOps.toggleNodeDetailsPin(nodeId);
      });

      await waitFor(() => {
        const node = result.current.nodes.nodes.find(n => n.id === nodeId);
        expect(node?.data.isDetailsPinned).toBe(false);
      });
    });
  });
});
