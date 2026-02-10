/**
 * Test: Pages System
 *
 * Verifies the core user-facing page behaviors:
 * - Default "Main" page exists on init
 * - Create, switch, rename, delete pages
 * - Page isolation: nodes/edges are per-page
 * - Schemas are shared across pages
 * - Duplicate page deep-copies content
 * - Copy nodes to another page
 * - Clear document respects pages
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNodes } from '../../src/hooks/useNodes';
import { useEdges } from '../../src/hooks/useEdges';
import { useSchemas } from '../../src/hooks/useSchemas';
import { usePages } from '../../src/hooks/usePages';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { TestProviders } from '../setup/testProviders';
import { createTestNode, createTestEdge } from '../setup/testHelpers';

function useTestHarness() {
  return {
    nodes: useNodes(),
    edges: useEdges(),
    schemas: useSchemas(),
    pages: usePages(),
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

describe('Pages', () => {
  describe('Initialization', () => {
    it('should create a default "Main" page on init', async () => {
      const result = await setup();

      expect(result.current.pages.pages).toHaveLength(1);
      expect(result.current.pages.pages[0].name).toBe('Main');
      expect(result.current.pages.activePage).toBe(result.current.pages.pages[0].id);
    });
  });

  describe('Create and Switch', () => {
    it('should create a new page and switch to it', async () => {
      const result = await setup();

      act(() => {
        result.current.pages.createPage('Page 2');
      });

      await waitFor(() => {
        expect(result.current.pages.pages).toHaveLength(2);
      });

      const newPage = result.current.pages.pages.find(l => l.name === 'Page 2');
      expect(newPage).toBeDefined();

      // Switch to the new page
      act(() => {
        result.current.pages.setActivePage(newPage!.id);
      });

      await waitFor(() => {
        expect(result.current.pages.activePage).toBe(newPage!.id);
      });
    });
  });

  describe('Page Isolation', () => {
    it('should keep nodes independent between pages', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const page1Id = result.current.pages.pages[0].id;

      // Add nodes to page 1
      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'n1', type: 'Task', semanticId: 'task-1' }),
          createTestNode({ id: 'n2', type: 'Task', semanticId: 'task-2' }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      // Create page 2 and switch to it
      let page2Id: string;
      act(() => {
        const p2 = result.current.pages.createPage('Page 2');
        page2Id = p2.id;
        result.current.pages.setActivePage(p2.id);
      });

      await waitFor(() => {
        expect(result.current.pages.activePage).not.toBe(page1Id);
      });

      // Page 2 should have no nodes
      expect(result.current.nodes.nodes).toHaveLength(0);

      // Add a different node to page 2
      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'n3', type: 'Service', semanticId: 'service-1' }),
        ]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(1);
      });

      // Switch back to page 1 — should still have 2 nodes
      act(() => {
        result.current.pages.setActivePage(page1Id);
      });

      await waitFor(() => {
        expect(result.current.pages.activePage).toBe(page1Id);
      });

      expect(result.current.nodes.nodes).toHaveLength(2);
    });

    it('should keep edges independent between pages', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const page1Id = result.current.pages.pages[0].id;

      // Add nodes + edge to page 1
      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'a', type: 'Task' }),
          createTestNode({ id: 'b', type: 'Task' }),
        ]);
        adapter.setEdges([createTestEdge({ source: 'a', target: 'b' })]);
      });

      await waitFor(() => {
        expect(result.current.edges.edges).toHaveLength(1);
      });

      // Create page 2 and switch
      act(() => {
        const p2 = result.current.pages.createPage('Page 2');
        result.current.pages.setActivePage(p2.id);
      });

      await waitFor(() => {
        expect(result.current.pages.activePage).not.toBe(page1Id);
      });

      expect(result.current.edges.edges).toHaveLength(0);
    });

    it('should share schemas across pages', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      // Add schema on page 1
      act(() => {
        adapter.addSchema({
          type: 'SharedType',
          displayName: 'Shared',
          color: '#aabbcc',
          fields: [{ name: 'name', type: 'string', displayTier: 'marker' }],
          compilation: { template: '{{name}}' },
          ports: [],
        });
      });

      await waitFor(() => {
        expect(result.current.schemas.schemas.find(s => s.type === 'SharedType')).toBeDefined();
      });

      // Switch to page 2
      act(() => {
        const p2 = result.current.pages.createPage('Page 2');
        result.current.pages.setActivePage(p2.id);
      });

      // Schema should still be visible
      await waitFor(() => {
        expect(result.current.schemas.schemas.find(s => s.type === 'SharedType')).toBeDefined();
      });
    });
  });

  describe('Rename Page', () => {
    it('should rename a page', async () => {
      const result = await setup();

      const pageId = result.current.pages.pages[0].id;

      act(() => {
        result.current.pages.updatePage(pageId, { name: 'Renamed' });
      });

      await waitFor(() => {
        expect(result.current.pages.pages[0].name).toBe('Renamed');
      });
    });
  });

  describe('Delete Page', () => {
    it('should delete a page and switch active if needed', async () => {
      const result = await setup();

      const page1Id = result.current.pages.pages[0].id;

      // Create second page
      let page2Id: string;
      act(() => {
        const p2 = result.current.pages.createPage('Page 2');
        page2Id = p2.id;
      });

      await waitFor(() => {
        expect(result.current.pages.pages).toHaveLength(2);
      });

      // Switch to page 2 and delete it
      act(() => {
        result.current.pages.setActivePage(page2Id!);
      });

      act(() => {
        result.current.pages.deletePage(page2Id!);
      });

      await waitFor(() => {
        expect(result.current.pages.pages).toHaveLength(1);
      });

      // Should have auto-switched to remaining page
      expect(result.current.pages.activePage).toBe(page1Id);
    });

    it('should not delete the last remaining page', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const pageId = result.current.pages.pages[0].id;

      act(() => {
        adapter.deletePage(pageId);
      });

      // Still has one page
      expect(result.current.pages.pages).toHaveLength(1);
    });
  });

  describe('Duplicate Page', () => {
    it('should deep-copy nodes and edges into a new page', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const page1Id = result.current.pages.pages[0].id;

      // Add content to page 1
      act(() => {
        adapter.setNodes([
          createTestNode({ id: 'x1', type: 'Task', semanticId: 'task-x' }),
          createTestNode({ id: 'x2', type: 'Task', semanticId: 'task-y' }),
        ]);
        adapter.setEdges([createTestEdge({ source: 'x1', target: 'x2' })]);
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(2);
      });

      // Duplicate
      let dupPage: { id: string };
      act(() => {
        dupPage = result.current.pages.duplicatePage(page1Id, 'Copy of Main');
      });

      await waitFor(() => {
        expect(result.current.pages.pages).toHaveLength(2);
      });

      // Switch to duplicate
      act(() => {
        result.current.pages.setActivePage(dupPage!.id);
      });

      await waitFor(() => {
        expect(result.current.pages.activePage).toBe(dupPage!.id);
      });

      // Should have same number of nodes/edges but different IDs
      expect(result.current.nodes.nodes).toHaveLength(2);
      expect(result.current.edges.edges).toHaveLength(1);

      // Node IDs should differ from originals
      const dupNodeIds = result.current.nodes.nodes.map(n => n.id);
      expect(dupNodeIds).not.toContain('x1');
      expect(dupNodeIds).not.toContain('x2');
    });
  });

  describe('Copy Nodes to Page', () => {
    it('should copy selected nodes and connecting edges to another page', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const page1Id = result.current.pages.pages[0].id;

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
        expect(result.current.nodes.nodes).toHaveLength(3);
      });

      // Create target page
      let page2Id: string;
      act(() => {
        const p2 = result.current.pages.createPage('Target');
        page2Id = p2.id;
      });

      // Copy c1 and c2 (and their connecting edge) to page 2
      act(() => {
        adapter.copyNodesToPage(['c1', 'c2'], page2Id!);
      });

      // Switch to target page
      act(() => {
        result.current.pages.setActivePage(page2Id!);
      });

      await waitFor(() => {
        expect(result.current.pages.activePage).toBe(page2Id!);
      });

      // Should have 2 nodes and 1 edge (c1-c2 only, not c2-c3)
      expect(result.current.nodes.nodes).toHaveLength(2);
      expect(result.current.edges.edges).toHaveLength(1);

      // Original page should be unchanged
      act(() => {
        result.current.pages.setActivePage(page1Id);
      });

      await waitFor(() => {
        expect(result.current.pages.activePage).toBe(page1Id);
      });

      expect(result.current.nodes.nodes).toHaveLength(3);
      expect(result.current.edges.edges).toHaveLength(2);
    });
  });

  describe('Clear Document with Pages', () => {
    it('should clear only active page nodes/edges when clearing instances', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      const page1Id = result.current.pages.pages[0].id;

      // Add content to page 1
      act(() => {
        adapter.setNodes([createTestNode({ id: 'z1', type: 'Task' })]);
        adapter.setEdges([]);
      });

      // Create page 2 with content
      let page2Id: string;
      act(() => {
        const p2 = result.current.pages.createPage('Page 2');
        page2Id = p2.id;
        adapter.setActivePage(p2.id);
      });

      act(() => {
        adapter.setNodes([createTestNode({ id: 'z2', type: 'Service' })]);
      });

      // Switch back to page 1 and clear instances
      act(() => {
        adapter.setActivePage(page1Id);
      });

      act(() => {
        adapter.transaction(() => {
          adapter.setNodes([]);
          adapter.setEdges([]);
        });
      });

      await waitFor(() => {
        expect(result.current.nodes.nodes).toHaveLength(0);
      });

      // Page 2 should still have its node
      act(() => {
        adapter.setActivePage(page2Id!);
      });

      await waitFor(() => {
        expect(result.current.pages.activePage).toBe(page2Id!);
      });

      expect(result.current.nodes.nodes).toHaveLength(1);
    });

    it('should clear all pages and reset to one Main when clearing everything', async () => {
      const result = await setup();
      const { adapter } = result.current.context;

      // Add content to page 1
      act(() => {
        adapter.setNodes([createTestNode({ id: 'q1', type: 'Task' })]);
        adapter.addSchema({
          type: 'Custom',
          displayName: 'Custom',
          color: '#000',
          fields: [{ name: 'name', type: 'string', displayTier: 'marker' }],
          compilation: { template: '{{name}}' },
          ports: [],
        });
      });

      // Create page 2
      act(() => {
        const p2 = result.current.pages.createPage('Page 2');
        adapter.setActivePage(p2.id);
        adapter.setNodes([createTestNode({ id: 'q2', type: 'Service' })]);
      });

      await waitFor(() => {
        expect(result.current.pages.pages).toHaveLength(2);
      });

      // Clear everything (mirrors useClearDocument 'all' mode)
      act(() => {
        adapter.transaction(() => {
          const pages = adapter.getPages();
          for (const page of pages) {
            adapter.setActivePage(page.id);
            adapter.setNodes([]);
            adapter.setEdges([]);
          }
          if (pages.length > 1) {
            const firstPage = pages[0];
            for (let i = 1; i < pages.length; i++) {
              adapter.deletePage(pages[i].id);
            }
            adapter.updatePage(firstPage.id, { name: 'Main' });
            adapter.setActivePage(firstPage.id);
          }
          adapter.setSchemas([]);
          adapter.setPortSchemas([]);
          adapter.setSchemaGroups([]);
        });
      });

      await waitFor(() => {
        expect(result.current.pages.pages).toHaveLength(1);
      });

      expect(result.current.pages.pages[0].name).toBe('Main');
      expect(result.current.nodes.nodes).toHaveLength(0);
      expect(result.current.schemas.schemas).toHaveLength(0);
    });
  });
});
