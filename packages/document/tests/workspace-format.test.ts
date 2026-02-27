import { describe, it, expect } from 'vitest';
import {
  validateWorkspaceManifest,
  validateGroupMeta,
  validateCanvasFile,
  validateSchemasFile,
  parseWorkspaceManifest,
  parseGroupMeta,
  parseCanvasFile,
  parseSchemasFile,
  serializeWorkspaceManifest,
  serializeGroupMeta,
  serializeCanvasFile,
  serializeSchemasFile,
} from '../src/workspace-format';
import type {
  WorkspaceManifest,
  GroupMeta,
  CanvasFile,
  SchemasFile,
} from '../src/workspace-format';

// ============================================
// WorkspaceManifest
// ============================================

describe('WorkspaceManifest', () => {
  const validManifest: WorkspaceManifest = {
    formatVersion: 1,
    title: 'My Project',
    description: 'A test project',
  };

  it('valid manifest round-trips through parse/serialize', () => {
    const serialized = serializeWorkspaceManifest(validManifest);
    const parsed = parseWorkspaceManifest(serialized);
    expect(parsed).toEqual(validManifest);
  });

  it('valid manifest without description round-trips', () => {
    const manifest: WorkspaceManifest = { formatVersion: 1, title: 'Minimal' };
    const serialized = serializeWorkspaceManifest(manifest);
    const parsed = parseWorkspaceManifest(serialized);
    expect(parsed).toEqual(manifest);
  });

  it('missing formatVersion throws', () => {
    expect(() => validateWorkspaceManifest({ title: 'My Project' })).toThrow(
      'formatVersion must be 1',
    );
  });

  it('wrong formatVersion throws', () => {
    expect(() => validateWorkspaceManifest({ formatVersion: 2, title: 'My Project' })).toThrow(
      'formatVersion must be 1',
    );
  });

  it('missing title throws', () => {
    expect(() => validateWorkspaceManifest({ formatVersion: 1 })).toThrow(
      'missing or invalid title',
    );
  });

  it('non-string title throws', () => {
    expect(() => validateWorkspaceManifest({ formatVersion: 1, title: 42 })).toThrow(
      'missing or invalid title',
    );
  });

  it('non-object input throws', () => {
    expect(() => validateWorkspaceManifest('not an object')).toThrow('expected JSON object');
  });

  it('null input throws', () => {
    expect(() => validateWorkspaceManifest(null)).toThrow('expected JSON object');
  });

  it('invalid description type throws', () => {
    expect(() =>
      validateWorkspaceManifest({ formatVersion: 1, title: 'T', description: 42 }),
    ).toThrow('description must be a string');
  });

  it('serialize produces valid JSON with 2-space indent', () => {
    const serialized = serializeWorkspaceManifest(validManifest);
    expect(serialized).toContain('\n  ');
    expect(JSON.parse(serialized)).toEqual(validManifest);
  });
});

// ============================================
// GroupMeta
// ============================================

describe('GroupMeta', () => {
  const validGroupMeta: GroupMeta = {
    name: 'Infrastructure',
    description: 'Infrastructure components',
  };

  it('valid group meta round-trips through parse/serialize', () => {
    const serialized = serializeGroupMeta(validGroupMeta);
    const parsed = parseGroupMeta(serialized);
    expect(parsed).toEqual(validGroupMeta);
  });

  it('group meta without description round-trips', () => {
    const meta: GroupMeta = { name: 'Frontend' };
    const serialized = serializeGroupMeta(meta);
    const parsed = parseGroupMeta(serialized);
    expect(parsed).toEqual(meta);
  });

  it('missing name throws', () => {
    expect(() => validateGroupMeta({ description: 'no name' })).toThrow('missing or invalid name');
  });

  it('non-string name throws', () => {
    expect(() => validateGroupMeta({ name: 123 })).toThrow('missing or invalid name');
  });

  it('non-object input throws', () => {
    expect(() => validateGroupMeta(null)).toThrow('expected JSON object');
  });

  it('invalid description type throws', () => {
    expect(() => validateGroupMeta({ name: 'Infra', description: true })).toThrow(
      'description must be a string',
    );
  });
});

// ============================================
// CanvasFile
// ============================================

describe('CanvasFile', () => {
  const constructNode = {
    id: 'node-1',
    type: 'construct',
    position: { x: 100, y: 200 },
    data: {
      semanticId: 'ServiceA',
      schemaType: 'Service',
    },
  };

  const organizerNode = {
    id: 'org-1',
    type: 'organizer',
    position: { x: 0, y: 0 },
    data: {
      isOrganizer: true,
      label: 'Group A',
    },
  };

  const validEdge = {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
  };

  const validCanvas: CanvasFile = {
    formatVersion: 1,
    nodes: [constructNode],
    edges: [validEdge],
  };

  it('valid canvas with construct nodes round-trips through parse/serialize', () => {
    const serialized = serializeCanvasFile(validCanvas);
    const parsed = parseCanvasFile(serialized);
    expect(parsed).toEqual(validCanvas);
  });

  it('valid canvas with organizer nodes round-trips', () => {
    const canvas: CanvasFile = {
      formatVersion: 1,
      nodes: [organizerNode],
      edges: [],
    };
    const serialized = serializeCanvasFile(canvas);
    const parsed = parseCanvasFile(serialized);
    expect(parsed).toEqual(canvas);
  });

  it('empty nodes and edges arrays are valid', () => {
    const canvas: CanvasFile = { formatVersion: 1, nodes: [], edges: [] };
    const serialized = serializeCanvasFile(canvas);
    const parsed = parseCanvasFile(serialized);
    expect(parsed).toEqual(canvas);
  });

  it('canvas with connections validates connection fields', () => {
    const nodeWithConnection = {
      id: 'node-conn',
      type: 'construct',
      position: { x: 0, y: 0 },
      data: {
        semanticId: 'NodeA',
        connections: [
          {
            portId: 'port-out',
            targetSemanticId: 'NodeB',
            targetPortId: 'port-in',
          },
        ],
      },
    };
    const canvas: CanvasFile = { formatVersion: 1, nodes: [nodeWithConnection], edges: [] };
    const serialized = serializeCanvasFile(canvas);
    const parsed = parseCanvasFile(serialized);
    expect(parsed).toEqual(canvas);
  });

  it('connection missing portId throws', () => {
    const nodeWithBadConn = {
      id: 'node-bad',
      type: 'construct',
      position: { x: 0, y: 0 },
      data: {
        connections: [{ targetSemanticId: 'NodeB', targetPortId: 'port-in' }],
      },
    };
    expect(() => validateCanvasFile({ formatVersion: 1, nodes: [nodeWithBadConn], edges: [] })).toThrow(
      'connection missing required fields',
    );
  });

  it('connection missing targetSemanticId throws', () => {
    const nodeWithBadConn = {
      id: 'node-bad',
      type: 'construct',
      position: { x: 0, y: 0 },
      data: {
        connections: [{ portId: 'port-out', targetPortId: 'port-in' }],
      },
    };
    expect(() => validateCanvasFile({ formatVersion: 1, nodes: [nodeWithBadConn], edges: [] })).toThrow(
      'connection missing required fields',
    );
  });

  it('connection missing targetPortId throws', () => {
    const nodeWithBadConn = {
      id: 'node-bad',
      type: 'construct',
      position: { x: 0, y: 0 },
      data: {
        connections: [{ portId: 'port-out', targetSemanticId: 'NodeB' }],
      },
    };
    expect(() => validateCanvasFile({ formatVersion: 1, nodes: [nodeWithBadConn], edges: [] })).toThrow(
      'connection missing required fields',
    );
  });

  it('connections must be array throws when non-array', () => {
    const nodeWithBadConn = {
      id: 'node-bad',
      type: 'construct',
      position: { x: 0, y: 0 },
      data: { connections: 'not-an-array' },
    };
    expect(() => validateCanvasFile({ formatVersion: 1, nodes: [nodeWithBadConn], edges: [] })).toThrow(
      'invalid connections (must be array)',
    );
  });

  it('missing formatVersion throws', () => {
    expect(() => validateCanvasFile({ nodes: [], edges: [] })).toThrow('formatVersion must be 1');
  });

  it('invalid node missing id throws', () => {
    const badNode = { type: 'construct', position: { x: 0, y: 0 } };
    expect(() => validateCanvasFile({ formatVersion: 1, nodes: [badNode], edges: [] })).toThrow(
      'node missing required fields',
    );
  });

  it('invalid node missing position throws', () => {
    const badNode = { id: 'n1', type: 'construct' };
    expect(() => validateCanvasFile({ formatVersion: 1, nodes: [badNode], edges: [] })).toThrow(
      'node missing required fields',
    );
  });

  it('invalid node missing type throws', () => {
    const badNode = { id: 'n1', position: { x: 0, y: 0 } };
    expect(() => validateCanvasFile({ formatVersion: 1, nodes: [badNode], edges: [] })).toThrow(
      'node missing required fields',
    );
  });

  it('invalid edge missing id throws', () => {
    const badEdge = { source: 'n1', target: 'n2' };
    expect(() => validateCanvasFile({ formatVersion: 1, nodes: [], edges: [badEdge] })).toThrow(
      'edge missing required fields',
    );
  });

  it('invalid edge missing source throws', () => {
    const badEdge = { id: 'e1', target: 'n2' };
    expect(() => validateCanvasFile({ formatVersion: 1, nodes: [], edges: [badEdge] })).toThrow(
      'edge missing required fields',
    );
  });

  it('invalid edge missing target throws', () => {
    const badEdge = { id: 'e1', source: 'n1' };
    expect(() => validateCanvasFile({ formatVersion: 1, nodes: [], edges: [badEdge] })).toThrow(
      'edge missing required fields',
    );
  });

  it('non-object input throws', () => {
    expect(() => validateCanvasFile(null)).toThrow('expected JSON object');
  });
});

// ============================================
// SchemasFile
// ============================================

describe('SchemasFile', () => {
  const validSchema = {
    type: 'Service',
    displayName: 'Service',
    color: '#4a9eff',
    fields: [],
    compilation: { template: '{{displayName}}' },
  };

  const validPortSchema = {
    id: 'port-http',
    displayName: 'HTTP',
    semanticDescription: 'HTTP connection',
    polarity: 'source' as const,
    compatibleWith: ['port-http'],
    color: '#00ff00',
  };

  const validSchemaGroup = {
    id: 'group-1',
    name: 'Core',
  };

  const validSchemaPackage = {
    id: 'pkg-1',
    name: 'Standard Library',
    color: '#7c7fca',
  };

  const validSchemasFile: SchemasFile = {
    formatVersion: 1,
    schemas: [validSchema],
    portSchemas: [validPortSchema],
    schemaGroups: [validSchemaGroup],
    schemaRelationships: [],
    schemaPackages: [validSchemaPackage],
    packageManifest: [],
  };

  it('valid schemas file with all sections round-trips through parse/serialize', () => {
    const serialized = serializeSchemasFile(validSchemasFile);
    const parsed = parseSchemasFile(serialized);
    expect(parsed).toEqual(validSchemasFile);
  });

  it('schemas file with empty arrays is valid', () => {
    const file: SchemasFile = {
      formatVersion: 1,
      schemas: [],
      portSchemas: [],
      schemaGroups: [],
      schemaRelationships: [],
      schemaPackages: [],
    };
    const serialized = serializeSchemasFile(file);
    const parsed = parseSchemasFile(serialized);
    expect(parsed).toEqual(file);
  });

  it('packageManifest is optional — absent in input is valid', () => {
    const file = {
      formatVersion: 1,
      schemas: [],
      portSchemas: [],
      schemaGroups: [],
      schemaRelationships: [],
      schemaPackages: [],
    };
    const result = validateSchemasFile(file);
    expect(result.packageManifest).toBeUndefined();
  });

  it('missing schemas array throws', () => {
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        portSchemas: [],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('missing or invalid schemas array');
  });

  it('invalid schema missing type throws', () => {
    const badSchema = {
      displayName: 'Service',
      color: '#fff',
      fields: [],
      compilation: {},
    };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [badSchema],
        portSchemas: [],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('schema missing required fields');
  });

  it('invalid schema missing displayName throws', () => {
    const badSchema = { type: 'Svc', color: '#fff', fields: [], compilation: {} };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [badSchema],
        portSchemas: [],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('schema missing required fields');
  });

  it('invalid schema missing color throws', () => {
    const badSchema = { type: 'Svc', displayName: 'Service', fields: [], compilation: {} };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [badSchema],
        portSchemas: [],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('schema missing required fields');
  });

  it('invalid schema missing fields throws', () => {
    const badSchema = { type: 'Svc', displayName: 'Service', color: '#fff', compilation: {} };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [badSchema],
        portSchemas: [],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('schema missing required fields');
  });

  it('invalid schema missing compilation throws', () => {
    const badSchema = { type: 'Svc', displayName: 'Service', color: '#fff', fields: [] };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [badSchema],
        portSchemas: [],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('schema missing required fields');
  });

  it('port schema validation — missing id throws', () => {
    const badPort = {
      displayName: 'HTTP',
      semanticDescription: 'desc',
      polarity: 'source',
      compatibleWith: [],
      color: '#fff',
    };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [],
        portSchemas: [badPort],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('portSchema missing required fields');
  });

  it('port schema validation — missing displayName throws', () => {
    const badPort = {
      id: 'p1',
      semanticDescription: 'desc',
      polarity: 'source',
      compatibleWith: [],
      color: '#fff',
    };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [],
        portSchemas: [badPort],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('portSchema missing required fields');
  });

  it('port schema validation — missing semanticDescription throws', () => {
    const badPort = {
      id: 'p1',
      displayName: 'HTTP',
      polarity: 'source',
      compatibleWith: [],
      color: '#fff',
    };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [],
        portSchemas: [badPort],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('portSchema missing required fields');
  });

  it('port schema validation — missing polarity throws', () => {
    const badPort = {
      id: 'p1',
      displayName: 'HTTP',
      semanticDescription: 'desc',
      compatibleWith: [],
      color: '#fff',
    };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [],
        portSchemas: [badPort],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('portSchema missing required fields');
  });

  it('port schema validation — missing compatibleWith throws', () => {
    const badPort = {
      id: 'p1',
      displayName: 'HTTP',
      semanticDescription: 'desc',
      polarity: 'source',
      color: '#fff',
    };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [],
        portSchemas: [badPort],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('portSchema missing required fields');
  });

  it('port schema validation — missing color throws', () => {
    const badPort = {
      id: 'p1',
      displayName: 'HTTP',
      semanticDescription: 'desc',
      polarity: 'source',
      compatibleWith: [],
    };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [],
        portSchemas: [badPort],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('portSchema missing required fields');
  });

  it('port schema validation — invalid polarity throws', () => {
    const badPort = {
      id: 'p1',
      displayName: 'HTTP',
      semanticDescription: 'desc',
      polarity: 'unknown-polarity',
      compatibleWith: [],
      color: '#fff',
    };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [],
        portSchemas: [badPort],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('invalid polarity');
  });

  it('all five valid polarities are accepted', () => {
    const polarities = ['source', 'sink', 'bidirectional', 'relay', 'intercept'];
    for (const polarity of polarities) {
      const port = {
        id: 'p1',
        displayName: 'Port',
        semanticDescription: 'desc',
        polarity,
        compatibleWith: [],
        color: '#fff',
      };
      expect(() =>
        validateSchemasFile({
          formatVersion: 1,
          schemas: [],
          portSchemas: [port],
          schemaGroups: [],
          schemaRelationships: [],
          schemaPackages: [],
        }),
      ).not.toThrow();
    }
  });

  it('missing formatVersion throws', () => {
    expect(() =>
      validateSchemasFile({
        schemas: [],
        portSchemas: [],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('formatVersion must be 1');
  });

  it('non-object input throws', () => {
    expect(() => validateSchemasFile(42)).toThrow('expected JSON object');
  });

  it('serialize produces valid JSON with 2-space indent', () => {
    const serialized = serializeSchemasFile(validSchemasFile);
    expect(serialized).toContain('\n  ');
    expect(JSON.parse(serialized)).toEqual(validSchemasFile);
  });

  it('schema with ports — valid ports pass validation', () => {
    const schemaWithPorts = {
      type: 'Service',
      displayName: 'Service',
      color: '#4a9eff',
      fields: [],
      compilation: {},
      ports: [{ id: 'p1', portType: 'http', label: 'HTTP Out' }],
    };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [schemaWithPorts],
        portSchemas: [],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).not.toThrow();
  });

  it('schema with ports — port missing id throws', () => {
    const schemaWithBadPort = {
      type: 'Service',
      displayName: 'Service',
      color: '#4a9eff',
      fields: [],
      compilation: {},
      ports: [{ portType: 'http', label: 'HTTP' }],
    };
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [schemaWithBadPort],
        portSchemas: [],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
      }),
    ).toThrow('port missing required fields');
  });

  it('non-array packageManifest throws', () => {
    expect(() =>
      validateSchemasFile({
        formatVersion: 1,
        schemas: [],
        portSchemas: [],
        schemaGroups: [],
        schemaRelationships: [],
        schemaPackages: [],
        packageManifest: 'not-an-array',
      }),
    ).toThrow('packageManifest must be an array');
  });
});
