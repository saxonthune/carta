import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { createPage, listPages, updatePage, deletePage, flowLayout, createConstruct, connect } from '../src/doc-operations';

describe('page operations', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
  });

  it('should create a page and list it', () => {
    const page = createPage(doc, 'Test Page', 'Test description');
    expect(page.name).toBe('Test Page');
    expect(page.description).toBe('Test description');
    expect(page.order).toBe(0);

    const pages = listPages(doc);
    expect(pages.length).toBe(1);
    expect(pages[0]?.id).toBe(page.id);
    expect(pages[0]?.name).toBe('Test Page');
  });

  it('should delete a page', () => {
    const page1 = createPage(doc, 'Page 1');
    const page2 = createPage(doc, 'Page 2');

    const pages = listPages(doc);
    expect(pages.length).toBe(2);

    const deleted = deletePage(doc, page1.id);
    expect(deleted).toBe(true);

    const remainingPages = listPages(doc);
    expect(remainingPages.length).toBe(1);
    expect(remainingPages[0]?.id).toBe(page2.id);
  });

  it('should update page name', () => {
    const page = createPage(doc, 'Original Name');

    const updated = updatePage(doc, page.id, { name: 'Updated Name' });
    expect(updated).not.toBeNull();
    expect(updated?.name).toBe('Updated Name');

    const pages = listPages(doc);
    expect(pages[0]?.name).toBe('Updated Name');
  });

  it('should not delete the last page', () => {
    const page = createPage(doc, 'Only Page');

    const deleted = deletePage(doc, page.id);
    expect(deleted).toBe(false);

    const pages = listPages(doc);
    expect(pages.length).toBe(1);
  });
});

describe('flowLayout operation', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
  });

  it('should apply layout to page with nodes', () => {
    // Create three nodes in a chain
    const nodeA = createConstruct(doc, pageId, 'service', {}, { x: 0, y: 0 });
    const nodeB = createConstruct(doc, pageId, 'service', {}, { x: 0, y: 0 });
    const nodeC = createConstruct(doc, pageId, 'service', {}, { x: 0, y: 0 });

    // Connect them: A -> B -> C
    connect(doc, pageId, nodeA.data.semanticId, 'flow-out', nodeB.data.semanticId, 'flow-in');
    connect(doc, pageId, nodeB.data.semanticId, 'flow-out', nodeC.data.semanticId, 'flow-in');

    // Apply flow layout
    const result = flowLayout(doc, pageId, {
      direction: 'TB',
    });

    expect(result.updated).toBe(3);
    expect(result.layers).toBeDefined();

    // Verify nodes have been positioned (layer 0 should have nodeA)
    expect(result.layers[nodeA.id]).toBe(0);
    expect(result.layers[nodeB.id]).toBe(1);
    expect(result.layers[nodeC.id]).toBe(2);
  });

  it('should handle empty page', () => {
    // Apply flow layout to empty page
    const result = flowLayout(doc, pageId, {
      direction: 'TB',
    });

    expect(result.updated).toBe(0);
    expect(Object.keys(result.layers).length).toBe(0);
  });

  it('should preserve centroid when laying out nodes', () => {
    // Create nodes centered around (500, 500)
    const nodeA = createConstruct(doc, pageId, 'service', {}, { x: 500, y: 500 });
    const nodeB = createConstruct(doc, pageId, 'service', {}, { x: 500, y: 500 });

    // Connect them
    connect(doc, pageId, nodeA.data.semanticId, 'flow-out', nodeB.data.semanticId, 'flow-in');

    // Apply flow layout
    const result = flowLayout(doc, pageId, {
      direction: 'TB',
    });

    expect(result.updated).toBe(2);

    // Note: We can't directly verify positions from the return value,
    // but we can verify the operation completed successfully
    // The actual centroid preservation is tested in the domain flowLayout tests
  });

  it('should handle nodes with no connections', () => {
    // Create isolated nodes
    createConstruct(doc, pageId, 'service', {}, { x: 100, y: 100 });
    createConstruct(doc, pageId, 'service', {}, { x: 200, y: 200 });

    // Apply flow layout
    const result = flowLayout(doc, pageId, {
      direction: 'TB',
    });

    expect(result.updated).toBe(2);
  });
});
