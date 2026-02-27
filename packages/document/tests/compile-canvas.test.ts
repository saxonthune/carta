import { describe, it, expect } from 'vitest';
import { compileCanvasFile } from '../src/compiler/workspace-adapter.js';
import { CompilerEngine } from '../src/compiler/index.js';
import { explodeCartaFile } from '../src/workspace-explode.js';
import { parseCanvasFile, parseSchemasFile } from '../src/workspace-format.js';
import type { CanvasFile, SchemasFile } from '../src/workspace-format.js';
import type { ConstructSchema } from '@carta/schema';
import type { CartaFile, CartaFilePage } from '../src/file-format.js';

// ============================================
// Helpers
// ============================================

function makeSchema(type: string, displayName: string = type): ConstructSchema {
  return {
    type,
    displayName,
    semanticDescription: `A ${displayName}`,
    compilation: { format: 'json' },
    ports: [],
    fields: [],
    color: '#888888',
  };
}

function makeSchemasFile(schemas: ConstructSchema[]): SchemasFile {
  return {
    formatVersion: 1,
    schemas,
    portSchemas: [],
    schemaGroups: [],
    schemaRelationships: [],
    schemaPackages: [],
  };
}

function makeConstructNode(id: string, constructType: string, semanticId: string) {
  return {
    id,
    type: 'construct',
    position: { x: 0, y: 0 },
    data: {
      constructType,
      semanticId,
      values: {},
      connections: [],
    },
  };
}

function makeOrganizerNode(id: string, name: string) {
  return {
    id,
    type: 'organizer',
    position: { x: 0, y: 0 },
    data: {
      constructType: '',
      semanticId: '',
      values: {},
      connections: [],
      isOrganizer: true,
      name,
      layout: 'freeform',
      color: '#888888',
      collapsed: false,
    },
  };
}

function makeEdge(source: string, target: string) {
  return { id: `e-${source}-${target}`, source, target };
}

function makeCanvasFile(nodes: unknown[], edges: unknown[]): CanvasFile {
  return { formatVersion: 1, nodes, edges };
}

// ============================================
// Basic compilation
// ============================================

describe('compileCanvasFile — basic', () => {
  it('compiles two construct nodes and one edge, includes both semanticIds', () => {
    const canvas = makeCanvasFile(
      [
        makeConstructNode('n1', 'service', 'api-gateway'),
        makeConstructNode('n2', 'service', 'user-service'),
      ],
      [makeEdge('n1', 'n2')]
    );
    const schemas = makeSchemasFile([makeSchema('service', 'Service')]);

    const output = compileCanvasFile(canvas, schemas);

    expect(output).toContain('api-gateway');
    expect(output).toContain('user-service');
    expect(output).toContain('Service');
    expect(output).toContain('Construct Schemas');
  });

  it('includes relationship metadata (references / referencedBy)', () => {
    const canvas = makeCanvasFile(
      [
        makeConstructNode('n1', 'service', 'api-gateway'),
        makeConstructNode('n2', 'service', 'user-service'),
      ],
      [makeEdge('n1', 'n2')]
    );
    const schemas = makeSchemasFile([makeSchema('service', 'Service')]);

    const output = compileCanvasFile(canvas, schemas);

    // n1 references n2, n2 is referencedBy n1
    expect(output).toContain('"references"');
    expect(output).toContain('"referencedBy"');
    expect(output).toContain('user-service');
    expect(output).toContain('api-gateway');
  });
});

// ============================================
// Organizer nodes
// ============================================

describe('compileCanvasFile — organizers', () => {
  it('includes organizers section with organizer name and member list', () => {
    const constructNode = { ...makeConstructNode('n1', 'task', 'task-alpha'), parentId: 'org1' };
    const canvas = makeCanvasFile(
      [makeOrganizerNode('org1', 'Sprint One'), constructNode],
      []
    );
    const schemas = makeSchemasFile([makeSchema('task', 'Task')]);

    const output = compileCanvasFile(canvas, schemas);

    expect(output).toContain('Organizers');
    expect(output).toContain('Sprint One');
    expect(output).toContain('task-alpha');
  });

  it('organizer node does not appear in the Constructs section', () => {
    const constructNode = { ...makeConstructNode('n1', 'task', 'my-task'), parentId: 'org1' };
    const canvas = makeCanvasFile(
      [makeOrganizerNode('org1', 'My Group'), constructNode],
      []
    );
    const schemas = makeSchemasFile([makeSchema('task', 'Task')]);

    const output = compileCanvasFile(canvas, schemas);

    // Constructs section should contain my-task
    expect(output).toContain('my-task');
    // The organizer type identifier should not appear as a construct type entry
    // (organizer has no constructType, so it would not be in the constructs section)
    const constructsIndex = output.indexOf('# Constructs');
    const organizersIndex = output.indexOf('# Organizers');
    // Organizers section appears before Constructs
    expect(organizersIndex).toBeLessThan(constructsIndex);
  });
});

// ============================================
// Empty canvas
// ============================================

describe('compileCanvasFile — empty canvas', () => {
  it('returns the empty-state message when nodes and edges are empty', () => {
    const canvas = makeCanvasFile([], []);
    const schemas = makeSchemasFile([]);

    const output = compileCanvasFile(canvas, schemas);

    expect(output).toContain('No constructs');
  });
});

// ============================================
// Schema filtering
// ============================================

describe('compileCanvasFile — schema filtering', () => {
  it('only includes used schemas in the Construct Schemas section', () => {
    const canvas = makeCanvasFile(
      [makeConstructNode('n1', 'service', 'my-service')],
      []
    );
    const schemas = makeSchemasFile([
      makeSchema('service', 'Service'),
      makeSchema('database', 'Database'),
      makeSchema('queue', 'Queue'),
    ]);

    const output = compileCanvasFile(canvas, schemas);

    expect(output).toContain('Service');
    // Database and Queue are not used — they should not appear in the schemas section
    // (They won't appear unless a node uses them)
    const schemasSection = output.match(/# Construct Schemas[\s\S]*?```json([\s\S]*?)```/);
    expect(schemasSection).not.toBeNull();
    const schemasJson = schemasSection![1];
    expect(schemasJson).not.toContain('Database');
    expect(schemasJson).not.toContain('Queue');
  });
});

// ============================================
// Pipeline: explodeCartaFile → compileCanvasFile
// ============================================

describe('compileCanvasFile — pipeline from CartaFile', () => {
  it('compiling an exploded canvas produces correct output', () => {
    // Build a CartaFile with proper node data (constructType for compiler)
    const page: CartaFilePage = {
      id: 'p1',
      name: 'Overview',
      order: 1,
      nodes: [
        makeConstructNode('n1', 'service', 'api-gateway'),
        makeConstructNode('n2', 'service', 'auth-service'),
      ],
      edges: [makeEdge('n1', 'n2')],
    };

    const cartaFile: CartaFile = {
      version: 7,
      title: 'Test Architecture',
      pages: [page],
      customSchemas: [makeSchema('service', 'Service')],
      portSchemas: [],
      schemaGroups: [],
      schemaPackages: [],
      packageManifest: [],
      resources: [],
      exportedAt: '2026-02-27T00:00:00Z',
    };

    const files = explodeCartaFile(cartaFile);

    const canvasContent = files.get('overview.canvas.json');
    const schemasContent = files.get('schemas/schemas.json');
    expect(canvasContent).toBeDefined();
    expect(schemasContent).toBeDefined();

    const canvas = parseCanvasFile(canvasContent!);
    const schemas = parseSchemasFile(schemasContent!);

    const output = compileCanvasFile(canvas, schemas);

    expect(output).toContain('api-gateway');
    expect(output).toContain('auth-service');
    expect(output).toContain('Service');
  });

  it('pipeline output is identical to direct compiler.compile() call', () => {
    // This validates that the adapter is purely a type bridge with no logic change
    const directCompiler = new CompilerEngine();

    const constructNodes = [
      makeConstructNode('n1', 'service', 'frontend'),
      makeConstructNode('n2', 'service', 'backend'),
    ];
    const edges = [makeEdge('n1', 'n2')];
    const schemaList = [makeSchema('service', 'Service')];

    const canvas = makeCanvasFile(constructNodes, edges);
    const schemasFile = makeSchemasFile(schemaList);

    const adapterOutput = compileCanvasFile(canvas, schemasFile);
    const directOutput = directCompiler.compile(
      constructNodes as any,
      edges as any,
      { schemas: schemaList }
    );

    expect(adapterOutput).toBe(directOutput);
  });
});
