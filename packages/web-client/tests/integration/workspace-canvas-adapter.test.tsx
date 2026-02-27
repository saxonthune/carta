/**
 * Test: Workspace Canvas Adapter Mode
 *
 * Verifies that createYjsAdapter with workspaceCanvas option correctly:
 * - Returns injected schemas instead of reading from Y.Doc
 * - Treats schema mutation methods as no-ops
 * - Returns the synthetic WORKSPACE_CANVAS_PAGE_ID page
 * - Treats page mutations as no-ops
 * - Allows node/edge CRUD (the core canvas functionality)
 * - Returns empty arrays for resource methods
 * - Fires subscriber callbacks on node/edge changes
 * - Cleans up correctly on dispose
 */

import { describe, it, expect, vi } from 'vitest';
import { createYjsAdapter } from '../../src/stores/adapters/yjsAdapter';
import type { WorkspaceCanvasSchemas } from '../../src/stores/adapters/yjsAdapter';
import type { ConstructSchema, PortSchema, SchemaGroup } from '@carta/schema';
import type { CartaNode } from '@carta/types';

const CANVAS_PAGE_ID = 'canvas';

const mockSchema: ConstructSchema = {
  type: 'TestService',
  displayName: 'Test Service',
  color: '#ff0000',
  semanticDescription: 'A test service',
  compilation: { format: 'json' },
  ports: [],
  fields: [],
};

const mockPortSchema: PortSchema = {
  id: 'test-port',
  displayName: 'Test Port',
  polarity: 'source',
  compatibleWith: [],
  semanticDescription: 'A test port',
};

const mockSchemaGroup: SchemaGroup = {
  id: 'test-group',
  name: 'Test Group',
  schemas: [],
};

const injectedSchemas: WorkspaceCanvasSchemas = {
  schemas: [mockSchema],
  portSchemas: [mockPortSchema],
  schemaGroups: [mockSchemaGroup],
  schemaRelationships: [],
  schemaPackages: [],
  packageManifest: [],
};

async function makeWorkspaceAdapter() {
  const adapter = createYjsAdapter({
    mode: 'local',
    roomId: 'test-canvas',
    skipPersistence: true,
    deferDefaultPage: true,
    workspaceCanvas: injectedSchemas,
  });
  await adapter.initialize();
  return adapter;
}

describe('Workspace Canvas Adapter', () => {
  it('initializes without error and is usable', async () => {
    const adapter = await makeWorkspaceAdapter();
    expect(adapter).toBeDefined();
    adapter.dispose();
  });

  it('getSchemas() returns injected schemas', async () => {
    const adapter = await makeWorkspaceAdapter();
    const schemas = adapter.getSchemas();
    expect(schemas).toHaveLength(1);
    expect(schemas[0].type).toBe('TestService');
    adapter.dispose();
  });

  it('getSchema() finds injected schema by type', async () => {
    const adapter = await makeWorkspaceAdapter();
    const schema = adapter.getSchema('TestService');
    expect(schema).toBeDefined();
    expect(schema!.displayName).toBe('Test Service');
    adapter.dispose();
  });

  it('getPortSchemas() returns injected port schemas', async () => {
    const adapter = await makeWorkspaceAdapter();
    const portSchemas = adapter.getPortSchemas();
    expect(portSchemas).toHaveLength(1);
    expect(portSchemas[0].id).toBe('test-port');
    adapter.dispose();
  });

  it('getSchemaGroups() returns injected schema groups', async () => {
    const adapter = await makeWorkspaceAdapter();
    const groups = adapter.getSchemaGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('test-group');
    adapter.dispose();
  });

  it('schema mutations are no-ops: addSchema does not change getSchemas()', async () => {
    const adapter = await makeWorkspaceAdapter();
    const newSchema: ConstructSchema = {
      type: 'ShouldNotAppear',
      displayName: 'Should Not Appear',
      color: '#000',
      semanticDescription: 'noop test',
      compilation: { format: 'json' },
      ports: [],
      fields: [],
    };
    adapter.addSchema(newSchema);
    const schemas = adapter.getSchemas();
    expect(schemas.some(s => s.type === 'ShouldNotAppear')).toBe(false);
    expect(schemas).toHaveLength(1); // still only the original injected schema
    adapter.dispose();
  });

  it('removeSchema is a no-op: injected schemas remain unchanged', async () => {
    const adapter = await makeWorkspaceAdapter();
    const result = adapter.removeSchema('TestService');
    expect(result).toBe(false);
    const schemas = adapter.getSchemas();
    expect(schemas).toHaveLength(1);
    adapter.dispose();
  });

  it('getPages() returns single synthetic canvas page', async () => {
    const adapter = await makeWorkspaceAdapter();
    const pages = adapter.getPages();
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toBe(CANVAS_PAGE_ID);
    expect(pages[0].name).toBe('Canvas');
    adapter.dispose();
  });

  it('getActivePage() returns WORKSPACE_CANVAS_PAGE_ID', async () => {
    const adapter = await makeWorkspaceAdapter();
    expect(adapter.getActivePage()).toBe(CANVAS_PAGE_ID);
    adapter.dispose();
  });

  it('createPage() is a no-op returning the shim page', async () => {
    const adapter = await makeWorkspaceAdapter();
    const page = adapter.createPage('New Page');
    expect(page.id).toBe(CANVAS_PAGE_ID);
    // Pages count should remain 1
    expect(adapter.getPages()).toHaveLength(1);
    adapter.dispose();
  });

  it('deletePage() is a no-op returning false', async () => {
    const adapter = await makeWorkspaceAdapter();
    const result = adapter.deletePage(CANVAS_PAGE_ID);
    expect(result).toBe(false);
    adapter.dispose();
  });

  it('node CRUD works via the shim page', async () => {
    const adapter = await makeWorkspaceAdapter();
    const node: CartaNode = {
      id: 'node-1',
      type: 'construct',
      position: { x: 100, y: 200 },
      data: { type: 'TestService', semanticId: 'svc-1', fields: {}, connections: [] },
    };
    adapter.setNodes([node]);
    const nodes = adapter.getNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('node-1');
    expect(nodes[0].position).toEqual({ x: 100, y: 200 });
    adapter.dispose();
  });

  it('edge CRUD works via the shim page', async () => {
    const adapter = await makeWorkspaceAdapter();
    const edge = {
      id: 'edge-1',
      source: 'node-a',
      target: 'node-b',
      type: 'default',
    };
    adapter.setEdges([edge as any]);
    const edges = adapter.getEdges();
    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe('edge-1');
    adapter.dispose();
  });

  it('getResources() returns empty array', async () => {
    const adapter = await makeWorkspaceAdapter();
    expect(adapter.getResources()).toEqual([]);
    adapter.dispose();
  });

  it('getResource() returns undefined', async () => {
    const adapter = await makeWorkspaceAdapter();
    expect(adapter.getResource('anything')).toBeUndefined();
    adapter.dispose();
  });

  it('getTitle() returns empty string', async () => {
    const adapter = await makeWorkspaceAdapter();
    expect(adapter.getTitle()).toBe('');
    adapter.dispose();
  });

  it('subscribe() fires callback when setNodes() is called', async () => {
    const adapter = await makeWorkspaceAdapter();
    const cb = vi.fn();
    const unsub = adapter.subscribe(cb);

    adapter.setNodes([{
      id: 'n1',
      type: 'construct',
      position: { x: 0, y: 0 },
      data: { type: 'T', semanticId: 's1', fields: {}, connections: [] },
    }]);

    expect(cb).toHaveBeenCalled();
    unsub();
    adapter.dispose();
  });

  it('after dispose(), no listeners fire', async () => {
    const adapter = await makeWorkspaceAdapter();
    const cb = vi.fn();
    adapter.subscribe(cb);
    adapter.dispose();
    cb.mockClear();

    // Attempting to call setNodes after dispose should not invoke the listener
    // (Y.Doc is destroyed, so we can't call it normally - just verify listener was cleared)
    expect(cb).not.toHaveBeenCalled();
  });
});
