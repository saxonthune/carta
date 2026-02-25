import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { executeTool } from '../src/tools/index.js';
import { createPage } from '../src/doc-operations.js';

describe('resource tool round-trip', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
  });

  it('create_resource → list_resources → get_resource round-trip', () => {
    const createResult = executeTool(
      'create_resource',
      { name: 'api-spec', format: 'openapi', body: 'openapi: 3.0.0' },
      doc,
      pageId
    );
    expect(createResult.success).toBe(true);
    const resourceId = (createResult.data as any).resource.id;

    const listResult = executeTool('list_resources', {}, doc, pageId);
    expect(listResult.success).toBe(true);
    const resources = (listResult.data as any).resources;
    expect(resources.some((r: any) => r.id === resourceId)).toBe(true);

    const getResult = executeTool('get_resource', { id: resourceId }, doc, pageId);
    expect(getResult.success).toBe(true);
    expect((getResult.data as any).resource.body).toBe('openapi: 3.0.0');
  });

  it('update_resource changes the working copy', () => {
    const createResult = executeTool(
      'create_resource',
      { name: 'spec', format: 'json', body: '{}' },
      doc,
      pageId
    );
    const resourceId = (createResult.data as any).resource.id;

    const updateResult = executeTool(
      'update_resource',
      { id: resourceId, body: '{"updated": true}' },
      doc,
      pageId
    );
    expect(updateResult.success).toBe(true);
    expect((updateResult.data as any).resource.body).toBe('{"updated": true}');
  });

  it('publish_resource creates a version → resource_history lists it', () => {
    const createResult = executeTool(
      'create_resource',
      { name: 'spec', format: 'markdown', body: '# v1' },
      doc,
      pageId
    );
    const resourceId = (createResult.data as any).resource.id;

    const publishResult = executeTool(
      'publish_resource',
      { id: resourceId, label: 'v1' },
      doc,
      pageId
    );
    expect(publishResult.success).toBe(true);
    const versionId = (publishResult.data as any).version.versionId;

    const historyResult = executeTool('resource_history', { id: resourceId }, doc, pageId);
    expect(historyResult.success).toBe(true);
    const history = (historyResult.data as any).history;
    expect(history.some((v: any) => v.versionId === versionId)).toBe(true);
  });

  it('resource_diff returns from/to bodies', () => {
    const createResult = executeTool(
      'create_resource',
      { name: 'spec', format: 'markdown', body: '# v1' },
      doc,
      pageId
    );
    const resourceId = (createResult.data as any).resource.id;

    const publishResult = executeTool(
      'publish_resource',
      { id: resourceId },
      doc,
      pageId
    );
    const versionId = (publishResult.data as any).version.versionId;

    executeTool('update_resource', { id: resourceId, body: '# v2' }, doc, pageId);

    // diff between published version and working copy
    const diffResult = executeTool(
      'resource_diff',
      { id: resourceId, fromVersionId: versionId },
      doc,
      pageId
    );
    expect(diffResult.success).toBe(true);
    expect((diffResult.data as any).from).toBe('# v1');
    expect((diffResult.data as any).to).toBe('# v2');
  });

  it('delete_resource removes it from list', () => {
    const createResult = executeTool(
      'create_resource',
      { name: 'temp', format: 'json', body: '{}' },
      doc,
      pageId
    );
    const resourceId = (createResult.data as any).resource.id;

    const deleteResult = executeTool('delete_resource', { id: resourceId }, doc, pageId);
    expect(deleteResult.success).toBe(true);

    const listResult = executeTool('list_resources', {}, doc, pageId);
    const resources = (listResult.data as any).resources;
    expect(resources.some((r: any) => r.id === resourceId)).toBe(false);
  });
});
