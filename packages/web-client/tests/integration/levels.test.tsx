/**
 * Test: Levels System
 *
 * Verifies the core user-facing level behaviors:
 * - Default "Main" level exists on init
 * - Create, switch, rename, delete levels
 * - Level isolation: nodes/edges/deployables are per-level
 * - Schemas are shared across levels
 * - Duplicate level deep-copies content
 * - Copy nodes to another level
 * - Clear document respects levels
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocument } from '../../src/hooks/useDocument';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { createTestNode, createTestEdge } from '../setup/testHelpers';

function useTestHarness() {
  return {
    document: useDocument(),
    context: useDocumentContext(),
  };
}

async function setup() {
  const { result } = renderHook(() => useTestHarness(), { wrapper: TestProviders });
  await waitFor(() => {
    expect(result.current.context.isReady).toBe(true);
  });
  return result;
}

describe('Levels', () => {
  describe('Initialization', () => {
    it('should create a default "Main" level on init', async () => {
      const result = await setup();

      expect(result.current.document.levels).toHaveLength(1);
      expect(result.current.document.levels[0].name).toBe('Main');
      expect(result.current.document.activeLevel).toBe(result.current.document.levels[0].id);
    });
  });

  describe('Create and Switch', () => {
    it('should create a new level and switch to it', async () => {
      const result = await setup();

      act(() => {
        result.current.document.createLevel('Level 2');
      });

      await waitFor(() => {
        expect(result.current.document.levels).toHaveLength(2);
      });

      const newLevel = result.current.document.levels.find(l => l.name === 'Level 2');
      expect(newLevel).toBeDefined();

      // Switch to the new level
      act(() => {
        result.current.document.setActiveLevel(newLevel!.id);
      });

      await waitFor(() => {
        expect(result.current.document.activeLevel).toBe(newLevel!.id);
      });
    });
  });

  describe('Level Isolation', () => {
    it('should keep nodes independent between levels', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const level1Id = result.current.document.levels[0].id;

      // Add nodes to level 1
      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
          createTestNode({ id: 'n2', type: 'Task', semanticId: 'task-2' }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(2);
      });

      // Create level 2 and switch to it
      let level2Id: string;
      act(() => {
        const l2 = result.current.document.createLevel('Level 2');
        level2Id = l2.id;
        result.current.document.setActiveLevel(l2.id);
      });

      await waitFor(() => {
        expect(result.current.document.activeLevel).not.toBe(level1Id);
      });

      // Level 2 should have no nodes
      expect(result.current.document.nodes).toHaveLength(0);

      // Add a different node to level 2
      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'n3', type: 'Service', semanticId: 'service-1' }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(1);
      });

      // Switch back to level 1 — should still have 2 nodes
      act(() => {
        result.current.document.setActiveLevel(level1Id);
      });

      await waitFor(() => {
        expect(result.current.document.activeLevel).toBe(level1Id);
      });

      expect(result.current.document.nodes).toHaveLength(2);
    });

    it('should keep edges independent between levels', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const level1Id = result.current.document.levels[0].id;

      // Add nodes + edge to level 1
      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'a', type: 'Task' }),
          createTestNode({ id: 'b', type: 'Task' }),
        ]);
        adapter.setEdges([createTestEdge({ source: 'a', target: 'b' })]);
      });

      await waitFor(() => {
        expect(result.current.document.edges).toHaveLength(1);
      });

      // Create level 2 and switch
      act(() => {
        const l2 = result.current.document.createLevel('Level 2');
        result.current.document.setActiveLevel(l2.id);
      });

      await waitFor(() => {
        expect(result.current.document.activeLevel).not.toBe(level1Id);
      });

      expect(result.current.document.edges).toHaveLength(0);
    });

    it('should keep deployables independent between levels', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const level1Id = result.current.document.levels[0].id;

      act(() => {
        adapter.addDeployable({ name: 'Deploy A', description: 'desc', color: '#ff0000' });
      });

      await waitFor(() => {
        expect(result.current.document.deployables).toHaveLength(1);
      });

      act(() => {
        const l2 = result.current.document.createLevel('Level 2');
        result.current.document.setActiveLevel(l2.id);
      });

      await waitFor(() => {
        expect(result.current.document.activeLevel).not.toBe(level1Id);
      });

      expect(result.current.document.deployables).toHaveLength(0);
    });

    it('should share schemas across levels', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      // Add schema on level 1
      act(() => {
        adapter.addSchema({
          type: 'SharedType',
          displayName: 'Shared',
          color: '#aabbcc',
          fields: [{ name: 'name', type: 'string', displayTier: 'pill' }],
          compilation: { template: '{{name}}' },
          ports: [],
        });
      });

      await waitFor(() => {
        expect(result.current.document.schemas.find(s => s.type === 'SharedType')).toBeDefined();
      });

      // Switch to level 2
      act(() => {
        const l2 = result.current.document.createLevel('Level 2');
        result.current.document.setActiveLevel(l2.id);
      });

      // Schema should still be visible
      await waitFor(() => {
        expect(result.current.document.schemas.find(s => s.type === 'SharedType')).toBeDefined();
      });
    });
  });

  describe('Rename Level', () => {
    it('should rename a level', async () => {
      const result = await setup();

      const levelId = result.current.document.levels[0].id;

      act(() => {
        result.current.document.updateLevel(levelId, { name: 'Renamed' });
      });

      await waitFor(() => {
        expect(result.current.document.levels[0].name).toBe('Renamed');
      });
    });
  });

  describe('Delete Level', () => {
    it('should delete a level and switch active if needed', async () => {
      const result = await setup();

      const level1Id = result.current.document.levels[0].id;

      // Create second level
      let level2Id: string;
      act(() => {
        const l2 = result.current.document.createLevel('Level 2');
        level2Id = l2.id;
      });

      await waitFor(() => {
        expect(result.current.document.levels).toHaveLength(2);
      });

      // Switch to level 2 and delete it
      act(() => {
        result.current.document.setActiveLevel(level2Id!);
      });

      act(() => {
        result.current.document.deleteLevel(level2Id!);
      });

      await waitFor(() => {
        expect(result.current.document.levels).toHaveLength(1);
      });

      // Should have auto-switched to remaining level
      expect(result.current.document.activeLevel).toBe(level1Id);
    });

    it('should not delete the last remaining level', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const levelId = result.current.document.levels[0].id;

      act(() => {
        adapter.deleteLevel(levelId);
      });

      // Still has one level
      expect(result.current.document.levels).toHaveLength(1);
    });
  });

  describe('Duplicate Level', () => {
    it('should deep-copy nodes and edges into a new level', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const level1Id = result.current.document.levels[0].id;

      // Add content to level 1
      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'x1', type: 'Task', semanticId: 'task-x' }),
          createTestNode({ id: 'x2', type: 'Task', semanticId: 'task-y' }),
        ]);
        adapter.setEdges([createTestEdge({ source: 'x1', target: 'x2' })]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(2);
      });

      // Duplicate
      let dupLevel: { id: string };
      act(() => {
        dupLevel = result.current.document.duplicateLevel(level1Id, 'Copy of Main');
      });

      await waitFor(() => {
        expect(result.current.document.levels).toHaveLength(2);
      });

      // Switch to duplicate
      act(() => {
        result.current.document.setActiveLevel(dupLevel!.id);
      });

      await waitFor(() => {
        expect(result.current.document.activeLevel).toBe(dupLevel!.id);
      });

      // Should have same number of nodes/edges but different IDs
      expect(result.current.document.nodes).toHaveLength(2);
      expect(result.current.document.edges).toHaveLength(1);

      // Node IDs should differ from originals
      const dupNodeIds = result.current.document.nodes.map(n => n.id);
      expect(dupNodeIds).not.toContain('x1');
      expect(dupNodeIds).not.toContain('x2');
    });
  });

  describe('Copy Nodes to Level', () => {
    it('should copy selected nodes and connecting edges to another level', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const level1Id = result.current.document.levels[0].id;

      // Set up nodes and edge
      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'c1', type: 'Task' }),
          createTestNode({ id: 'c2', type: 'Task' }),
          createTestNode({ id: 'c3', type: 'Task' }),
        ]);
        adapter.setEdges([
          createTestEdge({ source: 'c1', target: 'c2' }),
          createTestEdge({ source: 'c2', target: 'c3' }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(3);
      });

      // Create target level
      let level2Id: string;
      act(() => {
        const l2 = result.current.document.createLevel('Target');
        level2Id = l2.id;
      });

      // Copy c1 and c2 (and their connecting edge) to level 2
      act(() => {
        adapter.copyNodesToLevel(['c1', 'c2'], level2Id!);
      });

      // Switch to target level
      act(() => {
        result.current.document.setActiveLevel(level2Id!);
      });

      await waitFor(() => {
        expect(result.current.document.activeLevel).toBe(level2Id!);
      });

      // Should have 2 nodes and 1 edge (c1-c2 only, not c2-c3)
      expect(result.current.document.nodes).toHaveLength(2);
      expect(result.current.document.edges).toHaveLength(1);

      // Original level should be unchanged
      act(() => {
        result.current.document.setActiveLevel(level1Id);
      });

      await waitFor(() => {
        expect(result.current.document.activeLevel).toBe(level1Id);
      });

      expect(result.current.document.nodes).toHaveLength(3);
      expect(result.current.document.edges).toHaveLength(2);
    });
  });

  describe('Clear Document with Levels', () => {
    it('should clear only active level nodes/edges when clearing instances', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const level1Id = result.current.document.levels[0].id;

      // Add content to level 1
      act(() => {
        adapter.setNodes([createTestNode({ id: 'z1', type: 'Task' })]);
        adapter.setEdges([]);
      });

      // Create level 2 with content
      let level2Id: string;
      act(() => {
        const l2 = result.current.document.createLevel('Level 2');
        level2Id = l2.id;
        adapter.setActiveLevel(l2.id);
      });

      act(() => {
        adapter.setNodes([createTestNode({ id: 'z2', type: 'Service' })]);
      });

      // Switch back to level 1 and clear instances
      act(() => {
        adapter.setActiveLevel(level1Id);
      });

      act(() => {
        adapter.transaction(() => {
          adapter.setNodes([]);
          adapter.setEdges([]);
        });
      });

      await waitFor(() => {
        expect(result.current.document.nodes).toHaveLength(0);
      });

      // Level 2 should still have its node
      act(() => {
        adapter.setActiveLevel(level2Id!);
      });

      await waitFor(() => {
        expect(result.current.document.activeLevel).toBe(level2Id!);
      });

      expect(result.current.document.nodes).toHaveLength(1);
    });

    it('should clear all levels and reset to one Main when clearing everything', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      // Add content to level 1
      act(() => {
        adapter.setNodes([createTestNode({ id: 'q1', type: 'Task' })]);
        adapter.addSchema({
          type: 'Custom',
          displayName: 'Custom',
          color: '#000',
          fields: [{ name: 'name', type: 'string', displayTier: 'pill' }],
          compilation: { template: '{{name}}' },
          ports: [],
        });
      });

      // Create level 2
      act(() => {
        const l2 = result.current.document.createLevel('Level 2');
        adapter.setActiveLevel(l2.id);
        adapter.setNodes([createTestNode({ id: 'q2', type: 'Service' })]);
      });

      await waitFor(() => {
        expect(result.current.document.levels).toHaveLength(2);
      });

      // Clear everything (mirrors useClearDocument 'all' mode)
      act(() => {
        adapter.transaction(() => {
          const levels = adapter.getLevels();
          for (const level of levels) {
            adapter.setActiveLevel(level.id);
            adapter.setNodes([]);
            adapter.setEdges([]);
            adapter.setDeployables([]);
          }
          if (levels.length > 1) {
            const firstLevel = levels[0];
            for (let i = 1; i < levels.length; i++) {
              adapter.deleteLevel(levels[i].id);
            }
            adapter.updateLevel(firstLevel.id, { name: 'Main' });
            adapter.setActiveLevel(firstLevel.id);
          }
          adapter.setSchemas([]);
          adapter.setPortSchemas([]);
          adapter.setSchemaGroups([]);
        });
      });

      await waitFor(() => {
        expect(result.current.document.levels).toHaveLength(1);
      });

      expect(result.current.document.levels[0].name).toBe('Main');
      expect(result.current.document.nodes).toHaveLength(0);
      expect(result.current.document.schemas).toHaveLength(0);
    });
  });
});
