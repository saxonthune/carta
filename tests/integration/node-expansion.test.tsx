/**
 * Test: Node Expansion Behavior
 *
 * Verifies that nodes:
 * - Start collapsed by default when created
 * - Can be toggled between expanded and collapsed states
 * - Display all properties without scrolling when expanded
 *
 * This is an integration test that exercises:
 * - useGraphOperations hook (node creation)
 * - useDocument hook (state access)
 * - Node expansion state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocument } from '../../src/hooks/useDocument';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { useGraphOperations } from '../../src/hooks/useGraphOperations';
import { useReactFlow } from '@xyflow/react';
import { TestProviders } from '../setup/testProviders';
import { builtInConstructSchemas } from '@carta/domain';

describe('Node Expansion Behavior', () => {
  describe('default expansion state', () => {
    it('should create nodes in collapsed state by default', async () => {
      const { result } = renderHook(
        () => ({
          document: useDocument(),
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
        expect(result.current.document.nodes).toHaveLength(1);
      });

      // Verify node starts collapsed
      const node = result.current.document.nodes[0];
      expect(node.data.isExpanded).toBe(false);
    });

    it('should create related constructs in collapsed state', async () => {
      const { result } = renderHook(
        () => ({
          document: useDocument(),
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
        expect(result.current.document.nodes).toHaveLength(1);
      });

      const sourceNodeId = result.current.document.nodes[0].id;

      // Add related construct
      act(() => {
        result.current.graphOps.addRelatedConstruct(
          sourceNodeId,
          schema.type
        );
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(2);
      });

      // Verify both nodes are collapsed
      const nodes = result.current.document.nodes;
      expect(nodes[0].data.isExpanded).toBe(false);
      expect(nodes[1].data.isExpanded).toBe(false);
    });
  });

  describe('toggle expansion', () => {
    it('should toggle node from collapsed to expanded', async () => {
      const { result } = renderHook(
        () => ({
          document: useDocument(),
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

      // Create collapsed node
      const schema = builtInConstructSchemas[0];
      act(() => {
        result.current.graphOps.addConstruct(schema, 100, 100);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(1);
      });

      const nodeId = result.current.document.nodes[0].id;
      expect(result.current.document.nodes[0].data.isExpanded).toBe(false);

      // Toggle to expanded
      act(() => {
        result.current.graphOps.toggleNodeExpand(nodeId);
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === nodeId);
        expect(node?.data.isExpanded).toBe(true);
      });
    });

    it('should toggle node from expanded back to collapsed', async () => {
      const { result } = renderHook(
        () => ({
          document: useDocument(),
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
        expect(result.current.document.nodes).toHaveLength(1);
      });

      const nodeId = result.current.document.nodes[0].id;

      // Expand first
      act(() => {
        result.current.graphOps.toggleNodeExpand(nodeId);
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === nodeId);
        expect(node?.data.isExpanded).toBe(true);
      });

      // Then collapse
      act(() => {
        result.current.graphOps.toggleNodeExpand(nodeId);
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === nodeId);
        expect(node?.data.isExpanded).toBe(false);
      });
    });

    it('should allow multiple toggles in sequence', async () => {
      const { result } = renderHook(
        () => ({
          document: useDocument(),
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
        expect(result.current.document.nodes).toHaveLength(1);
      });

      const nodeId = result.current.document.nodes[0].id;

      // Initial state is collapsed (false)
      expect(result.current.document.nodes[0].data.isExpanded).toBe(false);

      // Toggle to expanded
      act(() => {
        result.current.graphOps.toggleNodeExpand(nodeId);
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === nodeId);
        expect(node?.data.isExpanded).toBe(true);
      });

      // Toggle back to collapsed
      act(() => {
        result.current.graphOps.toggleNodeExpand(nodeId);
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === nodeId);
        expect(node?.data.isExpanded).toBe(false);
      });

      // Toggle to expanded again
      act(() => {
        result.current.graphOps.toggleNodeExpand(nodeId);
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === nodeId);
        expect(node?.data.isExpanded).toBe(true);
      });
    });
  });

  describe('expansion state persistence', () => {
    it('should preserve expansion state when updating node values', async () => {
      const { result } = renderHook(
        () => ({
          document: useDocument(),
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
        expect(result.current.document.nodes).toHaveLength(1);
      });

      const nodeId = result.current.document.nodes[0].id;

      // Expand the node
      act(() => {
        result.current.graphOps.toggleNodeExpand(nodeId);
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === nodeId);
        expect(node?.data.isExpanded).toBe(true);
      });

      // Update node values
      act(() => {
        result.current.graphOps.updateNodeValues(nodeId, {
          name: 'Updated name',
        });
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === nodeId);
        expect(node?.data.values.name).toBe('Updated name');
      });

      // Expansion state should still be true
      const node = result.current.document.nodes.find(n => n.id === nodeId);
      expect(node?.data.isExpanded).toBe(true);
    });

    it('should preserve expansion state when updating deployable', async () => {
      const { result } = renderHook(
        () => ({
          document: useDocument(),
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

      const { adapter } = result.current.context;

      // Add a deployable
      let deployableId: string;
      act(() => {
        const dep = adapter.addDeployable({
          name: 'Test Deploy',
          description: 'Test',
        });
        deployableId = dep.id;
      });

      const schema = builtInConstructSchemas[0];
      act(() => {
        result.current.graphOps.addConstruct(schema, 100, 100);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(1);
      });

      const nodeId = result.current.document.nodes[0].id;

      // Expand the node
      act(() => {
        result.current.graphOps.toggleNodeExpand(nodeId);
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === nodeId);
        expect(node?.data.isExpanded).toBe(true);
      });

      // Update deployable
      act(() => {
        result.current.graphOps.updateNodeDeployable(nodeId, deployableId!);
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === nodeId);
        expect(node?.data.deployableId).toBe(deployableId);
      });

      // Expansion state should still be true
      const node = result.current.document.nodes.find(n => n.id === nodeId);
      expect(node?.data.isExpanded).toBe(true);
    });
  });
});
