/**
 * Test: Settings -> Restore Default Schemas
 *
 * Verifies that restoring default schemas correctly restores:
 * - Built-in construct schemas
 * - Built-in port schemas
 * - Built-in schema groups
 *
 * This is an integration test that exercises:
 * - Document adapter (Yjs)
 * - useDocument hook
 * - Schema restoration functionality from App.tsx
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNodes } from '../../src/hooks/useNodes';
import { useEdges } from '../../src/hooks/useEdges';
import { useSchemas } from '../../src/hooks/useSchemas';
import { usePortSchemas } from '../../src/hooks/usePortSchemas';
import { useSchemaGroups } from '../../src/hooks/useSchemaGroups';
import { useDeployables } from '../../src/hooks/useDeployables';
import { useDocumentMeta } from '../../src/hooks/useDocumentMeta';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import {
  builtInConstructSchemas,
  builtInPortSchemas,
  builtInSchemaGroups
} from '@carta/domain';

describe('Restore Default Schemas', () => {
  describe('Restore All Built-ins', () => {
    it('should restore all built-in construct schemas', async () => {
      // Arrange: Set up a document with custom schemas only
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          deployables: useDeployables(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Start with a clean slate
      act(() => {
        adapter.setSchemas([]);
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas).toHaveLength(0);
      });

      // Add a custom schema
      act(() => {
        adapter.addSchema({
          type: 'CustomType',
          fields: [{ name: 'name', type: 'string', displayTier: 'pill' }],
          ports: [],
        });
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas).toHaveLength(1);
      });

      expect(result.current.schemas.schemas[0].type).toBe('CustomType');

      // Act: Restore default schemas (simulating handleRestoreDefaultSchemas)
      act(() => {
        adapter.transaction(() => {
          // Clear and restore construct schemas
          adapter.setSchemas(builtInConstructSchemas);
        });
      });

      // Assert: All built-in schemas are restored
      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBeGreaterThan(0);
      });

      expect(result.current.schemas.schemas.length).toBe(builtInConstructSchemas.length);

      // Verify some key built-in schemas are present
      const schemaTypes = result.current.schemas.schemas.map(s => s.type);
      expect(schemaTypes).toContain('rest-endpoint');
      expect(schemaTypes).toContain('database');
      expect(schemaTypes).toContain('table');
      expect(schemaTypes).toContain('user-story');

      // Custom schema should be gone (replaced, not merged)
      expect(schemaTypes).not.toContain('CustomType');
    });

    it('should restore all built-in port schemas', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          deployables: useDeployables(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Start with empty port schemas
      act(() => {
        adapter.setPortSchemas([]);
      });

      await waitFor(() => {
        expect(result.current.portSchemas.portSchemas).toHaveLength(0);
      });

      // Add a custom port schema
      act(() => {
        adapter.addPortSchema({
          id: 'custom-port',
          displayName: 'Custom Port',
          semanticDescription: 'A custom port type',
          polarity: 'source',
          compatibleWith: ['*'],
          color: '#ff00ff',
        });
      });

      await waitFor(() => {
        expect(result.current.portSchemas.portSchemas).toHaveLength(1);
      });

      // Act: Restore default port schemas
      act(() => {
        adapter.setPortSchemas(builtInPortSchemas);
      });

      // Assert: All built-in port schemas are restored
      await waitFor(() => {
        expect(result.current.portSchemas.portSchemas.length).toBe(builtInPortSchemas.length);
      });

      // Verify key built-in port schemas
      const portIds = result.current.portSchemas.portSchemas.map(p => p.id);
      expect(portIds).toContain('flow-in');
      expect(portIds).toContain('flow-out');
      expect(portIds).toContain('parent');
      expect(portIds).toContain('child');
      expect(portIds).toContain('symmetric');
      expect(portIds).toContain('intercept');
      expect(portIds).toContain('relay');

      // Custom port should be gone
      expect(portIds).not.toContain('custom-port');
    });

    it('should restore all built-in schema groups', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          deployables: useDeployables(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Start with empty schema groups
      act(() => {
        adapter.setSchemaGroups([]);
      });

      await waitFor(() => {
        expect(result.current.schemaGroups.schemaGroups).toHaveLength(0);
      });

      // Add a custom group
      act(() => {
        adapter.addSchemaGroup({
          name: 'Custom Group',
          color: '#ff00ff',
        });
      });

      await waitFor(() => {
        expect(result.current.schemaGroups.schemaGroups).toHaveLength(1);
      });

      // Act: Restore default schema groups
      act(() => {
        adapter.setSchemaGroups(builtInSchemaGroups);
      });

      // Assert: All built-in schema groups are restored
      await waitFor(() => {
        expect(result.current.schemaGroups.schemaGroups.length).toBe(builtInSchemaGroups.length);
      });

      // Verify key built-in groups
      const groupIds = result.current.schemaGroups.schemaGroups.map(g => g.id);
      expect(groupIds).toContain('software-architecture');
      expect(groupIds).toContain('database');
      expect(groupIds).toContain('api');
      expect(groupIds).toContain('ui');

      // Custom group should be gone
      expect(result.current.schemaGroups.schemaGroups.every(g => g.name !== 'Custom Group')).toBe(true);
    });

    it('should restore all defaults in a single transaction', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          deployables: useDeployables(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Clear everything
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

      expect(result.current.portSchemas.portSchemas).toHaveLength(0);
      expect(result.current.schemaGroups.schemaGroups).toHaveLength(0);

      // Act: Restore all defaults in a single transaction
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas(builtInConstructSchemas);
          adapter.setPortSchemas(builtInPortSchemas);
          adapter.setSchemaGroups(builtInSchemaGroups);
        });
      });

      // Assert: All defaults are restored
      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBe(builtInConstructSchemas.length);
      });

      expect(result.current.portSchemas.portSchemas.length).toBe(builtInPortSchemas.length);
      expect(result.current.schemaGroups.schemaGroups.length).toBe(builtInSchemaGroups.length);
    });
  });

  describe('Preservation of Instances', () => {
    it('should preserve nodes and edges when restoring schemas', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          deployables: useDeployables(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Set up document with nodes and edges
      act(() => {
        adapter.setNodes([
          {
            id: '1',
            type: 'construct',
            position: { x: 0, y: 0 },
            data: {
              constructType: 'Task',
              semanticId: 'task-1',
              values: {},
              viewLevel: 'details',
              connections: [],
            },
          },
          {
            id: '2',
            type: 'construct',
            position: { x: 200, y: 0 },
            data: {
              constructType: 'Service',
              semanticId: 'service-1',
              values: {},
              viewLevel: 'details',
              connections: [],
            },
          },
        ]);

        adapter.setEdges([
          {
            id: 'edge-1-2',
            source: '1',
            target: '2',
            sourceHandle: 'flow-out',
            targetHandle: 'flow-in',
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      expect(result.current.edges.edges).toHaveLength(1);

      // Act: Restore defaults
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas(builtInConstructSchemas);
          adapter.setPortSchemas(builtInPortSchemas);
          adapter.setSchemaGroups(builtInSchemaGroups);
        });
      });

      // Assert: Nodes and edges are preserved
      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBe(builtInConstructSchemas.length);
      });

      expect(result.current.nodes.nodes).toHaveLength(2);
      expect(result.current.edges.edges).toHaveLength(1);
    });

    it('should preserve deployables when restoring schemas', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          deployables: useDeployables(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Add a deployable
      act(() => {
        adapter.addDeployable({
          name: 'Production',
          description: 'Production environment',
          color: '#00ff00',
        });
      });

      await waitFor(() => {
        expect(adapter.getDeployables()).toHaveLength(1);
      });

      // Act: Restore defaults
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas(builtInConstructSchemas);
          adapter.setPortSchemas(builtInPortSchemas);
          adapter.setSchemaGroups(builtInSchemaGroups);
        });
      });

      // Assert: Deployable is preserved
      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBe(builtInConstructSchemas.length);
      });

      expect(adapter.getDeployables()).toHaveLength(1);
      expect(adapter.getDeployables()[0].name).toBe('Production');
    });
  });

  describe('Edge Cases', () => {
    it('should handle restoring when document already has built-in schemas', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          deployables: useDeployables(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Set up with built-in schemas already present
      act(() => {
        adapter.setSchemas(builtInConstructSchemas);
        adapter.setPortSchemas(builtInPortSchemas);
        adapter.setSchemaGroups(builtInSchemaGroups);
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBe(builtInConstructSchemas.length);
      });

      const initialSchemaCount = result.current.schemas.schemas.length;
      const initialPortSchemaCount = result.current.portSchemas.portSchemas.length;
      const initialGroupCount = result.current.schemaGroups.schemaGroups.length;

      // Act: Restore again (should be idempotent)
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas(builtInConstructSchemas);
          adapter.setPortSchemas(builtInPortSchemas);
          adapter.setSchemaGroups(builtInSchemaGroups);
        });
      });

      // Assert: No duplicates, same count
      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBe(initialSchemaCount);
      });

      expect(result.current.portSchemas.portSchemas.length).toBe(initialPortSchemaCount);
      expect(result.current.schemaGroups.schemaGroups.length).toBe(initialGroupCount);
    });

    it('should handle restoring when document has partial built-ins and custom schemas', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          deployables: useDeployables(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Set up with a mix of built-in and custom schemas
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas([
            builtInConstructSchemas[0], // One built-in
            {
              type: 'CustomType1',
              fields: [{ name: 'name', type: 'string', displayTier: 'pill' }],
              ports: [],
            },
            {
              type: 'CustomType2',
              fields: [{ name: 'title', type: 'string', displayTier: 'pill' }],
              ports: [],
            },
          ]);
        });
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas).toHaveLength(3);
      });

      // Act: Restore defaults (replaces everything)
      act(() => {
        adapter.setSchemas(builtInConstructSchemas);
      });

      // Assert: All built-ins restored, custom schemas removed
      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBe(builtInConstructSchemas.length);
      });

      const schemaTypes = result.current.schemas.schemas.map(s => s.type);
      expect(schemaTypes).not.toContain('CustomType1');
      expect(schemaTypes).not.toContain('CustomType2');
      expect(schemaTypes).toContain('rest-endpoint');
      expect(schemaTypes).toContain('database');
    });

    it('should preserve title when restoring schemas', async () => {
      const { result } = renderHook(
        () => ({
          nodes: useNodes(),
          edges: useEdges(),
          schemas: useSchemas(),
          portSchemas: usePortSchemas(),
          schemaGroups: useSchemaGroups(),
          deployables: useDeployables(),
          meta: useDocumentMeta(),
          context: useDocumentContext(),
        }),
        { wrapper: TestProviders }
      );

      await waitFor(() => {
        expect(result.current.context.isReady).toBe(true);
      });

      const { adapter } = result.current.context;

      // Set a title
      act(() => {
        adapter.setTitle('My Project');
      });

      await waitFor(() => {
        expect(result.current.meta.title).toBe('My Project');
      });

      // Act: Restore defaults
      act(() => {
        adapter.transaction(() => {
          adapter.setSchemas(builtInConstructSchemas);
          adapter.setPortSchemas(builtInPortSchemas);
          adapter.setSchemaGroups(builtInSchemaGroups);
        });
      });

      // Assert: Title is preserved
      await waitFor(() => {
        expect(result.current.schemas.schemas.length).toBe(builtInConstructSchemas.length);
      });

      expect(result.current.meta.title).toBe('My Project');
    });
  });
});
