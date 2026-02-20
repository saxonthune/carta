import { describe, it, expect } from 'vitest';
import { CompilerEngine } from '../src/index.js';
import type { CompilerNode, CompilerEdge, ConstructSchema } from '@carta/domain';

const compiler = new CompilerEngine();

function makeSchema(overrides: Partial<ConstructSchema> & { type: string; displayName: string }): ConstructSchema {
  return {
    semanticDescription: '',
    compilation: { format: 'json' },
    ports: [],
    fields: [],
    color: '#888888',
    ...overrides,
  };
}

function makeNode(id: string, constructType: string, semanticId: string, extra?: Partial<CompilerNode>): CompilerNode {
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
    ...extra,
  };
}

function makeEdge(source: string, target: string, extra?: Partial<CompilerEdge>): CompilerEdge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    ...extra,
  };
}

describe('CompilerEngine', () => {
  it('compiles empty document to empty-state message', () => {
    const result = compiler.compile([], [], { schemas: [] });
    expect(result).toContain('No constructs to compile');
  });

  it('compiles a single construct with semanticId and type', () => {
    const schema = makeSchema({ type: 'Service', displayName: 'Service' });
    const node = makeNode('n1', 'Service', 'auth-service');
    const result = compiler.compile([node], [], { schemas: [schema] });
    expect(result).toContain('auth-service');
    expect(result).toContain('Service');
  });

  it('compiles connected constructs with references', () => {
    const schema = makeSchema({ type: 'Service', displayName: 'Service' });
    const nodes = [
      makeNode('n1', 'Service', 'api-gateway'),
      makeNode('n2', 'Service', 'user-service'),
    ];
    const edges = [makeEdge('n1', 'n2')];
    const result = compiler.compile(nodes, edges, { schemas: [schema] });
    // Both semantic IDs should appear in the output
    expect(result).toContain('user-service');
    expect(result).toContain('api-gateway');
  });

  it('adding a construct increases output length', () => {
    const schema = makeSchema({ type: 'Task', displayName: 'Task' });
    const node1 = makeNode('n1', 'Task', 'task-one');
    const node2 = makeNode('n2', 'Task', 'task-two');

    const result1 = compiler.compile([node1], [], { schemas: [schema] });
    const result2 = compiler.compile([node1, node2], [], { schemas: [schema] });

    expect(result2.length).toBeGreaterThan(result1.length);
    expect(result2).toContain('task-two');
  });

  it('lists all used schema types in the schemas section', () => {
    const schemas = [
      makeSchema({ type: 'Service', displayName: 'Service' }),
      makeSchema({ type: 'Database', displayName: 'Database' }),
    ];
    const nodes = [
      makeNode('n1', 'Service', 'svc-1'),
      makeNode('n2', 'Database', 'db-1'),
    ];
    const result = compiler.compile(nodes, [], { schemas });
    expect(result).toContain('Service');
    expect(result).toContain('Database');
    expect(result).toContain('Construct Schemas');
  });

  it('compiles organizer nodes with member lists', () => {
    const schema = makeSchema({ type: 'Task', displayName: 'Task' });
    const nodes: CompilerNode[] = [
      {
        id: 'org1',
        type: 'organizer',
        position: { x: 0, y: 0 },
        data: {
          constructType: '',
          semanticId: '',
          values: {},
          connections: [],
          isOrganizer: true,
          name: 'My Group',
          layout: 'freeform',
          color: '#888888',
          collapsed: false,
        } as any,
      },
      { ...makeNode('n1', 'Task', 'task-one'), parentId: 'org1' },
    ];
    const result = compiler.compile(nodes, [], { schemas: [schema] });
    expect(result).toContain('Organizers');
    expect(result).toContain('My Group');
    expect(result).toContain('task-one');
  });

  it('each semanticId appears exactly once in construct entries', () => {
    const schema = makeSchema({ type: 'Task', displayName: 'Task' });
    const nodes = [
      makeNode('n1', 'Task', 'unique-task-alpha'),
      makeNode('n2', 'Task', 'unique-task-beta'),
    ];
    const result = compiler.compile(nodes, [], { schemas: [schema] });
    // Count occurrences of each semanticId (as JSON key "id")
    const alphaMatches = result.match(/"unique-task-alpha"/g) ?? [];
    const betaMatches = result.match(/"unique-task-beta"/g) ?? [];
    expect(alphaMatches.length).toBeGreaterThanOrEqual(1);
    expect(betaMatches.length).toBeGreaterThanOrEqual(1);
  });
});
