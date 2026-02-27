import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { executeTool } from '../src/tools/index.js';
import { createPage } from '../src/doc-operations.js';

describe('schema param parity', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
  });

  it('create_schema with displayHint "markdown" succeeds', () => {
    const result = executeTool(
      'create_schema',
      {
        type: 'doc-node',
        displayName: 'Document Node',
        color: '#0000ff',
        fields: [
          { name: 'content', label: 'Content', type: 'string', displayHint: 'markdown' },
        ],
      },
      doc,
      pageId
    );
    expect(result.success).toBe(true);
  });

  it('update_schema with backgroundColorPolicy succeeds', () => {
    executeTool(
      'create_schema',
      { type: 'colored-node', displayName: 'Colored Node', color: '#00ff00', fields: [] },
      doc,
      pageId
    );

    const result = executeTool(
      'update_schema',
      { type: 'colored-node', backgroundColorPolicy: 'tints' },
      doc,
      pageId
    );
    expect(result.success).toBe(true);
  });

  it('update_schema fieldUpdates with displayHint "markdown" succeeds', () => {
    executeTool(
      'create_schema',
      {
        type: 'text-node',
        displayName: 'Text Node',
        color: '#cccccc',
        fields: [{ name: 'body', label: 'Body', type: 'string' }],
      },
      doc,
      pageId
    );

    const result = executeTool(
      'update_schema',
      {
        type: 'text-node',
        fieldUpdates: {
          body: { displayHint: 'markdown' },
        },
      },
      doc,
      pageId
    );
    expect(result.success).toBe(true);
  });

  it('add_field with type "date" succeeds', () => {
    executeTool(
      'create_schema',
      { type: 'dated-node', displayName: 'Dated Node', color: '#bbbbbb', fields: [] },
      doc,
      pageId
    );

    const result = executeTool(
      'add_field',
      {
        schemaType: 'dated-node',
        field: { name: 'createdAt', type: 'date', label: 'Created At' },
      },
      doc,
      pageId
    );
    expect(result.success).toBe(true);
  });

  it('add_field rejects invalid type', () => {
    executeTool(
      'create_schema',
      { type: 'any-node', displayName: 'Any Node', color: '#eeeeee', fields: [] },
      doc,
      pageId
    );

    // 'url' is no longer a valid field type (it was wrong before)
    const result = executeTool(
      'add_field',
      {
        schemaType: 'any-node',
        field: { name: 'link', type: 'url', label: 'Link' },
      },
      doc,
      pageId
    );
    expect(result.success).toBe(false);
  });
});
