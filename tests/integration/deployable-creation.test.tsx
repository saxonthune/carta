/**
 * Test: Deployable Creation from Node
 *
 * Verifies that deployables can be created and assigned from the node UI:
 * - Deployables can be created via addDeployable
 * - Nodes can be assigned to deployables
 * - New deployables are immediately available for selection
 *
 * This is an integration test that exercises:
 * - useDocument hook
 * - addDeployable operation
 * - Node deployableId updates
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocument } from '../../src/hooks/useDocument';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { createTestNode } from '../setup/testHelpers';

describe('Deployable Creation', () => {
  describe('creating deployables', () => {
    it('should create a new deployable with name and description', async () => {
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

      const { document } = result.current;

      // Initially no deployables
      expect(document.deployables).toHaveLength(0);

      // Create a deployable
      let newDeployable;
      act(() => {
        newDeployable = document.addDeployable({
          name: 'Frontend Service',
          description: 'React frontend application',
        });
      });

      await waitFor(() => {
        expect(result.current.document.deployables).toHaveLength(1);
      });

      const deployable = result.current.document.deployables[0];
      expect(deployable).toBeDefined();
      expect(deployable.id).toBeDefined();
      expect(deployable.name).toBe('Frontend Service');
      expect(deployable.description).toBe('React frontend application');
    });

    it('should create deployable without description', async () => {
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

      const { document } = result.current;

      act(() => {
        document.addDeployable({
          name: 'API Service',
          description: '',
        });
      });

      await waitFor(() => {
        expect(result.current.document.deployables).toHaveLength(1);
      });

      const deployable = result.current.document.deployables[0];
      expect(deployable.name).toBe('API Service');
      expect(deployable.description).toBe('');
    });

    it('should support multiple deployables', async () => {
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

      const { document } = result.current;

      // Create multiple deployables
      act(() => {
        document.addDeployable({ name: 'Frontend', description: 'UI layer' });
        document.addDeployable({ name: 'Backend', description: 'API layer' });
        document.addDeployable({ name: 'Database', description: 'Data layer' });
      });

      await waitFor(() => {
        expect(result.current.document.deployables).toHaveLength(3);
      });

      const names = result.current.document.deployables.map(d => d.name);
      expect(names).toContain('Frontend');
      expect(names).toContain('Backend');
      expect(names).toContain('Database');
    });
  });

  describe('assigning nodes to deployables', () => {
    it('should assign node to a deployable', async () => {
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
      const { document } = result.current;

      // Create a node
      act(() => {
        adapter.setNodes([
          createTestNode({
            id: '1',
            type: 'Task',
            semanticId: 'api-endpoint',
          }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(1);
      });

      // Create a deployable
      let deployableId: string;
      act(() => {
        const deployable = document.addDeployable({
          name: 'API Service',
          description: 'Backend API',
        });
        deployableId = deployable.id;
      });

      await waitFor(() => {
        expect(result.current.document.deployables).toHaveLength(1);
      });

      // Assign node to deployable
      act(() => {
        adapter.updateNode('1', { deployableId });
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === '1');
        expect(node?.data.deployableId).toBe(deployableId);
      });

      const node = result.current.document.nodes[0];
      expect(node.data.deployableId).toBe(deployableId);
    });

    it('should allow removing deployable assignment', async () => {
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
      const { document } = result.current;

      // Create deployable and node
      let deployableId: string;
      act(() => {
        const deployable = document.addDeployable({
          name: 'Service',
          description: 'Test',
        });
        deployableId = deployable.id;

        adapter.setNodes([
          createTestNode({
            id: '1',
            type: 'Task',
            semanticId: 'task-1',
            deployableId,
          }),
        ]);
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === '1');
        expect(node?.data.deployableId).toBe(deployableId);
      });

      // Remove deployable assignment
      act(() => {
        adapter.updateNode('1', { deployableId: null });
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === '1');
        expect(node?.data.deployableId).toBeNull();
      });
    });

    it('should reassign node from one deployable to another', async () => {
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
      const { document } = result.current;

      // Create two deployables
      let deployable1Id: string;
      let deployable2Id: string;
      act(() => {
        const d1 = document.addDeployable({ name: 'Frontend', description: '' });
        const d2 = document.addDeployable({ name: 'Backend', description: '' });
        deployable1Id = d1.id;
        deployable2Id = d2.id;

        adapter.setNodes([
          createTestNode({
            id: '1',
            type: 'Task',
            semanticId: 'task-1',
            deployableId: deployable1Id,
          }),
        ]);
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === '1');
        expect(node?.data.deployableId).toBe(deployable1Id);
      });

      // Reassign to second deployable
      act(() => {
        adapter.updateNode('1', { deployableId: deployable2Id });
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === '1');
        expect(node?.data.deployableId).toBe(deployable2Id);
      });

      const node = result.current.document.nodes[0];
      expect(node.data.deployableId).toBe(deployable2Id);
    });
  });

  describe('workflow: create and assign', () => {
    it('should create deployable and immediately assign node to it', async () => {
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
      const { document } = result.current;

      // Create node first
      act(() => {
        adapter.setNodes([
          createTestNode({
            id: '1',
            type: 'Task',
            semanticId: 'auth-service',
          }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(1);
      });

      // Create deployable and assign in one flow (simulating UI workflow)
      act(() => {
        const newDeployable = document.addDeployable({
          name: 'Authentication Service',
          description: 'Handles user authentication',
        });
        adapter.updateNode('1', { deployableId: newDeployable.id });
      });

      await waitFor(() => {
        expect(result.current.document.deployables).toHaveLength(1);
      });

      await waitFor(() => {
        const node = result.current.document.nodes.find(n => n.id === '1');
        const deployable = result.current.document.deployables[0];
        expect(node?.data.deployableId).toBe(deployable.id);
      });

      const node = result.current.document.nodes[0];
      const deployable = result.current.document.deployables[0];
      expect(node.data.deployableId).toBe(deployable.id);
      expect(deployable.name).toBe('Authentication Service');
    });
  });
});
