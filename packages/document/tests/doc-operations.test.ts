import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { createPage, listPages, updatePage, deletePage, flowLayout, createConstruct, connect, connectBulk, updateConstruct, getConstruct, getSchema, createSchema, renameField, removeField, addField, renamePort, removePort, renameSchemaType, changeFieldType, narrowEnumOptions, addPort, changePortType, listConstructs } from '../src/doc-operations';
import { deepPlainToY, yToPlain } from '../src/yjs-helpers';

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

/** Helper: create a minimal schema for test constructs */
function createTestSchema(doc: Y.Doc, type: string, fields: Array<{ name: string; label: string; type: string }> = [], ports?: Array<{ id: string; portType: string; label: string }>) {
  createSchema(doc, {
    type,
    displayName: type,
    color: '#00ff00',
    fields: fields as any,
    ...(ports ? { ports: ports as any } : {}),
  });
}

describe('flowLayout operation', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
    createTestSchema(doc, 'service');
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

describe('construct field values', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test');
    pageId = page.id;
    createTestSchema(doc, 'note', [{ name: 'content', label: 'Content', type: 'string' }]);
    createTestSchema(doc, 'service', [{ name: 'name', label: 'Name', type: 'string' }, { name: 'description', label: 'Description', type: 'string' }]);
  });

  it('should persist field values on create', () => {
    const node = createConstruct(doc, pageId, 'note', { content: 'hello world' });
    const read = getConstruct(doc, pageId, node.data.semanticId);
    expect(read).not.toBeNull();
    expect(read!.data.values.content).toBe('hello world');
  });

  it('should update field values', () => {
    const node = createConstruct(doc, pageId, 'note', { content: 'original' });
    updateConstruct(doc, pageId, node.data.semanticId, { values: { content: 'updated' } });
    const read = getConstruct(doc, pageId, node.data.semanticId);
    expect(read!.data.values.content).toBe('updated');
  });

  it('should update field values after UI-style plain object degradation', () => {
    // Create via MCP path (Y.Map)
    const node = createConstruct(doc, pageId, 'note', { content: 'original' });

    // Simulate UI degradation: write data as plain object (what yjsAdapter.updateNode used to do)
    const nodesMap = doc.getMap('nodes');
    const pageNodes = nodesMap.get(pageId) as Y.Map<unknown>;
    pageNodes.forEach((ynode, id) => {
      const data = (ynode as Y.Map<unknown>).get('data') as Record<string, unknown>;
      if (data && (data as any).semanticId === node.data.semanticId) {
        // This simulates the old UI behavior: spreading to plain object
        (ynode as Y.Map<unknown>).set('data', { ...data, values: { content: 'ui-edited' } });
      }
    });

    // Now MCP update should still work (ensureYMap repairs the degraded data)
    const result = updateConstruct(doc, pageId, node.data.semanticId, { values: { content: 'mcp-updated' } });
    expect(result).not.toBeNull();
    expect(result!.data.values.content).toBe('mcp-updated');
  });

  it('should preserve existing values when updating a subset', () => {
    const node = createConstruct(doc, pageId, 'service', { name: 'Auth', description: 'Auth service' });
    updateConstruct(doc, pageId, node.data.semanticId, { values: { description: 'Updated desc' } });
    const read = getConstruct(doc, pageId, node.data.semanticId);
    expect(read!.data.values.name).toBe('Auth');
    expect(read!.data.values.description).toBe('Updated desc');
  });
});

describe('schema migration operations', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
  });

  describe('renameField', () => {
    it('should rename a field and migrate instance values', () => {
      // Create schema with field 'title'
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'title', label: 'Title', type: 'string' }],
      });

      // Create instances on two pages with title values
      const task1 = createConstruct(doc, pageId, 'Task', { title: 'Task 1' });
      const page2 = createPage(doc, 'Page 2');
      const task2 = createConstruct(doc, page2.id, 'Task', { title: 'Task 2' });

      // Rename field
      const result = renameField(doc, 'Task', 'title', 'name');

      expect(result.schemaUpdated).toBe(true);
      expect(result.instancesUpdated).toBe(2);
      expect(result.edgesUpdated).toBe(0);
      expect(result.edgesRemoved).toBe(0);

      // Verify schema updated
      const schema = yToPlain(doc.getMap('schemas').get('Task')!) as Record<string, unknown>;
      const fields = schema.fields as Array<Record<string, unknown>>;
      expect(fields[0]?.name).toBe('name');

      // Verify instances migrated
      const task1Data = getConstruct(doc, pageId, task1.data.semanticId);
      expect(task1Data!.data.values.name).toBe('Task 1');
      expect(task1Data!.data.values.title).toBeUndefined();

      const task2Data = getConstruct(doc, page2.id, task2.data.semanticId);
      expect(task2Data!.data.values.name).toBe('Task 2');
      expect(task2Data!.data.values.title).toBeUndefined();
    });

    it('should update displayField if it references the old name', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        displayField: 'title',
        fields: [{ name: 'title', label: 'Title', type: 'string' }],
      });

      renameField(doc, 'Task', 'title', 'name');

      const schema = yToPlain(doc.getMap('schemas').get('Task')!) as Record<string, unknown>;
      expect(schema.displayField).toBe('name');
    });

    it('should throw if field does not exist', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'title', label: 'Title', type: 'string' }],
      });

      expect(() => renameField(doc, 'Task', 'nonexistent', 'name')).toThrow('Field not found: nonexistent');
    });

    it('should throw if target name already exists', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [
          { name: 'title', label: 'Title', type: 'string' },
          { name: 'name', label: 'Name', type: 'string' },
        ],
      });

      expect(() => renameField(doc, 'Task', 'title', 'name')).toThrow('Field already exists: name');
    });
  });

  describe('removeField', () => {
    it('should remove field from schema and delete instance values', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [
          { name: 'title', label: 'Title', type: 'string' },
          { name: 'description', label: 'Description', type: 'string' },
        ],
      });

      const task = createConstruct(doc, pageId, 'Task', { title: 'Task 1', description: 'Description 1' });

      const result = removeField(doc, 'Task', 'description');

      expect(result.schemaUpdated).toBe(true);
      expect(result.instancesUpdated).toBe(1);

      // Verify schema updated
      const schema = yToPlain(doc.getMap('schemas').get('Task')!) as Record<string, unknown>;
      const fields = schema.fields as Array<Record<string, unknown>>;
      expect(fields.length).toBe(1);
      expect(fields[0]?.name).toBe('title');

      // Verify instance updated
      const taskData = getConstruct(doc, pageId, task.data.semanticId);
      expect(taskData!.data.values.title).toBe('Task 1');
      expect(taskData!.data.values.description).toBeUndefined();
    });

    it('should clear displayField if it matches removed field', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        displayField: 'title',
        fields: [{ name: 'title', label: 'Title', type: 'string' }],
      });

      removeField(doc, 'Task', 'title');

      const schema = yToPlain(doc.getMap('schemas').get('Task')!) as Record<string, unknown>;
      expect(schema.displayField).toBeUndefined();
    });

    it('should throw if field does not exist', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'title', label: 'Title', type: 'string' }],
      });

      expect(() => removeField(doc, 'Task', 'nonexistent')).toThrow('Field not found: nonexistent');
    });
  });

  describe('addField', () => {
    it('should add field to schema without modifying instances', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'title', label: 'Title', type: 'string' }],
      });

      const task = createConstruct(doc, pageId, 'Task', { title: 'Task 1' });

      const result = addField(doc, 'Task', { name: 'priority', label: 'Priority', type: 'number' });

      expect(result.schemaUpdated).toBe(true);
      expect(result.instancesUpdated).toBe(0);

      // Verify schema updated
      const schema = yToPlain(doc.getMap('schemas').get('Task')!) as Record<string, unknown>;
      const fields = schema.fields as Array<Record<string, unknown>>;
      expect(fields.length).toBe(2);
      expect(fields[1]?.name).toBe('priority');

      // Verify instance not changed
      const taskData = getConstruct(doc, pageId, task.data.semanticId);
      expect(taskData!.data.values.priority).toBeUndefined();
    });

    it('should populate instances with default value if provided', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'title', label: 'Title', type: 'string' }],
      });

      const task1 = createConstruct(doc, pageId, 'Task', { title: 'Task 1' });
      const page2 = createPage(doc, 'Page 2');
      const task2 = createConstruct(doc, page2.id, 'Task', { title: 'Task 2' });

      const result = addField(doc, 'Task', { name: 'status', label: 'Status', type: 'string' }, 'todo');

      expect(result.schemaUpdated).toBe(true);
      expect(result.instancesUpdated).toBe(2);

      // Verify instances updated
      const task1Data = getConstruct(doc, pageId, task1.data.semanticId);
      expect(task1Data!.data.values.status).toBe('todo');

      const task2Data = getConstruct(doc, page2.id, task2.data.semanticId);
      expect(task2Data!.data.values.status).toBe('todo');
    });

    it('should throw if field name already exists', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'title', label: 'Title', type: 'string' }],
      });

      expect(() => addField(doc, 'Task', { name: 'title', label: 'Title Again', type: 'string' })).toThrow(
        'Field already exists: title'
      );
    });
  });

  describe('renamePort', () => {
    it('should rename port and update edge connections', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'title', label: 'Title', type: 'string' }],
        ports: [
          { id: 'flow-out', portType: 'flow-out', label: 'Next' },
          { id: 'flow-in', portType: 'flow-in', label: 'Previous' },
        ],
      });

      const task1 = createConstruct(doc, pageId, 'Task', { title: 'Task 1' });
      const task2 = createConstruct(doc, pageId, 'Task', { title: 'Task 2' });

      // Connect via flow-out
      connect(doc, pageId, task1.data.semanticId, 'flow-out', task2.data.semanticId, 'flow-in');

      const result = renamePort(doc, 'Task', 'flow-out', 'output');

      expect(result.schemaUpdated).toBe(true);
      expect(result.edgesUpdated).toBe(1);

      // Verify schema updated
      const schema = yToPlain(doc.getMap('schemas').get('Task')!) as Record<string, unknown>;
      const ports = schema.ports as Array<Record<string, unknown>>;
      expect(ports[0]?.id).toBe('output');

      // Verify edge updated
      const edges = doc.getMap('edges').get(pageId) as Y.Map<Y.Map<unknown>>;
      const edgeArray = Array.from(edges.values());
      expect(edgeArray.length).toBe(1);
      const edge = yToPlain(edgeArray[0]!) as Record<string, unknown>;
      expect(edge.sourceHandle).toBe('output');
      expect(edge.targetHandle).toBe('flow-in');

      // Verify connections array updated
      const task1Data = getConstruct(doc, pageId, task1.data.semanticId);
      const connections = task1Data!.data.connections as Array<Record<string, unknown>>;
      expect(connections.length).toBe(1);
      expect(connections[0]?.portId).toBe('output');
    });

    it('should throw if port does not exist', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [],
        ports: [{ id: 'flow-out', portType: 'flow-out', label: 'Next' }],
      });

      expect(() => renamePort(doc, 'Task', 'nonexistent', 'output')).toThrow('Port not found: nonexistent');
    });

    it('should throw if target port already exists', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [],
        ports: [
          { id: 'flow-out', portType: 'flow-out', label: 'Next' },
          { id: 'output', portType: 'flow-out', label: 'Output' },
        ],
      });

      expect(() => renamePort(doc, 'Task', 'flow-out', 'output')).toThrow('Port already exists: output');
    });
  });

  describe('removePort', () => {
    it('should remove port and delete connected edges', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'title', label: 'Title', type: 'string' }],
        ports: [
          { id: 'flow-out', portType: 'flow-out', label: 'Next' },
          { id: 'flow-in', portType: 'flow-in', label: 'Previous' },
        ],
      });

      const task1 = createConstruct(doc, pageId, 'Task', { title: 'Task 1' });
      const task2 = createConstruct(doc, pageId, 'Task', { title: 'Task 2' });

      // Connect via flow-out
      connect(doc, pageId, task1.data.semanticId, 'flow-out', task2.data.semanticId, 'flow-in');

      const result = removePort(doc, 'Task', 'flow-out');

      expect(result.schemaUpdated).toBe(true);
      expect(result.edgesRemoved).toBe(1);

      // Verify schema updated
      const schema = yToPlain(doc.getMap('schemas').get('Task')!) as Record<string, unknown>;
      const ports = schema.ports as Array<Record<string, unknown>>;
      expect(ports.length).toBe(1);
      expect(ports[0]?.id).toBe('flow-in');

      // Verify edge deleted
      const edges = doc.getMap('edges').get(pageId) as Y.Map<Y.Map<unknown>>;
      const edgeArray = Array.from(edges.values());
      expect(edgeArray.length).toBe(0);

      // Verify connections array cleaned up
      const task1Data = getConstruct(doc, pageId, task1.data.semanticId);
      const connections = task1Data!.data.connections as Array<Record<string, unknown>>;
      expect(connections.length).toBe(0);
    });

    it('should clean up connections on other nodes that targeted the removed port', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [],
        ports: [
          { id: 'flow-out', portType: 'flow-out', label: 'Next' },
          { id: 'flow-in', portType: 'flow-in', label: 'Previous' },
        ],
      });

      const task1 = createConstruct(doc, pageId, 'Task', {});
      const task2 = createConstruct(doc, pageId, 'Task', {});

      // Connect and verify connections exist
      connect(doc, pageId, task1.data.semanticId, 'flow-out', task2.data.semanticId, 'flow-in');

      const task2Before = getConstruct(doc, pageId, task2.data.semanticId);
      expect(task2Before!.data.connections).toBeDefined();

      // Remove the target port
      removePort(doc, 'Task', 'flow-in');

      // Verify task1's connections cleaned up (source side)
      const task1After = getConstruct(doc, pageId, task1.data.semanticId);
      const connections1 = (task1After!.data.connections || []) as Array<Record<string, unknown>>;
      expect(connections1.length).toBe(0);

      // Verify task2's connections not affected (it wasn't the source)
      const task2After = getConstruct(doc, pageId, task2.data.semanticId);
      const connections2 = (task2After!.data.connections || []) as Array<Record<string, unknown>>;
      expect(connections2.length).toBe(0);
    });

    it('should throw if port does not exist', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [],
        ports: [{ id: 'flow-out', portType: 'flow-out', label: 'Next' }],
      });

      expect(() => removePort(doc, 'Task', 'nonexistent')).toThrow('Port not found: nonexistent');
    });
  });

  describe('renameSchemaType (tier 2)', () => {
    it('should rename schema type and update all instances', () => {
      createSchema(doc, {
        type: 'service',
        displayName: 'Service',
        color: '#00ff00',
        fields: [{ name: 'name', label: 'Name', type: 'string' }],
      });

      const svc1 = createConstruct(doc, pageId, 'service', { name: 'Auth' });
      const svc2 = createConstruct(doc, pageId, 'service', { name: 'API' });

      const result = renameSchemaType(doc, 'service', 'microservice');

      expect(result.schemaUpdated).toBe(true);
      expect(result.instancesUpdated).toBe(2);

      // Old schema gone, new schema exists
      const schemas = doc.getMap('schemas');
      expect(schemas.has('service')).toBe(false);
      expect(schemas.has('microservice')).toBe(true);

      const newSchema = yToPlain(schemas.get('microservice')!) as Record<string, unknown>;
      expect(newSchema.type).toBe('microservice');

      // Instances updated
      const svc1Data = getConstruct(doc, pageId, svc1.data.semanticId);
      expect(svc1Data!.data.constructType).toBe('microservice');

      const svc2Data = getConstruct(doc, pageId, svc2.data.semanticId);
      expect(svc2Data!.data.constructType).toBe('microservice');
    });

    it('should update suggestedTypes references in other schemas', () => {
      createSchema(doc, {
        type: 'service',
        displayName: 'Service',
        color: '#00ff00',
        fields: [],
      });

      createSchema(doc, {
        type: 'connector',
        displayName: 'Connector',
        color: '#ff0000',
        fields: [],
        ports: [
          { id: 'target', portType: 'flow-out', label: 'Target', suggestedTypes: ['service'] },
        ],
      });

      renameSchemaType(doc, 'service', 'svc');

      const connectorSchema = yToPlain(doc.getMap('schemas').get('connector')!) as Record<string, unknown>;
      const ports = connectorSchema.ports as Array<Record<string, unknown>>;
      const targetPort = ports.find(p => p.id === 'target');
      expect(targetPort?.suggestedTypes).toEqual(['svc']);
    });

    it('should throw if schema does not exist', () => {
      expect(() => renameSchemaType(doc, 'nonexistent', 'newname')).toThrow('Schema not found: nonexistent');
    });

    it('should throw if new type already exists', () => {
      createSchema(doc, { type: 'service', displayName: 'Service', color: '#00ff00', fields: [] });
      createSchema(doc, { type: 'task', displayName: 'Task', color: '#ff0000', fields: [] });

      expect(() => renameSchemaType(doc, 'service', 'task')).toThrow('Schema already exists: task');
    });

    it('should throw if trying to rename built-in schema', () => {
      // Built-in schemas are defined in @carta/domain
      // 'rest-endpoint' is from softwareArchitectureSeed
      createSchema(doc, {
        type: 'rest-endpoint',
        displayName: 'REST Endpoint',
        color: '#00ff00',
        fields: [],
      });

      expect(() => renameSchemaType(doc, 'rest-endpoint', 'renamed')).toThrow('Cannot rename built-in schema: rest-endpoint');
    });
  });

  describe('changeFieldType (tier 2)', () => {
    it('should dry-run by default for lossless conversion', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'count', label: 'Count', type: 'number' }],
      });

      createConstruct(doc, pageId, 'Task', { count: 42 });
      createConstruct(doc, pageId, 'Task', { count: 99 });

      const result = changeFieldType(doc, 'Task', 'count', 'string');

      expect(result.dryRun).toBe(true);
      expect(result.schemaUpdated).toBe(false);
      expect(result.instancesUpdated).toBe(2);
      expect(result.warnings).toEqual([]);

      // Schema unchanged in dry-run
      const schema = yToPlain(doc.getMap('schemas').get('Task')!) as Record<string, unknown>;
      const fields = schema.fields as Array<Record<string, unknown>>;
      expect(fields[0]?.type).toBe('number');
    });

    it('should warn about lossy conversions in dry-run', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'name', label: 'Name', type: 'string' }],
      });

      createConstruct(doc, pageId, 'Task', { name: 'not a number' });

      const result = changeFieldType(doc, 'Task', 'name', 'number');

      expect(result.dryRun).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('will lose data');
    });

    it('should execute conversion when force=true', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'count', label: 'Count', type: 'number' }],
      });

      const task1 = createConstruct(doc, pageId, 'Task', { count: 42 });
      const task2 = createConstruct(doc, pageId, 'Task', { count: 99 });

      const result = changeFieldType(doc, 'Task', 'count', 'string', { force: true });

      expect(result.dryRun).toBeFalsy();
      expect(result.schemaUpdated).toBe(true);
      expect(result.instancesUpdated).toBe(2);

      // Schema updated
      const schema = yToPlain(doc.getMap('schemas').get('Task')!) as Record<string, unknown>;
      const fields = schema.fields as Array<Record<string, unknown>>;
      expect(fields[0]?.type).toBe('string');

      // Values converted
      const task1Data = getConstruct(doc, pageId, task1.data.semanticId);
      expect(task1Data!.data.values.count).toBe('42');

      const task2Data = getConstruct(doc, pageId, task2.data.semanticId);
      expect(task2Data!.data.values.count).toBe('99');
    });

    it('should convert string to enum with valid values', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'status', label: 'Status', type: 'string' }],
      });

      const task1 = createConstruct(doc, pageId, 'Task', { status: 'todo' });
      const task2 = createConstruct(doc, pageId, 'Task', { status: 'invalid' });

      const result = changeFieldType(doc, 'Task', 'status', 'enum', {
        force: true,
        enumOptions: ['todo', 'done'],
      });

      expect(result.schemaUpdated).toBe(true);

      // task1 keeps value, task2 loses it
      const task1Data = getConstruct(doc, pageId, task1.data.semanticId);
      expect(task1Data!.data.values.status).toBe('todo');

      const task2Data = getConstruct(doc, pageId, task2.data.semanticId);
      expect(task2Data!.data.values.status).toBeUndefined();
    });

    it('should throw when changing to enum without enumOptions', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'status', label: 'Status', type: 'string' }],
      });

      expect(() => changeFieldType(doc, 'Task', 'status', 'enum', { force: true })).toThrow('enumOptions required when changing to enum type');
    });

    it('should throw if field does not exist', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'title', label: 'Title', type: 'string' }],
      });

      expect(() => changeFieldType(doc, 'Task', 'nonexistent', 'number')).toThrow('Field not found: nonexistent');
    });
  });

  describe('narrowEnumOptions (tier 2)', () => {
    it('should narrow enum options and clear orphaned values', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'status', label: 'Status', type: 'enum', options: ['todo', 'in_progress', 'done'] }],
      });

      const task1 = createConstruct(doc, pageId, 'Task', { status: 'todo' });
      const task2 = createConstruct(doc, pageId, 'Task', { status: 'in_progress' });

      const result = narrowEnumOptions(doc, 'Task', 'status', ['todo', 'done']);

      expect(result.schemaUpdated).toBe(true);
      expect(result.instancesUpdated).toBe(1); // Only task2 affected

      // Schema updated
      const schema = yToPlain(doc.getMap('schemas').get('Task')!) as Record<string, unknown>;
      const fields = schema.fields as Array<Record<string, unknown>>;
      expect(fields[0]?.options).toEqual(['todo', 'done']);

      // task1 keeps value, task2 loses it
      const task1Data = getConstruct(doc, pageId, task1.data.semanticId);
      expect(task1Data!.data.values.status).toBe('todo');

      const task2Data = getConstruct(doc, pageId, task2.data.semanticId);
      expect(task2Data!.data.values.status).toBeUndefined();
    });

    it('should remap values via valueMapping', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'priority', label: 'Priority', type: 'enum', options: ['low', 'medium', 'high'] }],
      });

      const task = createConstruct(doc, pageId, 'Task', { priority: 'medium' });

      const result = narrowEnumOptions(doc, 'Task', 'priority', ['low', 'high'], { medium: 'high' });

      expect(result.instancesUpdated).toBe(1);

      const taskData = getConstruct(doc, pageId, task.data.semanticId);
      expect(taskData!.data.values.priority).toBe('high');
    });

    it('should throw if field is not enum', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'title', label: 'Title', type: 'string' }],
      });

      expect(() => narrowEnumOptions(doc, 'Task', 'title', ['a', 'b'])).toThrow("Field 'title' is not an enum");
    });

    it('should throw if newOptions is empty', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [{ name: 'status', label: 'Status', type: 'enum', options: ['todo', 'done'] }],
      });

      expect(() => narrowEnumOptions(doc, 'Task', 'status', [])).toThrow('newOptions must not be empty');
    });
  });

  describe('addPort (tier 2)', () => {
    it('should add a port to a schema', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [],
        ports: [{ id: 'flow-in', portType: 'flow-in', label: 'In' }],
      });

      const result = addPort(doc, 'Task', {
        id: 'data-out',
        portType: 'data-out',
        label: 'Data Output',
      });

      expect(result.schemaUpdated).toBe(true);
      expect(result.instancesUpdated).toBe(0);

      const schema = yToPlain(doc.getMap('schemas').get('Task')!) as Record<string, unknown>;
      const ports = schema.ports as Array<Record<string, unknown>>;
      expect(ports.length).toBe(2);
      expect(ports[1]?.id).toBe('data-out');
    });

    it('should throw if port id already exists', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [],
        ports: [{ id: 'flow-in', portType: 'flow-in', label: 'In' }],
      });

      expect(() => addPort(doc, 'Task', { id: 'flow-in', portType: 'flow-in', label: 'Duplicate' })).toThrow('Port already exists: flow-in');
    });

    it('should throw if missing id or portType', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [],
      });

      expect(() => addPort(doc, 'Task', { portType: 'flow-in', label: 'Missing ID' })).toThrow('Port must have an id');
      expect(() => addPort(doc, 'Task', { id: 'myport', label: 'Missing portType' })).toThrow('Port must have a portType');
    });
  });

  describe('changePortType (tier 2)', () => {
    it('should change port type and disconnect incompatible edges', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [],
        ports: [
          { id: 'out', portType: 'flow-out', label: 'Out' },
          { id: 'in', portType: 'flow-in', label: 'In' },
        ],
      });

      const task1 = createConstruct(doc, pageId, 'Task', {});
      const task2 = createConstruct(doc, pageId, 'Task', {});

      connect(doc, pageId, task1.data.semanticId, 'out', task2.data.semanticId, 'in');

      // Change 'out' from flow-out to flow-in (source becomes sink, incompatible with target sink)
      const result = changePortType(doc, 'Task', 'out', 'flow-in');

      expect(result.schemaUpdated).toBe(true);
      expect(result.edgesRemoved).toBe(1);

      // Verify schema updated
      const schema = yToPlain(doc.getMap('schemas').get('Task')!) as Record<string, unknown>;
      const ports = schema.ports as Array<Record<string, unknown>>;
      const outPort = ports.find(p => p.id === 'out');
      expect(outPort?.portType).toBe('flow-in');

      // Verify edge removed
      const edges = doc.getMap('edges').get(pageId) as Y.Map<Y.Map<unknown>>;
      expect(edges.size).toBe(0);

      // Verify connections cleaned up
      const task1Data = getConstruct(doc, pageId, task1.data.semanticId);
      expect((task1Data!.data.connections || []).length).toBe(0);
    });

    it('should keep compatible edges when changing port type', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [],
        ports: [
          { id: 'out', portType: 'flow-out', label: 'Out' },
          { id: 'in', portType: 'flow-in', label: 'In' },
        ],
      });

      const task1 = createConstruct(doc, pageId, 'Task', {});
      const task2 = createConstruct(doc, pageId, 'Task', {});

      connect(doc, pageId, task1.data.semanticId, 'out', task2.data.semanticId, 'in');

      // Change 'out' from flow-out to relay (relay is compatible with flow-in)
      const result = changePortType(doc, 'Task', 'out', 'relay');

      expect(result.schemaUpdated).toBe(true);
      expect(result.edgesRemoved).toBe(0);

      // Verify edge still exists
      const edges = doc.getMap('edges').get(pageId) as Y.Map<Y.Map<unknown>>;
      expect(edges.size).toBe(1);
    });

    it('should throw if port does not exist', () => {
      createSchema(doc, {
        type: 'Task',
        displayName: 'Task',
        color: '#00ff00',
        fields: [],
        ports: [{ id: 'flow-out', portType: 'flow-out', label: 'Out' }],
      });

      expect(() => changePortType(doc, 'Task', 'nonexistent', 'flow-in')).toThrow('Port not found: nonexistent');
    });
  });
});

describe('connection validation', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
  });

  it('connect() rejects non-existent source port ID', () => {
    createTestSchema(doc, 'Alpha', [], [
      { id: 'flow-out', portType: 'flow-out', label: 'Out' },
      { id: 'flow-in', portType: 'flow-in', label: 'In' },
    ]);
    const a = createConstruct(doc, pageId, 'Alpha');
    const b = createConstruct(doc, pageId, 'Alpha');

    const result = connect(doc, pageId, a.data.semanticId, 'bogus', b.data.semanticId, 'flow-in');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Port not found');
      expect(result.error).toContain('bogus');
    }
  });

  it('connect() rejects incompatible port types', () => {
    createTestSchema(doc, 'Sender', [], [
      { id: 'out', portType: 'flow-out', label: 'Out' },
    ]);
    createTestSchema(doc, 'AlsoSender', [], [
      { id: 'out', portType: 'flow-out', label: 'Out' },
    ]);
    const a = createConstruct(doc, pageId, 'Sender');
    const b = createConstruct(doc, pageId, 'AlsoSender');

    const result = connect(doc, pageId, a.data.semanticId, 'out', b.data.semanticId, 'out');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Incompatible port types');
    }
  });

  it('connect() succeeds for compatible port types', () => {
    createTestSchema(doc, 'Node', [], [
      { id: 'flow-out', portType: 'flow-out', label: 'Out' },
      { id: 'flow-in', portType: 'flow-in', label: 'In' },
    ]);
    const a = createConstruct(doc, pageId, 'Node');
    const b = createConstruct(doc, pageId, 'Node');

    const result = connect(doc, pageId, a.data.semanticId, 'flow-out', b.data.semanticId, 'flow-in');
    expect('edge' in result).toBe(true);
    if ('edge' in result) {
      expect(result.edge.sourceHandle).toBe('flow-out');
      expect(result.edge.targetHandle).toBe('flow-in');
    }
  });

  it('connectBulk() reports per-connection errors', () => {
    createTestSchema(doc, 'Node', [], [
      { id: 'flow-out', portType: 'flow-out', label: 'Out' },
      { id: 'flow-in', portType: 'flow-in', label: 'In' },
    ]);
    const a = createConstruct(doc, pageId, 'Node');
    const b = createConstruct(doc, pageId, 'Node');

    const results = connectBulk(doc, pageId, [
      // Valid connection
      { sourceSemanticId: a.data.semanticId, sourcePortId: 'flow-out', targetSemanticId: b.data.semanticId, targetPortId: 'flow-in' },
      // Invalid: non-existent port
      { sourceSemanticId: a.data.semanticId, sourcePortId: 'bogus', targetSemanticId: b.data.semanticId, targetPortId: 'flow-in' },
      // Invalid: incompatible
      { sourceSemanticId: a.data.semanticId, sourcePortId: 'flow-out', targetSemanticId: b.data.semanticId, targetPortId: 'flow-out' },
    ]);

    expect(results.length).toBe(3);
    // First: success
    expect(results[0]!.edge).not.toBeNull();
    expect(results[0]!.error).toBeUndefined();
    // Second: port not found
    expect(results[1]!.edge).toBeNull();
    expect(results[1]!.error).toContain('Port not found');
    // Third: incompatible
    expect(results[2]!.edge).toBeNull();
    expect(results[2]!.error).toContain('Incompatible port types');
  });
});

describe('construct creation validation', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
  });

  it('createConstruct() throws for non-existent schema type', () => {
    expect(() => createConstruct(doc, pageId, 'NonExistent')).toThrow('Unknown schema type: NonExistent');
  });

  it('createConstruct() succeeds for valid schema type', () => {
    createTestSchema(doc, 'Task', [{ name: 'title', label: 'Title', type: 'string' }]);
    const node = createConstruct(doc, pageId, 'Task', { title: 'Test' });
    expect(node.data.constructType).toBe('Task');
    expect(node.data.values.title).toBe('Test');
  });
});

describe('round-trip invariants', () => {
  let doc: Y.Doc;
  let pageId: string;

  beforeEach(() => {
    doc = new Y.Doc();
    const page = createPage(doc, 'Test Page');
    pageId = page.id;
  });

  it('every edge references ports that exist on endpoint schemas', () => {
    createTestSchema(doc, 'Service', [{ name: 'name', label: 'Name', type: 'string' }], [
      { id: 'flow-out', portType: 'flow-out', label: 'Out' },
      { id: 'flow-in', portType: 'flow-in', label: 'In' },
    ]);

    const a = createConstruct(doc, pageId, 'Service', { name: 'A' });
    const b = createConstruct(doc, pageId, 'Service', { name: 'B' });
    const c = createConstruct(doc, pageId, 'Service', { name: 'C' });

    connect(doc, pageId, a.data.semanticId, 'flow-out', b.data.semanticId, 'flow-in');
    connect(doc, pageId, b.data.semanticId, 'flow-out', c.data.semanticId, 'flow-in');

    // List all edges and verify port references
    const pageEdges = doc.getMap('edges').get(pageId) as Y.Map<Y.Map<unknown>>;
    const constructs = listConstructs(doc, pageId);
    const constructMap = new Map(constructs.map(c => [c.id, c]));

    pageEdges.forEach((yedge) => {
      const sourceId = yedge.get('source') as string;
      const targetId = yedge.get('target') as string;
      const sourceHandle = yedge.get('sourceHandle') as string;
      const targetHandle = yedge.get('targetHandle') as string;

      const sourceNode = constructMap.get(sourceId);
      const targetNode = constructMap.get(targetId);
      expect(sourceNode).toBeDefined();
      expect(targetNode).toBeDefined();

      const sourceSchema = getSchema(doc, sourceNode!.data.constructType);
      const targetSchema = getSchema(doc, targetNode!.data.constructType);
      expect(sourceSchema).not.toBeNull();
      expect(targetSchema).not.toBeNull();

      const sourcePorts = sourceSchema!.ports || [];
      const targetPorts = targetSchema!.ports || [];
      expect(sourcePorts.some(p => p.id === sourceHandle)).toBe(true);
      expect(targetPorts.some(p => p.id === targetHandle)).toBe(true);
    });
  });

  it('every construct has a schema that exists in the document', () => {
    createTestSchema(doc, 'Service', [{ name: 'name', label: 'Name', type: 'string' }]);
    createTestSchema(doc, 'Database', [{ name: 'engine', label: 'Engine', type: 'string' }]);

    createConstruct(doc, pageId, 'Service', { name: 'Auth' });
    createConstruct(doc, pageId, 'Database', { engine: 'postgres' });
    createConstruct(doc, pageId, 'Service', { name: 'API' });

    const constructs = listConstructs(doc, pageId);
    for (const construct of constructs) {
      const schema = getSchema(doc, construct.data.constructType);
      expect(schema).not.toBeNull();
    }
  });
});
