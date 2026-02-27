/**
 * Test: Clear Everything functionality
 *
 * Verifies that Clear Everything actually clears all document state:
 * - Nodes
 * - Edges
 * - Schemas
 * - Port schemas
 * - Schema groups
 *
 * But preserves:
 * - Title
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNodes } from '../../src/hooks/useNodes';
import { useEdges } from '../../src/hooks/useEdges';
import { useSchemas } from '../../src/hooks/useSchemas';
import { usePortSchemas } from '../../src/hooks/usePortSchemas';
import { useSchemaGroups } from '../../src/hooks/useSchemaGroups';
import { useDocumentMeta } from '../../src/hooks/useDocumentMeta';
import { useClearDocument } from '../../src/hooks/useClearDocument';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { standardLibrary, builtInPortSchemas } from '@carta/schema';
import { createTestNode } from '../setup/testHelpers';

// Use the first standard library package's schemas as test data
const testPackage = standardLibrary[0]; // Software Architecture
const testSchemas = testPackage.schemas;
const testGroups = testPackage.schemaGroups;

describe('Clear Everything', () => {
  describe('Clear All Mode', () => {
    it('should clear all nodes', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
          clearDocument: useClearDocument(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Add some nodes
      act(() => {
        adapter.setNodes([
          createTestNode({ id: '1', type: 'controller', semanticId: 'controller-1' }),
          createTestNode({ id: '2', type: 'database', semanticId: 'database-1' }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      // Clear everything
      act(() => {
        result.current.clearDocument.clearDocument('all');
      });

      // Verify nodes are cleared
      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(0);
      });
    });

    it('should clear all construct schemas', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
          clearDocument: useClearDocument(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Add some schemas
      act(() => {
        adapter.setSchemas(testSchemas);
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBeGreaterThan(0);
      });

      const schemaCountBefore = result.current.schemas.schemas.length;
      expect(schemaCountBefore).toBeGreaterThan(0);

      // Clear everything
      act(() => {
        result.current.clearDocument.clearDocument('all');
      });

      // Verify schemas are cleared
      await waitFor(() => {
        expect(result.current.schemas.schemas).toHaveLength(0);
      });
    });

    it('should clear all port schemas', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
          clearDocument: useClearDocument(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Add some port schemas
      act(() => {
        adapter.setPortSchemas(builtInPortSchemas);
      });

      await waitFor(() => {
        expect(result.current.portSchemas.portSchemas.length).toBeGreaterThan(0);
      });

      const portSchemaCountBefore = result.current.portSchemas.portSchemas.length;
      expect(portSchemaCountBefore).toBeGreaterThan(0);

      // Clear everything
      act(() => {
        result.current.clearDocument.clearDocument('all');
      });

      // Verify port schemas are cleared
      await waitFor(() => {
        expect(result.current.portSchemas.portSchemas).toHaveLength(0);
      });
    });

    it('should clear all schema groups', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
          clearDocument: useClearDocument(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Add some schema groups
      act(() => {
        adapter.setSchemaGroups(testGroups);
      });

      await waitFor(() => {
        expect(result.current.schemaGroups.schemaGroups.length).toBeGreaterThan(0);
      });

      // Clear everything
      act(() => {
        result.current.clearDocument.clearDocument('all');
      });

      // Verify schema groups are cleared
      await waitFor(() => {
        expect(result.current.schemaGroups.schemaGroups).toHaveLength(0);
      });
    });

    it('should preserve title after clear all', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
          clearDocument: useClearDocument(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Set a custom title
      const customTitle = 'My Important Project';
      act(() => {
        adapter.setTitle(customTitle);
      });

      await waitFor(() => {
        expect(result.current.meta.title).toBe(customTitle);
      });

      // Clear everything
      act(() => {
        result.current.clearDocument.clearDocument('all');
      });

      // Title should be preserved
      expect(result.current.meta.title).toBe(customTitle);
    });
  });

  describe('Clear Instances Only Mode', () => {
    it('should clear nodes but preserve schemas', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
          clearDocument: useClearDocument(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Add nodes and schemas
      act(() => {
        adapter.setSchemas(testSchemas);
        adapter.setNodes([
          createTestNode({ id: '1', type: 'controller', semanticId: 'controller-1' }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
        expect(result.current.schemas.schemas.length).toBeGreaterThan(0);
      });

      const schemaCountBefore = result.current.schemas.schemas.length;

      // Clear instances only
      act(() => {
        result.current.clearDocument.clearDocument('instances');
      });

      // Nodes should be cleared, schemas preserved
      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(0);
      });
      expect(result.current.schemas.schemas.length).toBe(schemaCountBefore);
    });

    it('should preserve port schemas when clearing instances only', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
          clearDocument: useClearDocument(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Add port schemas and nodes
      act(() => {
        adapter.setPortSchemas(builtInPortSchemas);
        adapter.setNodes([
          createTestNode({ id: '1', type: 'controller', semanticId: 'controller-1' }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
        expect(result.current.portSchemas.portSchemas.length).toBeGreaterThan(0);
      });

      const portSchemaCountBefore = result.current.portSchemas.portSchemas.length;

      // Clear instances only
      act(() => {
        result.current.clearDocument.clearDocument('instances');
      });

      // Nodes should be cleared, port schemas preserved
      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(0);
      });
      expect(result.current.portSchemas.portSchemas.length).toBe(portSchemaCountBefore);
    });
  });
});
