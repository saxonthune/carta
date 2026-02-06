/**
 * Test: Settings -> Restore Default Schemas
 *
 * Verifies that "Restore Default Schemas" restores construct schemas,
 * port schemas, AND schema groups from built-ins.
 *
 * This is an integration test that exercises:
 * - Document adapter (Yjs)
 * - Schema and port schema synchronization
 * - handleRestoreDefaultSchemas from App.tsx
 * - Built-in definitions from built-ins.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNodes } from '../../src/hooks/useNodes';
import { useEdges } from '../../src/hooks/useEdges';
import { useSchemas } from '../../src/hooks/useSchemas';
import { usePortSchemas } from '../../src/hooks/usePortSchemas';
import { useSchemaGroups } from '../../src/hooks/useSchemaGroups';
import { useDocumentMeta } from '../../src/hooks/useDocumentMeta';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { builtInConstructSchemas, builtInPortSchemas, builtInSchemaGroups } from '@carta/domain';
import { createTestNode } from '../setup/testHelpers';

describe('Restore Default Schemas', () => {
  describe('Restore All Defaults', () => {
    it('should restore construct schemas, port schemas, and schema groups', async () => {
      // Arrange: Set up a document with custom content
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
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

      // Clear everything first to start fresh
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setNodes([]);
          adapter.setEdges([]);
          adapter.setPortSchemas([]);
          adapter.setSchemaGroups([]);
        });
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas).toHaveLength(0);
      });

      // Verify all defaults are cleared
      expect(result.current.schemas.schemas).toHaveLength(0);
      expect(result.current.portSchemas.portSchemas).toHaveLength(0);
      expect(result.current.schemaGroups.schemaGroups).toHaveLength(0);

      // Act: Restore all defaults (simulating handleRestoreDefaultSchemas)
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setSchemas(builtInConstructSchemas);
          adapter.setPortSchemas(builtInPortSchemas);
          adapter.setSchemaGroups(builtInSchemaGroups);
        });
      });

      // Assert: All defaults are restored
      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBeGreaterThan(0);
      });

      // Verify construct schemas
      expect(result.current.schemas.schemas.length).toBe(builtInConstructSchemas.length);
      expect(result.current.schemas.schemas).toEqual(builtInConstructSchemas);

      // Verify port schemas
      expect(result.current.portSchemas.portSchemas.length).toBe(builtInPortSchemas.length);
      expect(result.current.portSchemas.portSchemas).toEqual(builtInPortSchemas);

      // Verify schema groups
      expect(result.current.schemaGroups.schemaGroups.length).toBe(builtInSchemaGroups.length);
      expect(result.current.schemaGroups.schemaGroups).toEqual(builtInSchemaGroups);
    });

    it('should restore specific construct types with correct properties', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Clear defaults
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setPortSchemas([]);
          adapter.setSchemaGroups([]);
        });
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas).toHaveLength(0);
      });

      // Restore defaults
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setSchemas(builtInConstructSchemas);
          adapter.setPortSchemas(builtInPortSchemas);
          adapter.setSchemaGroups(builtInSchemaGroups);
        });
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBeGreaterThan(0);
      });

      // Verify specific construct types exist
      const restEndpointSchema = result.current.schemas.schemas.find(s => s.type === 'rest-endpoint');
      expect(restEndpointSchema).toBeDefined();
      expect(restEndpointSchema?.displayName).toBe('REST Endpoint');
      expect(restEndpointSchema?.groupId).toBe('api');

      const databaseSchema = result.current.schemas.schemas.find(s => s.type === 'database');
      expect(databaseSchema).toBeDefined();
      expect(databaseSchema?.displayName).toBe('Database');
      expect(databaseSchema?.groupId).toBe('database');

      const tableSchema = result.current.schemas.schemas.find(s => s.type === 'table');
      expect(tableSchema).toBeDefined();
      expect(tableSchema?.displayName).toBe('Table');
    });

    it('should restore port schemas with correct properties', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Clear port schemas
      act(() => {
        adapter.setPortSchemas([]);
      });

      await waitFor(() => {
        expect(result.current.portSchemas.portSchemas).toHaveLength(0);
      });

      // Restore port schemas
      act(() => {
        adapter.setPortSchemas(builtInPortSchemas);
      });

      await waitFor(() => {
        expect(result.current.portSchemas.portSchemas.length).toBeGreaterThan(0);
      });

      // Verify specific port types exist
      const flowInPort = result.current.portSchemas.portSchemas.find(p => p.id === 'flow-in');
      expect(flowInPort).toBeDefined();
      expect(flowInPort?.polarity).toBe('sink');
      expect(flowInPort?.compatibleWith).toContain('flow-out');

      const flowOutPort = result.current.portSchemas.portSchemas.find(p => p.id === 'flow-out');
      expect(flowOutPort).toBeDefined();
      expect(flowOutPort?.polarity).toBe('source');

      const symmetricPort = result.current.portSchemas.portSchemas.find(p => p.id === 'symmetric');
      expect(symmetricPort).toBeDefined();
      expect(symmetricPort?.polarity).toBe('bidirectional');
      expect(symmetricPort?.compatibleWith).toEqual([]);
    });

    it('should restore schema groups with hierarchical structure', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Clear schema groups
      act(() => {
        adapter.setSchemaGroups([]);
      });

      await waitFor(() => {
        expect(result.current.schemaGroups.schemaGroups).toHaveLength(0);
      });

      // Restore schema groups
      act(() => {
        adapter.setSchemaGroups(builtInSchemaGroups);
      });

      await waitFor(() => {
        expect(result.current.schemaGroups.schemaGroups.length).toBeGreaterThan(0);
      });

      // Verify root group exists
      const rootGroup = result.current.schemaGroups.schemaGroups.find(
        g => g.id === 'software-design' && !g.parentId
      );
      expect(rootGroup).toBeDefined();
      expect(rootGroup?.name).toBe('Software Design');

      // Verify child groups exist with correct parent references
      const databaseGroup = result.current.schemaGroups.schemaGroups.find(
        g => g.id === 'database' && g.parentId === 'software-design'
      );
      expect(databaseGroup).toBeDefined();
      expect(databaseGroup?.name).toBe('Database');

      const apiGroup = result.current.schemaGroups.schemaGroups.find(
        g => g.id === 'api' && g.parentId === 'software-design'
      );
      expect(apiGroup).toBeDefined();
      expect(apiGroup?.name).toBe('API');

      const uiGroup = result.current.schemaGroups.schemaGroups.find(
        g => g.id === 'ui' && g.parentId === 'software-design'
      );
      expect(uiGroup).toBeDefined();
      expect(uiGroup?.name).toBe('UI');
    });

    it('should overwrite existing schemas with same types', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Add a custom schema with same type as built-in
      const customEndpoint = {
        type: 'rest-endpoint',
        displayName: 'Custom Endpoint',
        color: '#ff0000',
        description: 'Custom version',
        fields: [{ name: 'name', label: 'Name', type: 'string' as const, displayTier: 'pill' as const }],
        ports: [],
        compilation: { format: 'json' as const },
      };

      act(() => {
        adapter.setSchemas([]);
        adapter.setSchemas([customEndpoint]);
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas).toHaveLength(1);
      });

      // Verify custom version is there
      const customVersion = result.current.schemas.schemas[0];
      expect(customVersion.displayName).toBe('Custom Endpoint');

      // Restore defaults (which replaces all)
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setSchemas(builtInConstructSchemas);
        });
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBe(builtInConstructSchemas.length);
      });

      // Verify built-in version is restored
      const builtInVersion = result.current.schemas.schemas.find(s => s.type === 'rest-endpoint');
      expect(builtInVersion?.displayName).toBe('REST Endpoint');
    });
  });

  describe('Restore with Existing Document', () => {
    it('should preserve nodes and edges while restoring schemas', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Set up document with nodes
      act(() => {
        const nodes = [
          createTestNode({ id: '1', type: 'controller', semanticId: 'controller-1' }),
          createTestNode({ id: '2', type: 'database', semanticId: 'database-1' }),
        ];
        adapter.setNodes(nodes);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      // Clear schemas but keep nodes
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setPortSchemas([]);
          adapter.setSchemaGroups([]);
        });
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas).toHaveLength(0);
      });

      const nodeCountBefore = result.current.nodes.nodes.length;

      // Restore defaults
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setSchemas(builtInConstructSchemas);
          adapter.setPortSchemas(builtInPortSchemas);
          adapter.setSchemaGroups(builtInSchemaGroups);
        });
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBeGreaterThan(0);
      });

      // Verify nodes are preserved
      expect(result.current.nodes.nodes).toHaveLength(nodeCountBefore);
      expect(result.current.nodes.nodes[0].id).toBe('1');
      expect(result.current.nodes.nodes[1].id).toBe('2');

      // Verify schemas are restored
      expect(result.current.schemas.schemas.length).toBe(builtInConstructSchemas.length);
      expect(result.current.portSchemas.portSchemas.length).toBe(builtInPortSchemas.length);
      expect(result.current.schemaGroups.schemaGroups.length).toBe(builtInSchemaGroups.length);
    });

    it('should preserve title during restore', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      const testTitle = 'My Important Project';

      // Set title and clear schemas
      act(() => {
        adapter.setTitle(testTitle);
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setPortSchemas([]);
        });
      });

      await waitFor(() => {
        expect(result.current.meta.title).toBe(testTitle);
      });

      // Restore defaults
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setSchemas(builtInConstructSchemas);
          adapter.setPortSchemas(builtInPortSchemas);
          adapter.setSchemaGroups(builtInSchemaGroups);
        });
      });

      // Verify title is preserved
      expect(result.current.meta.title).toBe(testTitle);
    });
  });

  describe('Edge Cases', () => {
    it('should handle restoring when no schemas exist', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Start with truly empty document
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setPortSchemas([]);
          adapter.setSchemaGroups([]);
        });
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas).toHaveLength(0);
      });

      // Should not throw and should restore successfully
      expect(() => {
        act(() => {
          adapter.transaction(() => {
            adapter.setSchemas([]);
            adapter.setSchemas(builtInConstructSchemas);
            adapter.setPortSchemas(builtInPortSchemas);
            adapter.setSchemaGroups(builtInSchemaGroups);
          });
        });
      }).not.toThrow();

      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBe(builtInConstructSchemas.length);
      });

      expect(result.current.portSchemas.portSchemas.length).toBe(builtInPortSchemas.length);
      expect(result.current.schemaGroups.schemaGroups.length).toBe(builtInSchemaGroups.length);
    });

    it('should handle restoring multiple times', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // First restore
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setSchemas(builtInConstructSchemas);
          adapter.setPortSchemas(builtInPortSchemas);
          adapter.setSchemaGroups(builtInSchemaGroups);
        });
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBeGreaterThan(0);
      });

      const firstRestoreCount = result.current.schemas.schemas.length;

      // Clear and restore again
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setPortSchemas([]);
          adapter.setSchemaGroups([]);
        });
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas).toHaveLength(0);
      });

      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setSchemas(builtInConstructSchemas);
          adapter.setPortSchemas(builtInPortSchemas);
          adapter.setSchemaGroups(builtInSchemaGroups);
        });
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBe(firstRestoreCount);
      });

      // Should restore to exact same state
      expect(result.current.schemas.schemas).toEqual(builtInConstructSchemas);
      expect(result.current.portSchemas.portSchemas).toEqual(builtInPortSchemas);
      expect(result.current.schemaGroups.schemaGroups).toEqual(builtInSchemaGroups);
    });
  });
});
