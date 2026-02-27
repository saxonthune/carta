import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import {
  createSpecGroup,
  getSpecGroup,
  listSpecGroups,
  updateSpecGroup,
  deleteSpecGroup,
  assignToSpecGroup,
  removeFromSpecGroup,
  createPage,
  deletePage,
  createResource,
  deleteResource,
} from '../src/doc-operations.js';
import { extractCartaFile, hydrateYDocFromCartaFile } from '../src/file-operations.js';

describe('spec group CRUD', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
    // Create at least one page so deletePage is allowed
    createPage(doc, 'Default Page');
  });

  it('createSpecGroup → getSpecGroup round-trip', () => {
    const sg = createSpecGroup(doc, 'Product Vision', 'High-level goals');
    expect(sg.id).toMatch(/^sg_/);
    expect(sg.name).toBe('Product Vision');
    expect(sg.description).toBe('High-level goals');
    expect(sg.order).toBe(0);
    expect(sg.items).toEqual([]);

    const fetched = getSpecGroup(doc, sg.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(sg.id);
    expect(fetched!.name).toBe('Product Vision');
    expect(fetched!.description).toBe('High-level goals');
  });

  it('listSpecGroups returns groups sorted by order', () => {
    const a = createSpecGroup(doc, 'Alpha');
    const b = createSpecGroup(doc, 'Beta');
    const c = createSpecGroup(doc, 'Gamma');

    const list = listSpecGroups(doc);
    expect(list.length).toBe(3);
    expect(list[0]!.id).toBe(a.id);
    expect(list[1]!.id).toBe(b.id);
    expect(list[2]!.id).toBe(c.id);
    expect(list[0]!.order).toBeLessThan(list[1]!.order);
    expect(list[1]!.order).toBeLessThan(list[2]!.order);
  });

  it('updateSpecGroup changes name, description, and order', () => {
    const sg = createSpecGroup(doc, 'Old Name');
    const updated = updateSpecGroup(doc, sg.id, {
      name: 'New Name',
      description: 'Added desc',
      order: 99,
    });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe('New Name');
    expect(updated!.description).toBe('Added desc');
    expect(updated!.order).toBe(99);

    const fetched = getSpecGroup(doc, sg.id);
    expect(fetched!.name).toBe('New Name');
    expect(fetched!.order).toBe(99);
  });

  it('deleteSpecGroup removes the group and returns correct boolean', () => {
    const sg = createSpecGroup(doc, 'To Delete');
    expect(listSpecGroups(doc).some((g) => g.id === sg.id)).toBe(true);

    const result = deleteSpecGroup(doc, sg.id);
    expect(result).toBe(true);
    expect(listSpecGroups(doc).some((g) => g.id === sg.id)).toBe(false);
    expect(getSpecGroup(doc, sg.id)).toBeUndefined();

    // Returns false for non-existent
    expect(deleteSpecGroup(doc, 'nonexistent')).toBe(false);
  });

  it('assignToSpecGroup adds item to group items', () => {
    const sg = createSpecGroup(doc, 'Group A');
    const page = createPage(doc, 'My Page');

    const updated = assignToSpecGroup(doc, sg.id, { type: 'page', id: page.id });
    expect(updated).toBeDefined();
    expect(updated!.items).toHaveLength(1);
    expect(updated!.items[0]).toEqual({ type: 'page', id: page.id });
  });

  it('single-parent invariant: reassigning removes from old group', () => {
    const groupA = createSpecGroup(doc, 'Group A');
    const groupB = createSpecGroup(doc, 'Group B');
    const page = createPage(doc, 'Shared Page');

    assignToSpecGroup(doc, groupA.id, { type: 'page', id: page.id });
    expect(getSpecGroup(doc, groupA.id)!.items).toHaveLength(1);

    assignToSpecGroup(doc, groupB.id, { type: 'page', id: page.id });

    const fetchedA = getSpecGroup(doc, groupA.id)!;
    const fetchedB = getSpecGroup(doc, groupB.id)!;
    expect(fetchedA.items.some((i) => i.id === page.id)).toBe(false);
    expect(fetchedB.items.some((i) => i.id === page.id)).toBe(true);
  });

  it('removeFromSpecGroup removes item from group and returns true', () => {
    const sg = createSpecGroup(doc, 'Group');
    const page = createPage(doc, 'Page');
    assignToSpecGroup(doc, sg.id, { type: 'page', id: page.id });

    const found = removeFromSpecGroup(doc, 'page', page.id);
    expect(found).toBe(true);
    expect(getSpecGroup(doc, sg.id)!.items).toHaveLength(0);
  });

  it('removeFromSpecGroup returns false when item not in any group', () => {
    createSpecGroup(doc, 'Group');
    const result = removeFromSpecGroup(doc, 'page', 'nonexistent-page-id');
    expect(result).toBe(false);
  });

  it('deletePage removes page reference from group items', () => {
    // Need two pages so we can delete one
    const page1 = createPage(doc, 'Page 1');
    const page2 = createPage(doc, 'Page 2');
    const sg = createSpecGroup(doc, 'Group');
    assignToSpecGroup(doc, sg.id, { type: 'page', id: page1.id });
    assignToSpecGroup(doc, sg.id, { type: 'page', id: page2.id });

    expect(getSpecGroup(doc, sg.id)!.items).toHaveLength(2);

    deletePage(doc, page1.id);
    const items = getSpecGroup(doc, sg.id)!.items;
    expect(items.some((i) => i.id === page1.id)).toBe(false);
    expect(items.some((i) => i.id === page2.id)).toBe(true);
  });

  it('deleteResource removes resource reference from group items', () => {
    const resource = createResource(doc, 'My API', 'openapi', '{}');
    const sg = createSpecGroup(doc, 'Group');
    assignToSpecGroup(doc, sg.id, { type: 'resource', id: resource.id });

    expect(getSpecGroup(doc, sg.id)!.items).toHaveLength(1);

    deleteResource(doc, resource.id);
    expect(getSpecGroup(doc, sg.id)!.items).toHaveLength(0);
  });

  it('items ordering: insertion order is preserved', () => {
    const sg = createSpecGroup(doc, 'Ordered Group');
    const pageA = createPage(doc, 'A');
    const resource = createResource(doc, 'R', 'json', '{}');
    const pageC = createPage(doc, 'C');

    assignToSpecGroup(doc, sg.id, { type: 'page', id: pageA.id });
    assignToSpecGroup(doc, sg.id, { type: 'resource', id: resource.id });
    assignToSpecGroup(doc, sg.id, { type: 'page', id: pageC.id });

    const items = getSpecGroup(doc, sg.id)!.items;
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ type: 'page', id: pageA.id });
    expect(items[1]).toEqual({ type: 'resource', id: resource.id });
    expect(items[2]).toEqual({ type: 'page', id: pageC.id });
  });

  it('updateSpecGroup items replaces ordering', () => {
    const sg = createSpecGroup(doc, 'Group');
    const pageA = createPage(doc, 'A');
    const pageB = createPage(doc, 'B');
    assignToSpecGroup(doc, sg.id, { type: 'page', id: pageA.id });
    assignToSpecGroup(doc, sg.id, { type: 'page', id: pageB.id });

    // Reverse the order via updateSpecGroup
    const updated = updateSpecGroup(doc, sg.id, {
      items: [
        { type: 'page', id: pageB.id },
        { type: 'page', id: pageA.id },
      ],
    });
    expect(updated!.items[0]!.id).toBe(pageB.id);
    expect(updated!.items[1]!.id).toBe(pageA.id);

    const fetched = getSpecGroup(doc, sg.id)!;
    expect(fetched.items[0]!.id).toBe(pageB.id);
  });
});

describe('spec group file round-trip', () => {
  it('extractCartaFile → hydrateYDocFromCartaFile preserves spec groups', () => {
    const doc1 = new Y.Doc();
    createPage(doc1, 'Default');
    const page = createPage(doc1, 'My Page');
    const resource = createResource(doc1, 'API', 'openapi', 'openapi: 3.0.0');
    const sg = createSpecGroup(doc1, 'Vision', 'High level');
    assignToSpecGroup(doc1, sg.id, { type: 'page', id: page.id });
    assignToSpecGroup(doc1, sg.id, { type: 'resource', id: resource.id });

    const file = extractCartaFile(doc1);
    expect(file.specGroups).toBeDefined();
    expect(file.specGroups!.length).toBe(1);
    expect(file.specGroups![0]!.name).toBe('Vision');
    expect(file.specGroups![0]!.description).toBe('High level');
    expect(file.specGroups![0]!.items).toHaveLength(2);

    // Hydrate into a new doc and verify
    const doc2 = new Y.Doc();
    hydrateYDocFromCartaFile(doc2, file);

    const groups = listSpecGroups(doc2);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.id).toBe(sg.id);
    expect(groups[0]!.name).toBe('Vision');
    expect(groups[0]!.description).toBe('High level');
    expect(groups[0]!.items).toHaveLength(2);
    expect(groups[0]!.items[0]).toEqual({ type: 'page', id: page.id });
    expect(groups[0]!.items[1]).toEqual({ type: 'resource', id: resource.id });
  });

  it('extractCartaFile returns undefined specGroups when none exist', () => {
    const doc = new Y.Doc();
    createPage(doc, 'Default');
    const file = extractCartaFile(doc);
    expect(file.specGroups).toBeUndefined();
  });
});
