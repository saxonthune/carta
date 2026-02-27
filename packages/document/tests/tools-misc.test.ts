import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { executeTool } from '../src/tools/index.js';
import { createPage, createSchema, createConstruct } from '../src/doc-operations.js';

const TEST_SCHEMA = {
  type: 'test-node',
  displayName: 'Test Node',
  color: '#aaaaaa',
  fields: [{ name: 'name', label: 'Name', type: 'string' as const }],
};

describe('port type and page summary tools', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
    createSchema(doc, TEST_SCHEMA as any);
  });

  it('list_port_types returns array with standard port types', () => {
    const result = executeTool('list_port_types', {}, doc, pageId);
    expect(result.success).toBe(true);
    const portTypes = (result.data as any).portTypes;
    expect(Array.isArray(portTypes)).toBe(true);
    expect(portTypes.length).toBeGreaterThan(0);

    const ids = portTypes.map((p: any) => p.id);
    expect(ids).toContain('flow-in');
    expect(ids).toContain('flow-out');
  });

  it('page_summary returns page/construct/schema counts', () => {
    const result = executeTool('page_summary', {}, doc, pageId);
    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(typeof data.pageCount).toBe('number');
    expect(data.pageCount).toBe(1);
    expect(typeof data.constructCount).toBe('number');
    expect(typeof data.schemaCount).toBe('number');
    expect(data.schemaCount).toBeGreaterThan(0);
  });

  it('page_summary with include=["constructs"] returns construct data', () => {
    createConstruct(doc, pageId, 'test-node', {}, { x: 0, y: 0 });

    const result = executeTool(
      'page_summary',
      { include: ['constructs'] },
      doc,
      pageId
    );
    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(Array.isArray(data.constructs)).toBe(true);
    expect(data.constructs.length).toBeGreaterThan(0);
  });

  it('page_summary with include=["schemas"] returns compact schema list', () => {
    const result = executeTool(
      'page_summary',
      { include: ['schemas'] },
      doc,
      pageId
    );
    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(Array.isArray(data.schemas)).toBe(true);
    expect(data.schemas.some((s: any) => s.type === 'test-node')).toBe(true);
  });

  it('page_summary with both include options returns both', () => {
    createConstruct(doc, pageId, 'test-node', {}, { x: 0, y: 0 });

    const result = executeTool(
      'page_summary',
      { include: ['constructs', 'schemas'] },
      doc,
      pageId
    );
    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(Array.isArray(data.constructs)).toBe(true);
    expect(Array.isArray(data.schemas)).toBe(true);
  });
});

describe('list_constructs output param', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
    createSchema(doc, TEST_SCHEMA as any);
    createConstruct(doc, pageId, 'test-node', {}, { x: 100, y: 200 });
  });

  it('list_constructs output=full returns full construct data', () => {
    const result = executeTool('list_constructs', { output: 'full' }, doc, pageId);
    expect(result.success).toBe(true);
    const constructs = (result.data as any).constructs;
    expect(Array.isArray(constructs)).toBe(true);
    expect(constructs.length).toBeGreaterThan(0);
    // Full mode should include data/position
    expect(constructs[0]).toHaveProperty('data');
  });

  it('list_constructs without output param returns compact summaries', () => {
    const result = executeTool('list_constructs', {}, doc, pageId);
    expect(result.success).toBe(true);
    const constructs = (result.data as any).constructs;
    expect(Array.isArray(constructs)).toBe(true);
    expect(constructs.length).toBeGreaterThan(0);
  });
});

describe('get_construct output param', () => {
  let doc: Y.Doc;
  let pageId: string;
  let constructId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
    createSchema(doc, TEST_SCHEMA as any);
    const construct = createConstruct(doc, pageId, 'test-node', {}, { x: 0, y: 0 });
    constructId = construct.data.semanticId;
  });

  it('get_construct output=compact returns only semanticId/type/page', () => {
    const result = executeTool(
      'get_construct',
      { semanticId: constructId, output: 'compact' },
      doc,
      pageId
    );
    expect(result.success).toBe(true);
    const construct = (result.data as any).construct;
    expect(construct.semanticId).toBe(constructId);
    expect(construct.type).toBe('test-node');
    expect(construct.page).toBe(pageId);
    expect(construct.data).toBeUndefined();
  });

  it('get_construct without output param returns full construct', () => {
    const result = executeTool(
      'get_construct',
      { semanticId: constructId },
      doc,
      pageId
    );
    expect(result.success).toBe(true);
    const construct = (result.data as any).construct;
    expect(construct).toHaveProperty('data');
  });
});
