import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { DocumentTestProvider } from '../setup/testProviders';
import { createTestNode, createTestEdge } from '../setup/testHelpers';
import type { ConstructSchema, PortSchema, SchemaGroup, SchemaPackage, SchemaRelationship } from '@carta/domain';

// Get a ready adapter via the DocumentContext hook
async function getAdapter() {
  const { result } = renderHook(() => useDocumentContext(), { wrapper: DocumentTestProvider });
  await waitFor(() => {
    expect(result.current.isReady).toBe(true);
  });
  return result.current.adapter;
}

// Helper function to create a minimal test schema
function createTestSchema(type: string): ConstructSchema {
  return {
    type,
    displayName: type,
    color: '#ff0000',
    semanticDescription: `Test ${type}`,
    compilation: { format: 'json' },
    ports: [],
    fields: [],
  };
}

describe('Adapter Serialization Round-Trip', () => {
  describe('Basic structure', () => {
    it('toJSON() returns object with version 4', async () => {
      const adapter = await getAdapter();
      const json = adapter.toJSON();
      expect(json.version).toBe(4);
    });

    it('toJSON() returns object with title', async () => {
      const adapter = await getAdapter();
      const json = adapter.toJSON();
      expect(json).toHaveProperty('title');
      expect(typeof json.title).toBe('string');
    });

    it('toJSON() returns object with pages array', async () => {
      const adapter = await getAdapter();
      const json = adapter.toJSON();
      expect(json).toHaveProperty('pages');
      expect(Array.isArray(json.pages)).toBe(true);
    });

    it('toJSON() returns object with empty schemas array for new document', async () => {
      const adapter = await getAdapter();
      const json = adapter.toJSON();
      expect(json).toHaveProperty('schemas');
      expect(Array.isArray(json.schemas)).toBe(true);
    });
  });

  describe('Schema round-trip', () => {
    it('addSchema → toJSON().schemas contains the schema with correct properties', async () => {
      const adapter = await getAdapter();
      const schema: ConstructSchema = {
        type: 'TestService',
        displayName: 'Test Service',
        color: '#ff0000',
        semanticDescription: 'A test service',
        compilation: { format: 'json' },
        ports: [{ portSchemaId: 'flow-in', maxConnections: 1 }],
        fields: [{ name: 'serviceName', label: 'Service Name', type: 'string' }],
      };

      adapter.addSchema(schema);
      const json = adapter.toJSON();

      const serializedSchema = json.schemas.find(s => s.type === 'TestService');
      expect(serializedSchema).toBeDefined();
      expect(serializedSchema!.type).toBe('TestService');
      expect(serializedSchema!.displayName).toBe('Test Service');
      expect(serializedSchema!.color).toBe('#ff0000');
      expect(serializedSchema!.semanticDescription).toBe('A test service');
      expect(serializedSchema!.compilation.format).toBe('json');
      expect(serializedSchema!.ports).toHaveLength(1);
      expect(serializedSchema!.ports[0].portSchemaId).toBe('flow-in');
      expect(serializedSchema!.fields).toHaveLength(1);
      expect(serializedSchema!.fields[0].name).toBe('serviceName');
    });

    it('addPortSchema → toJSON().portSchemas contains the port schema', async () => {
      const adapter = await getAdapter();
      const portSchema: PortSchema = {
        id: 'test-port',
        displayName: 'Test Port',
        semanticDescription: 'A test port',
        polarity: 'source',
        compatibleWith: ['test-sink'],
        color: '#00ff00',
      };

      adapter.addPortSchema(portSchema);
      const json = adapter.toJSON();

      const serializedPort = json.portSchemas.find(p => p.id === 'test-port');
      expect(serializedPort).toBeDefined();
      expect(serializedPort!.displayName).toBe('Test Port');
      expect(serializedPort!.polarity).toBe('source');
      expect(serializedPort!.compatibleWith).toEqual(['test-sink']);
      expect(serializedPort!.color).toBe('#00ff00');
    });

    it('addSchemaGroup → toJSON().schemaGroups contains the group', async () => {
      const adapter = await getAdapter();
      const group = adapter.addSchemaGroup({ name: 'Test Group', color: '#0000ff' });
      const json = adapter.toJSON();

      const serializedGroup = json.schemaGroups.find((g: SchemaGroup) => g.id === group.id);
      expect(serializedGroup).toBeDefined();
      expect(serializedGroup!.name).toBe('Test Group');
      expect(serializedGroup!.color).toBe('#0000ff');
    });

    it('addSchemaPackage → toJSON().schemaPackages contains the package', async () => {
      const adapter = await getAdapter();
      const pkg = adapter.addSchemaPackage({ name: 'Test Package', color: '#ff00ff' });
      const json = adapter.toJSON();

      const serializedPackage = json.schemaPackages.find((p: SchemaPackage) => p.id === pkg.id);
      expect(serializedPackage).toBeDefined();
      expect(serializedPackage!.name).toBe('Test Package');
      expect(serializedPackage!.color).toBe('#ff00ff');
    });

    it('addSchemaRelationship → toJSON().schemaRelationships contains the relationship', async () => {
      const adapter = await getAdapter();

      // Add schemas and ports first
      adapter.addSchema(createTestSchema('Source'));
      adapter.addSchema(createTestSchema('Target'));
      adapter.addPortSchema({
        id: 'source-port',
        displayName: 'Source Port',
        semanticDescription: '',
        polarity: 'source',
        compatibleWith: ['target-port'],
        color: '#ff0000',
      });
      adapter.addPortSchema({
        id: 'target-port',
        displayName: 'Target Port',
        semanticDescription: '',
        polarity: 'sink',
        compatibleWith: ['source-port'],
        color: '#00ff00',
      });

      const relationshipId = crypto.randomUUID();
      const relationship: SchemaRelationship = {
        id: relationshipId,
        sourceSchemaType: 'Source',
        sourcePortId: 'source-port',
        targetSchemaType: 'Target',
        targetPortId: 'target-port',
        label: 'Test Relationship',
      };

      adapter.addSchemaRelationship(relationship);
      const json = adapter.toJSON();

      const serializedRel = json.schemaRelationships.find((r: SchemaRelationship) => r.id === relationshipId);
      expect(serializedRel).toBeDefined();
      expect(serializedRel!.sourceSchemaType).toBe('Source');
      expect(serializedRel!.targetSchemaType).toBe('Target');
      expect(serializedRel!.label).toBe('Test Relationship');
    });
  });

  describe('Node/edge round-trip', () => {
    it('setNodes → page in toJSON().pages contains those nodes', async () => {
      const adapter = await getAdapter();

      // First add a schema so nodes can reference it
      adapter.addSchema(createTestSchema('Task'));

      const nodes = [
        createTestNode({ id: 'node1', type: 'Task', semanticId: 'task-1', x: 100, y: 200 }),
        createTestNode({ id: 'node2', type: 'Task', semanticId: 'task-2', x: 300, y: 400 }),
      ];

      adapter.setNodes(nodes);
      const json = adapter.toJSON();

      // The default page should have our nodes
      expect(json.pages.length).toBeGreaterThan(0);
      const defaultPage = json.pages[0];
      expect(defaultPage.nodes).toHaveLength(2);

      const node1 = defaultPage.nodes.find((n: any) => n.id === 'node1');
      const node2 = defaultPage.nodes.find((n: any) => n.id === 'node2');

      expect(node1).toBeDefined();
      expect(node1.position.x).toBe(100);
      expect(node1.position.y).toBe(200);
      expect(node2).toBeDefined();
      expect(node2.position.x).toBe(300);
      expect(node2.position.y).toBe(400);
    });

    it('setEdges → page in toJSON().pages contains those edges', async () => {
      const adapter = await getAdapter();

      // Add schema and nodes first
      adapter.addSchema(createTestSchema('Task'));
      const nodes = [
        createTestNode({ id: 'node1', type: 'Task' }),
        createTestNode({ id: 'node2', type: 'Task' }),
      ];
      adapter.setNodes(nodes);

      const edges = [
        createTestEdge({ source: 'node1', target: 'node2', sourceHandle: 'flow-out', targetHandle: 'flow-in' }),
      ];

      adapter.setEdges(edges);
      const json = adapter.toJSON();

      const defaultPage = json.pages[0];
      expect(defaultPage.edges).toHaveLength(1);

      const edge = defaultPage.edges[0];
      expect(edge.source).toBe('node1');
      expect(edge.target).toBe('node2');
      expect(edge.sourceHandle).toBe('flow-out');
      expect(edge.targetHandle).toBe('flow-in');
    });
  });

  describe('Multi-page round-trip', () => {
    it('createPage, setActive, add nodes → toJSON().pages has both pages with correct nodes', async () => {
      const adapter = await getAdapter();

      // Add a schema
      adapter.addSchema(createTestSchema('Task'));

      // Add nodes to the default page
      const page1Nodes = [createTestNode({ id: 'p1-node1', type: 'Task' })];
      adapter.setNodes(page1Nodes);

      // Create a new page and make it active
      const page2 = adapter.createPage('Second Page');
      adapter.setActivePage(page2.id);

      // Add nodes to the second page
      const page2Nodes = [createTestNode({ id: 'p2-node1', type: 'Task' })];
      adapter.setNodes(page2Nodes);

      const json = adapter.toJSON();

      expect(json.pages).toHaveLength(2);

      const firstPage = json.pages.find((p: any) => p.name !== 'Second Page');
      const secondPage = json.pages.find((p: any) => p.name === 'Second Page');

      expect(firstPage).toBeDefined();
      expect(firstPage!.nodes).toHaveLength(1);
      expect(firstPage!.nodes[0].id).toBe('p1-node1');

      expect(secondPage).toBeDefined();
      expect(secondPage!.nodes).toHaveLength(1);
      expect(secondPage!.nodes[0].id).toBe('p2-node1');
    });
  });

  describe('Metadata round-trip', () => {
    it('setTitle → toJSON().title matches', async () => {
      const adapter = await getAdapter();
      adapter.setTitle('My Test Architecture');
      const json = adapter.toJSON();
      expect(json.title).toBe('My Test Architecture');
    });

    it('setDescription → toJSON().description matches', async () => {
      const adapter = await getAdapter();
      adapter.setDescription('This is a test description');
      const json = adapter.toJSON();
      expect(json.description).toBe('This is a test description');
    });
  });

  describe('Completeness property', () => {
    it('all fields populated → toJSON() returns complete CartaDocumentV4 with all non-empty fields', async () => {
      const adapter = await getAdapter();

      // Set title and description
      adapter.setTitle('Complete Test Document');
      adapter.setDescription('A fully populated test document');

      // Add schemas
      adapter.addSchema(createTestSchema('Service'));
      adapter.addSchema(createTestSchema('Database'));

      // Add port schemas
      adapter.addPortSchema({
        id: 'api-in',
        displayName: 'API In',
        semanticDescription: 'API input',
        polarity: 'sink',
        compatibleWith: ['api-out'],
        color: '#ff0000',
      });
      adapter.addPortSchema({
        id: 'api-out',
        displayName: 'API Out',
        semanticDescription: 'API output',
        polarity: 'source',
        compatibleWith: ['api-in'],
        color: '#00ff00',
      });

      // Add schema group
      const group = adapter.addSchemaGroup({ name: 'Infrastructure', color: '#0000ff' });

      // Add schema package
      const pkg = adapter.addSchemaPackage({ name: 'Core Package', color: '#ff00ff' });

      // Add schema relationship
      const relationshipId = crypto.randomUUID();
      const relationship: SchemaRelationship = {
        id: relationshipId,
        sourceSchemaType: 'Service',
        sourcePortId: 'api-out',
        targetSchemaType: 'Database',
        targetPortId: 'api-in',
        label: 'Accesses',
      };
      adapter.addSchemaRelationship(relationship);

      // Add nodes and edges to default page
      const nodes = [
        createTestNode({ id: 'svc1', type: 'Service', semanticId: 'service-1' }),
        createTestNode({ id: 'db1', type: 'Database', semanticId: 'database-1' }),
      ];
      adapter.setNodes(nodes);

      const edges = [
        createTestEdge({ source: 'svc1', target: 'db1' }),
      ];
      adapter.setEdges(edges);

      // Create a second page
      const page2 = adapter.createPage('Architecture Overview');
      adapter.setActivePage(page2.id);
      const page2Nodes = [
        createTestNode({ id: 'svc2', type: 'Service', semanticId: 'service-2' }),
      ];
      adapter.setNodes(page2Nodes);

      // Serialize
      const json = adapter.toJSON();

      // Assert structure
      expect(json.version).toBe(4);
      expect(json.title).toBe('Complete Test Document');
      expect(json.description).toBe('A fully populated test document');

      // Assert all schema-related fields are non-empty
      expect(json.schemas.length).toBeGreaterThan(0);
      expect(json.portSchemas.length).toBeGreaterThan(0);
      expect(json.schemaGroups.length).toBeGreaterThan(0);
      expect(json.schemaPackages.length).toBeGreaterThan(0);
      expect(json.schemaRelationships.length).toBeGreaterThan(0);

      // Assert pages
      expect(json.pages.length).toBe(2);

      // Assert first page has nodes and edges
      const firstPage = json.pages.find((p: any) => p.name !== 'Architecture Overview');
      expect(firstPage).toBeDefined();
      expect(firstPage!.nodes.length).toBeGreaterThan(0);
      expect(firstPage!.edges.length).toBeGreaterThan(0);

      // Assert second page has nodes
      const secondPage = json.pages.find((p: any) => p.name === 'Architecture Overview');
      expect(secondPage).toBeDefined();
      expect(secondPage!.nodes.length).toBeGreaterThan(0);

      // Assert active page is set
      expect(json.activePage).toBe(page2.id);

      // Verify specific IDs are preserved
      expect(json.schemaGroups.some((g: SchemaGroup) => g.id === group.id)).toBe(true);
      expect(json.schemaPackages.some((p: SchemaPackage) => p.id === pkg.id)).toBe(true);
      expect(json.schemaRelationships.some((r: SchemaRelationship) => r.id === relationshipId)).toBe(true);
    });
  });

  describe('Field completeness', () => {
    it('toJSON() includes packageManifest field', async () => {
      const adapter = await getAdapter();
      const json = adapter.toJSON();
      expect(json).toHaveProperty('packageManifest');
    });

    it('toJSON() includes activePage field', async () => {
      const adapter = await getAdapter();
      const json = adapter.toJSON();
      expect(json).toHaveProperty('activePage');
    });

    it('toJSON() returns all required CartaDocumentV4 fields', async () => {
      const adapter = await getAdapter();
      const json = adapter.toJSON();

      // Required fields
      expect(json).toHaveProperty('version');
      expect(json).toHaveProperty('title');
      expect(json).toHaveProperty('pages');
      expect(json).toHaveProperty('schemas');
      expect(json).toHaveProperty('portSchemas');
      expect(json).toHaveProperty('schemaGroups');
      expect(json).toHaveProperty('schemaPackages');
      expect(json).toHaveProperty('schemaRelationships');

      // Optional fields (should still be present, even if undefined/empty)
      expect(json).toHaveProperty('description');
      expect(json).toHaveProperty('activePage');
      expect(json).toHaveProperty('packageManifest');
    });
  });
});
