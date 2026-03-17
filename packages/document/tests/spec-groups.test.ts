import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import {
  createPage,
  listPages,
  updatePage,
  deletePage,
  getGroupMetadata,
  setGroupMetadata,
  deleteGroupMetadata,
} from '../src/doc-operations.js';
import { extractCartaFile, hydrateYDocFromCartaFile } from '../src/file-operations.js';

describe('page group field', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
    createPage(doc, 'Default Page');
  });

  it('createPage with group parameter', () => {
    const page = createPage(doc, 'My Page', undefined, '01-context');
    expect(page.group).toBe('01-context');

    const pages = listPages(doc);
    const found = pages.find(p => p.id === page.id);
    expect(found).toBeDefined();
    expect(found!.group).toBe('01-context');
  });

  it('createPage without group has undefined group', () => {
    const page = createPage(doc, 'No Group');
    expect(page.group).toBeUndefined();

    const pages = listPages(doc);
    const found = pages.find(p => p.id === page.id);
    expect(found!.group).toBeUndefined();
  });

  it('updatePage sets group', () => {
    const page = createPage(doc, 'Page');
    const updated = updatePage(doc, page.id, { group: '02-system' });
    expect(updated).not.toBeNull();
    expect(updated!.group).toBe('02-system');

    const pages = listPages(doc);
    const found = pages.find(p => p.id === page.id);
    expect(found!.group).toBe('02-system');
  });

  it('updatePage changes group', () => {
    const page = createPage(doc, 'Page', undefined, '01-context');
    const updated = updatePage(doc, page.id, { group: '02-system' });
    expect(updated!.group).toBe('02-system');
  });

  it('updatePage removes group via null', () => {
    const page = createPage(doc, 'Page', undefined, '01-context');
    const updated = updatePage(doc, page.id, { group: null });
    expect(updated!.group).toBeUndefined();
  });

  it('updatePage with undefined group does not change it', () => {
    const page = createPage(doc, 'Page', undefined, '01-context');
    const updated = updatePage(doc, page.id, { name: 'Renamed' });
    expect(updated!.group).toBe('01-context');
    expect(updated!.name).toBe('Renamed');
  });

  it('deletePage does not need removeFromSpecGroup', () => {
    const page1 = createPage(doc, 'Page 1', undefined, '01-context');
    createPage(doc, 'Page 2');
    // deletePage should work without spec group cleanup
    const result = deletePage(doc, page1.id);
    expect(result).toBe(true);
    const pages = listPages(doc);
    expect(pages.find(p => p.id === page1.id)).toBeUndefined();
  });
});

describe('group metadata CRUD', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
  });

  it('setGroupMetadata / getGroupMetadata round-trip', () => {
    setGroupMetadata(doc, '01-context', { name: 'Context', description: 'Mission and principles' });
    const meta = getGroupMetadata(doc);
    expect(meta['01-context']).toBeDefined();
    expect(meta['01-context'].name).toBe('Context');
    expect(meta['01-context'].description).toBe('Mission and principles');
  });

  it('setGroupMetadata without description', () => {
    setGroupMetadata(doc, '02-system', { name: 'System' });
    const meta = getGroupMetadata(doc);
    expect(meta['02-system'].name).toBe('System');
    expect(meta['02-system'].description).toBeUndefined();
  });

  it('setGroupMetadata overwrites existing', () => {
    setGroupMetadata(doc, '01-context', { name: 'Old' });
    setGroupMetadata(doc, '01-context', { name: 'New', description: 'Updated' });
    const meta = getGroupMetadata(doc);
    expect(meta['01-context'].name).toBe('New');
    expect(meta['01-context'].description).toBe('Updated');
  });

  it('deleteGroupMetadata removes key', () => {
    setGroupMetadata(doc, '01-context', { name: 'Context' });
    deleteGroupMetadata(doc, '01-context');
    const meta = getGroupMetadata(doc);
    expect(meta['01-context']).toBeUndefined();
  });

  it('deleteGroupMetadata no-op for missing key', () => {
    deleteGroupMetadata(doc, 'nonexistent');
    // Should not throw
    expect(getGroupMetadata(doc)).toEqual({});
  });

  it('multiple groups', () => {
    setGroupMetadata(doc, '01-context', { name: 'Context' });
    setGroupMetadata(doc, '02-system', { name: 'System' });
    setGroupMetadata(doc, '03-product', { name: 'Product' });
    const meta = getGroupMetadata(doc);
    expect(Object.keys(meta).sort()).toEqual(['01-context', '02-system', '03-product']);
  });
});

describe('group metadata file round-trip', () => {
  it('extractCartaFile includes group on pages and groupMetadata', () => {
    const doc = new Y.Doc();
    createPage(doc, 'Default');
    const page = createPage(doc, 'My Page', undefined, '01-context');
    setGroupMetadata(doc, '01-context', { name: 'Context', description: 'Mission' });

    const file = extractCartaFile(doc);
    expect(file.groupMetadata).toBeDefined();
    expect(file.groupMetadata!['01-context']).toEqual({ name: 'Context', description: 'Mission' });

    const filePage = file.pages.find(p => p.id === page.id);
    expect(filePage).toBeDefined();
    expect(filePage!.group).toBe('01-context');
  });

  it('extractCartaFile returns undefined groupMetadata when none exist', () => {
    const doc = new Y.Doc();
    createPage(doc, 'Default');
    const file = extractCartaFile(doc);
    expect(file.groupMetadata).toBeUndefined();
  });

  it('hydrateYDocFromCartaFile restores group on pages and groupMetadata', () => {
    const doc1 = new Y.Doc();
    createPage(doc1, 'Default');
    createPage(doc1, 'My Page', undefined, '01-context');
    setGroupMetadata(doc1, '01-context', { name: 'Context', description: 'Mission' });

    const file = extractCartaFile(doc1);

    const doc2 = new Y.Doc();
    hydrateYDocFromCartaFile(doc2, file);

    const meta = getGroupMetadata(doc2);
    expect(meta['01-context']).toEqual({ name: 'Context', description: 'Mission' });

    const pages = listPages(doc2);
    const page = pages.find(p => p.name === 'My Page');
    expect(page).toBeDefined();
    expect(page!.group).toBe('01-context');
  });
});
