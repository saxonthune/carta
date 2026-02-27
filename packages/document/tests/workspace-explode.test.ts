import { describe, it, expect } from 'vitest';
import { explodeCartaFile } from '../src/workspace-explode';
import {
  parseWorkspaceManifest,
  parseCanvasFile,
  parseSchemasFile,
  parseGroupMeta,
} from '../src/workspace-format';
import type { CartaFile, CartaFilePage, CartaFileSpecGroup } from '../src/file-format';

// ============================================
// Helpers
// ============================================

function makeNode(id: string) {
  return {
    id,
    type: 'construct',
    position: { x: 0, y: 0 },
    data: { semanticId: id, schemaType: 'Service' },
  };
}

function makeEdge(id: string, source: string, target: string) {
  return { id, source, target };
}

function makePage(id: string, name: string, order: number): CartaFilePage {
  return {
    id,
    name,
    order,
    nodes: [makeNode(`${id}-node`)],
    edges: [makeEdge(`${id}-edge`, `${id}-node`, `${id}-node`)],
  };
}

function makeSchema(type: string) {
  return {
    type,
    displayName: type,
    color: '#4a9eff',
    fields: [],
    compilation: { format: 'text' as const, template: `{{${type}}}` },
  };
}

function makePortSchema(id: string) {
  return {
    id,
    displayName: id,
    semanticDescription: `${id} port`,
    polarity: 'source' as const,
    compatibleWith: [id],
    color: '#00ff00',
  };
}

function makeSpecGroup(
  id: string,
  name: string,
  order: number,
  items: Array<{ type: 'page'; id: string }>,
  description?: string,
): CartaFileSpecGroup {
  return { id, name, order, items, description };
}

function makeMinimalCartaFile(overrides: Partial<CartaFile> = {}): CartaFile {
  return {
    version: 7,
    title: 'Test Project',
    pages: [makePage('page-1', 'Main', 1)],
    customSchemas: [],
    portSchemas: [],
    schemaGroups: [],
    schemaPackages: [],
    packageManifest: [],
    exportedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================
// Round-trip test
// ============================================

describe('explodeCartaFile — round-trip', () => {
  it('all output files parse with workspace-format validators', () => {
    const schema1 = makeSchema('Service');
    const schema2 = makeSchema('Database');
    const portSchema = makePortSchema('port-http');

    const cartaFile = makeMinimalCartaFile({
      title: 'My Architecture',
      description: 'A test project',
      pages: [makePage('p1', 'Overview', 1), makePage('p2', 'Data Flow', 2)],
      customSchemas: [schema1, schema2],
      portSchemas: [portSchema],
    });

    const files = explodeCartaFile(cartaFile);

    // workspace.json must parse
    const manifestContent = files.get('workspace.json');
    expect(manifestContent).toBeDefined();
    const manifest = parseWorkspaceManifest(manifestContent!);
    expect(manifest.title).toBe('My Architecture');
    expect(manifest.description).toBe('A test project');
    expect(manifest.formatVersion).toBe(1);

    // schemas/schemas.json must parse
    const schemasContent = files.get('schemas/schemas.json');
    expect(schemasContent).toBeDefined();
    const schemas = parseSchemasFile(schemasContent!);
    expect(schemas.schemas).toHaveLength(2);
    expect(schemas.portSchemas).toHaveLength(1);
    expect(schemas.schemaRelationships).toEqual([]);

    // canvas files must parse
    const overviewContent = files.get('overview.canvas.json');
    expect(overviewContent).toBeDefined();
    const overviewCanvas = parseCanvasFile(overviewContent!);
    expect(overviewCanvas.formatVersion).toBe(1);
    expect(overviewCanvas.nodes).toHaveLength(1);

    const dataFlowContent = files.get('data-flow.canvas.json');
    expect(dataFlowContent).toBeDefined();
    const dataFlowCanvas = parseCanvasFile(dataFlowContent!);
    expect(dataFlowCanvas.nodes).toHaveLength(1);
  });

  it('all schemas appear in schemas/schemas.json', () => {
    const cartaFile = makeMinimalCartaFile({
      customSchemas: [makeSchema('Service'), makeSchema('Database'), makeSchema('Queue')],
      portSchemas: [makePortSchema('port-http'), makePortSchema('port-grpc')],
    });

    const files = explodeCartaFile(cartaFile);
    const schemas = parseSchemasFile(files.get('schemas/schemas.json')!);
    expect(schemas.schemas).toHaveLength(3);
    expect(schemas.portSchemas).toHaveLength(2);
    expect(schemas.schemas.map(s => s.type)).toContain('Service');
    expect(schemas.schemas.map(s => s.type)).toContain('Database');
    expect(schemas.schemas.map(s => s.type)).toContain('Queue');
  });

  it('all pages appear as canvas files', () => {
    const cartaFile = makeMinimalCartaFile({
      pages: [
        makePage('p1', 'Overview', 1),
        makePage('p2', 'Data Flow', 2),
        makePage('p3', 'Infrastructure', 3),
      ],
    });

    const files = explodeCartaFile(cartaFile);
    expect(files.has('overview.canvas.json')).toBe(true);
    expect(files.has('data-flow.canvas.json')).toBe(true);
    expect(files.has('infrastructure.canvas.json')).toBe(true);
  });
});

// ============================================
// Spec group test
// ============================================

describe('explodeCartaFile — spec groups', () => {
  it('pages land in correct group directories', () => {
    const cartaFile = makeMinimalCartaFile({
      pages: [
        makePage('p1', 'Vision', 1),
        makePage('p2', 'Backend', 2),
        makePage('p3', 'Frontend', 3),
      ],
      specGroups: [
        makeSpecGroup('sg1', 'Product Vision', 1, [{ type: 'page', id: 'p1' }], 'High-level vision'),
        makeSpecGroup('sg2', 'Backend', 2, [
          { type: 'page', id: 'p2' },
        ]),
      ],
    });

    const files = explodeCartaFile(cartaFile);

    // _group.json files
    const group1Meta = parseGroupMeta(files.get('01-product-vision/_group.json')!);
    expect(group1Meta.name).toBe('Product Vision');
    expect(group1Meta.description).toBe('High-level vision');

    const group2Meta = parseGroupMeta(files.get('02-backend/_group.json')!);
    expect(group2Meta.name).toBe('Backend');

    // Pages in correct dirs
    expect(files.has('01-product-vision/vision.canvas.json')).toBe(true);
    expect(files.has('02-backend/backend.canvas.json')).toBe(true);

    // Ungrouped page at root
    expect(files.has('frontend.canvas.json')).toBe(true);
  });

  it('spec group directory uses zero-padded order', () => {
    const cartaFile = makeMinimalCartaFile({
      pages: [makePage('p1', 'Overview', 1)],
      specGroups: [
        makeSpecGroup('sg5', 'Final Review', 5, [{ type: 'page', id: 'p1' }]),
      ],
    });

    const files = explodeCartaFile(cartaFile);
    expect(files.has('05-final-review/_group.json')).toBe(true);
    expect(files.has('05-final-review/overview.canvas.json')).toBe(true);
  });

  it('canvas files parse correctly when in group directory', () => {
    const cartaFile = makeMinimalCartaFile({
      pages: [makePage('p1', 'API Design', 1)],
      specGroups: [makeSpecGroup('sg1', 'Backend', 1, [{ type: 'page', id: 'p1' }])],
    });

    const files = explodeCartaFile(cartaFile);
    const canvasContent = files.get('01-backend/api-design.canvas.json');
    expect(canvasContent).toBeDefined();
    const canvas = parseCanvasFile(canvasContent!);
    expect(canvas.formatVersion).toBe(1);
    expect(canvas.nodes).toHaveLength(1);
  });
});

// ============================================
// Ungrouped test
// ============================================

describe('explodeCartaFile — ungrouped (no spec groups)', () => {
  it('all files are at the root level when no spec groups', () => {
    const cartaFile = makeMinimalCartaFile({
      pages: [makePage('p1', 'Main', 1), makePage('p2', 'Detail', 2)],
    });

    const files = explodeCartaFile(cartaFile);

    // No subdirectories (no path with two slashes)
    for (const key of files.keys()) {
      if (key === 'schemas/schemas.json') continue;
      expect(key).not.toContain('/');
    }

    expect(files.has('main.canvas.json')).toBe(true);
    expect(files.has('detail.canvas.json')).toBe(true);
  });
});

// ============================================
// Slug test
// ============================================

describe('explodeCartaFile — slug generation', () => {
  it('page name with spaces and v2 notation slugifies correctly', () => {
    const cartaFile = makeMinimalCartaFile({
      pages: [makePage('p1', 'Endpoint Map (v2)', 1)],
    });

    const files = explodeCartaFile(cartaFile);
    expect(files.has('endpoint-map-v2.canvas.json')).toBe(true);
  });

  it('page name with uppercase slugifies to lowercase', () => {
    const cartaFile = makeMinimalCartaFile({
      pages: [makePage('p1', 'My Service Architecture', 1)],
    });

    const files = explodeCartaFile(cartaFile);
    expect(files.has('my-service-architecture.canvas.json')).toBe(true);
  });

  it('page name with multiple special chars collapses to single dash', () => {
    const cartaFile = makeMinimalCartaFile({
      pages: [makePage('p1', 'API -- v3!!', 1)],
    });

    const files = explodeCartaFile(cartaFile);
    expect(files.has('api-v3.canvas.json')).toBe(true);
  });
});

// ============================================
// Empty document test
// ============================================

describe('explodeCartaFile — empty/minimal document', () => {
  it('one empty page, no schemas produces minimal output', () => {
    const emptyPage: CartaFilePage = {
      id: 'p1',
      name: 'Untitled',
      order: 1,
      nodes: [],
      edges: [],
    };

    const cartaFile = makeMinimalCartaFile({
      title: 'Empty Doc',
      pages: [emptyPage],
      customSchemas: [],
      portSchemas: [],
      });

    const files = explodeCartaFile(cartaFile);

    // Must have exactly: workspace.json, schemas/schemas.json, untitled.canvas.json
    expect(files.size).toBe(3);
    expect(files.has('workspace.json')).toBe(true);
    expect(files.has('schemas/schemas.json')).toBe(true);
    expect(files.has('untitled.canvas.json')).toBe(true);

    // workspace.json parses and has correct title
    const manifest = parseWorkspaceManifest(files.get('workspace.json')!);
    expect(manifest.title).toBe('Empty Doc');
    expect(manifest.description).toBeUndefined();

    // schemas.json parses with empty arrays
    const schemas = parseSchemasFile(files.get('schemas/schemas.json')!);
    expect(schemas.schemas).toHaveLength(0);
    expect(schemas.portSchemas).toHaveLength(0);
    expect(schemas.schemaRelationships).toEqual([]);

    // canvas file parses with empty arrays
    const canvas = parseCanvasFile(files.get('untitled.canvas.json')!);
    expect(canvas.nodes).toHaveLength(0);
    expect(canvas.edges).toHaveLength(0);
  });

  it('workspace.json description is absent when cartaFile has no description', () => {
    const cartaFile = makeMinimalCartaFile({ title: 'No Desc' });
    const files = explodeCartaFile(cartaFile);
    const manifest = parseWorkspaceManifest(files.get('workspace.json')!);
    expect(manifest.description).toBeUndefined();
  });

  it('workspace.json description is present when cartaFile has description', () => {
    const cartaFile = makeMinimalCartaFile({ title: 'Has Desc', description: 'A description' });
    const files = explodeCartaFile(cartaFile);
    const manifest = parseWorkspaceManifest(files.get('workspace.json')!);
    expect(manifest.description).toBe('A description');
  });
});

// ============================================
// Schemas file details
// ============================================

describe('explodeCartaFile — schemas file', () => {
  it('schemaRelationships is always empty array', () => {
    const cartaFile = makeMinimalCartaFile();
    const files = explodeCartaFile(cartaFile);
    const schemas = parseSchemasFile(files.get('schemas/schemas.json')!);
    expect(schemas.schemaRelationships).toEqual([]);
  });

  it('packageManifest is preserved when present', () => {
    const cartaFile = makeMinimalCartaFile({
      packageManifest: [{ id: 'pkg-1', contentHash: 'abc', installedAt: '2024-01-01' }],
    });
    const files = explodeCartaFile(cartaFile);
    const schemas = parseSchemasFile(files.get('schemas/schemas.json')!);
    expect(schemas.packageManifest).toHaveLength(1);
    expect(schemas.packageManifest![0].id).toBe('pkg-1');
  });

  it('schemaPackages are preserved', () => {
    const cartaFile = makeMinimalCartaFile({
      schemaPackages: [{ id: 'pkg-1', name: 'Standard Library', color: '#7c7fca' }],
    });
    const files = explodeCartaFile(cartaFile);
    const schemas = parseSchemasFile(files.get('schemas/schemas.json')!);
    expect(schemas.schemaPackages).toHaveLength(1);
    expect(schemas.schemaPackages[0].name).toBe('Standard Library');
  });
});
