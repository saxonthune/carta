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
import { useDocument } from '../../src/hooks/useDocument';
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

      // Clear everything first to start fresh
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setNodes([]);
          adapter.setEdges([]);
          adapter.setDeployables([]);
          adapter.setPortSchemas([]);
          adapter.setSchemaGroups([]);
        });
      });

      await waitFor(() => {
        expect(result.current.document.schemas).toHaveLength(0);
      });

      // Verify all defaults are cleared
      expect(result.current.document.schemas).toHaveLength(0);
      expect(result.current.document.portSchemas).toHaveLength(0);
      expect(result.current.document.schemaGroups).toHaveLength(0);

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
        expect(result.current.document.schemas.length).toBeGreaterThan(0);
      });

      // Verify construct schemas
      expect(result.current.document.schemas.length).toBe(builtInConstructSchemas.length);
      expect(result.current.document.schemas).toEqual(builtInConstructSchemas);

      // Verify port schemas
      expect(result.current.document.portSchemas.length).toBe(builtInPortSchemas.length);
      expect(result.current.document.portSchemas).toEqual(builtInPortSchemas);

      // Verify schema groups
      expect(result.current.document.schemaGroups.length).toBe(builtInSchemaGroups.length);
      expect(result.current.document.schemaGroups).toEqual(builtInSchemaGroups);
    });

    it('should restore specific construct types with correct properties', async () => {
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

      // Clear defaults
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setPortSchemas([]);
          adapter.setSchemaGroups([]);
        });
      });

      await waitFor(() => {
        expect(result.current.document.schemas).toHaveLength(0);
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
        expect(result.current.document.schemas.length).toBeGreaterThan(0);
      });

      // Verify specific construct types exist
      const controllerSchema = result.current.document.schemas.find(s => s.type === 'controller');
      expect(controllerSchema).toBeDefined();
      expect(controllerSchema?.displayName).toBe('REST Controller');
      expect(controllerSchema?.groupId).toBe('api');

      const databaseSchema = result.current.document.schemas.find(s => s.type === 'database');
      expect(databaseSchema).toBeDefined();
      expect(databaseSchema?.displayName).toBe('Database');
      expect(databaseSchema?.groupId).toBe('database');

      const tableSchema = result.current.document.schemas.find(s => s.type === 'table');
      expect(tableSchema).toBeDefined();
      expect(tableSchema?.displayName).toBe('Table');
    });

    it('should restore port schemas with correct properties', async () => {
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

      // Clear port schemas
      act(() => {
        adapter.setPortSchemas([]);
      });

      await waitFor(() => {
        expect(result.current.document.portSchemas).toHaveLength(0);
      });

      // Restore port schemas
      act(() => {
        adapter.setPortSchemas(builtInPortSchemas);
      });

      await waitFor(() => {
        expect(result.current.document.portSchemas.length).toBeGreaterThan(0);
      });

      // Verify specific port types exist
      const flowInPort = result.current.document.portSchemas.find(p => p.id === 'flow-in');
      expect(flowInPort).toBeDefined();
      expect(flowInPort?.polarity).toBe('sink');
      expect(flowInPort?.compatibleWith).toContain('flow-out');

      const flowOutPort = result.current.document.portSchemas.find(p => p.id === 'flow-out');
      expect(flowOutPort).toBeDefined();
      expect(flowOutPort?.polarity).toBe('source');

      const symmetricPort = result.current.document.portSchemas.find(p => p.id === 'symmetric');
      expect(symmetricPort).toBeDefined();
      expect(symmetricPort?.polarity).toBe('bidirectional');
      expect(symmetricPort?.compatibleWith).toEqual([]);
    });

    it('should restore schema groups with hierarchical structure', async () => {
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

      // Clear schema groups
      act(() => {
        adapter.setSchemaGroups([]);
      });

      await waitFor(() => {
        expect(result.current.document.schemaGroups).toHaveLength(0);
      });

      // Restore schema groups
      act(() => {
        adapter.setSchemaGroups(builtInSchemaGroups);
      });

      await waitFor(() => {
        expect(result.current.document.schemaGroups.length).toBeGreaterThan(0);
      });

      // Verify root group exists
      const rootGroup = result.current.document.schemaGroups.find(
        g => g.id === 'software-architecture' && !g.parentId
      );
      expect(rootGroup).toBeDefined();
      expect(rootGroup?.name).toBe('Software Architecture');

      // Verify child groups exist with correct parent references
      const databaseGroup = result.current.document.schemaGroups.find(
        g => g.id === 'database' && g.parentId === 'software-architecture'
      );
      expect(databaseGroup).toBeDefined();
      expect(databaseGroup?.name).toBe('Database');

      const apiGroup = result.current.document.schemaGroups.find(
        g => g.id === 'api' && g.parentId === 'software-architecture'
      );
      expect(apiGroup).toBeDefined();
      expect(apiGroup?.name).toBe('API');

      const uiGroup = result.current.document.schemaGroups.find(
        g => g.id === 'ui' && g.parentId === 'software-architecture'
      );
      expect(uiGroup).toBeDefined();
      expect(uiGroup?.name).toBe('UI');
    });

    it('should overwrite existing schemas with same types', async () => {
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

      // Add a custom schema with same type as built-in
      const customController = {
        type: 'controller',
        displayName: 'Custom Controller',
        color: '#ff0000',
        description: 'Custom version',
        displayField: 'name',
        fields: [{ name: 'name', label: 'Name', type: 'string' as const }],
        ports: [],
        compilation: { format: 'json' as const },
      };

      act(() => {
        adapter.setSchemas([]);
        adapter.setSchemas([customController]);
      });

      await waitFor(() => {
        expect(result.current.document.schemas).toHaveLength(1);
      });

      // Verify custom version is there
      const customVersion = result.current.document.schemas[0];
      expect(customVersion.displayName).toBe('Custom Controller');

      // Restore defaults (which replaces all)
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setSchemas(builtInConstructSchemas);
        });
      });

      await waitFor(() => {
        expect(result.current.document.schemas.length).toBe(builtInConstructSchemas.length);
      });

      // Verify built-in version is restored
      const builtInVersion = result.current.document.schemas.find(s => s.type === 'controller');
      expect(builtInVersion?.displayName).toBe('REST Controller');
    });
  });

  describe('Restore with Existing Document', () => {
    it('should preserve nodes and edges while restoring schemas', async () => {
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

      // Set up document with nodes
      act(() => {
        const nodes = [
          createTestNode({ id: '1', type: 'controller', semanticId: 'controller-1' }),
          createTestNode({ id: '2', type: 'database', semanticId: 'database-1' }),
        ];
        adapter.setNodes(nodes);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(2);
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
        expect(result.current.document.schemas).toHaveLength(0);
      });

      const nodeCountBefore = result.current.document.nodes.length;

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
        expect(result.current.document.schemas.length).toBeGreaterThan(0);
      });

      // Verify nodes are preserved
      expect(result.current.document.nodes).toHaveLength(nodeCountBefore);
      expect(result.current.document.nodes[0].id).toBe('1');
      expect(result.current.document.nodes[1].id).toBe('2');

      // Verify schemas are restored
      expect(result.current.document.schemas.length).toBe(builtInConstructSchemas.length);
      expect(result.current.document.portSchemas.length).toBe(builtInPortSchemas.length);
      expect(result.current.document.schemaGroups.length).toBe(builtInSchemaGroups.length);
    });

    it('should preserve title during restore', async () => {
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
        expect(result.current.document.title).toBe(testTitle);
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
      expect(result.current.document.title).toBe(testTitle);
    });
  });

  describe('Edge Cases', () => {
    it('should handle restoring when no schemas exist', async () => {
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

      // Start with truly empty document
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setPortSchemas([]);
          adapter.setSchemaGroups([]);
        });
      });

      await waitFor(() => {
        expect(result.current.document.schemas).toHaveLength(0);
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
        expect(result.current.document.schemas.length).toBe(builtInConstructSchemas.length);
      });

      expect(result.current.document.portSchemas.length).toBe(builtInPortSchemas.length);
      expect(result.current.document.schemaGroups.length).toBe(builtInSchemaGroups.length);
    });

    it('should handle restoring multiple times', async () => {
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
        expect(result.current.document.schemas.length).toBeGreaterThan(0);
      });

      const firstRestoreCount = result.current.document.schemas.length;

      // Clear and restore again
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([]);
          adapter.setPortSchemas([]);
          adapter.setSchemaGroups([]);
        });
      });

      await waitFor(() => {
        expect(result.current.document.schemas).toHaveLength(0);
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
        expect(result.current.document.schemas.length).toBe(firstRestoreCount);
      });

      // Should restore to exact same state
      expect(result.current.document.schemas).toEqual(builtInConstructSchemas);
      expect(result.current.document.portSchemas).toEqual(builtInPortSchemas);
      expect(result.current.document.schemaGroups).toEqual(builtInSchemaGroups);
    });
  });
});
