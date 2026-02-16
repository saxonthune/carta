import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { DocumentTestProvider } from '../setup/testProviders';
import { createTestNode, createTestEdge } from '../setup/testHelpers';
import { CompilerEngine } from '@carta/compiler';
import type { ConstructSchema } from '@carta/domain';

const compiler = new CompilerEngine();

/** Get a ready adapter via DocumentContext */
async function getAdapter() {
  const { result } = renderHook(() => useDocumentContext(), { wrapper: DocumentTestProvider });
  await waitFor(() => {
    expect(result.current.isReady).toBe(true);
  });
  return result.current.adapter;
}

/** Compile current document state through the adapter → compiler pipeline.
 *  Uses `as any` cast — RF Node[]/Edge[] are structurally compatible with CompilerNode[]/CompilerEdge[].
 *  This is the same pattern as App.tsx:192. */
function compileDocument(adapter: any): string {
  const nodes = adapter.getNodes();
  const edges = adapter.getEdges();
  const schemas = adapter.getSchemas();
  return compiler.compile(nodes as any, edges as any, { schemas });
}

describe('Compiler as Semantic Oracle', () => {
  it('adding a construct increases compiler output by one entry', async () => {
    const adapter = await getAdapter();
    const schema: ConstructSchema = {
      type: 'OracleService',
      displayName: 'Oracle Service',
      color: '#888888',
      semanticDescription: '',
      compilation: { format: 'json' },
      ports: [],
      fields: [],
    };
    adapter.addSchema(schema);

    // Compile with one construct
    adapter.setNodes([
      createTestNode({ id: 'n1', type: 'OracleService', semanticId: 'svc-1' }),
    ]);
    const output1 = compileDocument(adapter);
    expect(output1).toContain('svc-1');

    // Add second construct — output should now contain both
    adapter.setNodes([
      createTestNode({ id: 'n1', type: 'OracleService', semanticId: 'svc-1' }),
      createTestNode({ id: 'n2', type: 'OracleService', semanticId: 'svc-2', x: 200 }),
    ]);
    const output2 = compileDocument(adapter);
    expect(output2).toContain('svc-1');
    expect(output2).toContain('svc-2');
    expect(output2.length).toBeGreaterThan(output1.length);
  });

  it('deleting a construct removes exactly its entry from output', async () => {
    const adapter = await getAdapter();
    adapter.addSchema({
      type: 'OracleTask',
      displayName: 'Oracle Task',
      color: '#888888',
      semanticDescription: '',
      compilation: { format: 'json' },
      ports: [],
      fields: [],
    });

    // Start with two constructs
    adapter.setNodes([
      createTestNode({ id: 'n1', type: 'OracleTask', semanticId: 'task-keep' }),
      createTestNode({ id: 'n2', type: 'OracleTask', semanticId: 'task-delete', x: 200 }),
    ]);
    const beforeOutput = compileDocument(adapter);
    expect(beforeOutput).toContain('task-delete');
    expect(beforeOutput).toContain('task-keep');

    // Remove one
    adapter.setNodes([
      createTestNode({ id: 'n1', type: 'OracleTask', semanticId: 'task-keep' }),
    ]);
    const afterOutput = compileDocument(adapter);
    expect(afterOutput).toContain('task-keep');
    expect(afterOutput).not.toContain('task-delete');
  });

  it('connecting two constructs adds references to compiler output', async () => {
    const adapter = await getAdapter();
    adapter.addSchema({
      type: 'OracleComponent',
      displayName: 'Oracle Component',
      color: '#888888',
      semanticDescription: '',
      compilation: { format: 'json' },
      ports: [],
      fields: [],
    });

    // Two unconnected constructs
    adapter.setNodes([
      createTestNode({ id: 'c1', type: 'OracleComponent', semanticId: 'component-a' }),
      createTestNode({ id: 'c2', type: 'OracleComponent', semanticId: 'component-b', x: 200 }),
    ]);
    const unconnectedOutput = compileDocument(adapter);
    // Unconnected: should NOT have references between them
    // (The word "component-b" should appear as an entry but not as a reference on component-a)

    // Connect them
    adapter.setEdges([
      createTestEdge({ source: 'c1', target: 'c2' }),
    ]);
    const connectedOutput = compileDocument(adapter);
    // Connected: compiler adds references/referencedBy metadata
    // component-a should reference component-b, and component-b should be referencedBy component-a
    expect(connectedOutput).toContain('component-a');
    expect(connectedOutput).toContain('component-b');

    // The connected output should be longer due to reference metadata
    expect(connectedOutput.length).toBeGreaterThan(unconnectedOutput.length);

    // Verify that references/referencedBy fields appear in the output
    // The compiler adds these as JSON fields when edges exist
    const hasReferences = connectedOutput.includes('"references"') || connectedOutput.includes('"referencedBy"');
    expect(hasReferences).toBe(true);
  });

  it('organizer membership appears in compiler output', async () => {
    const adapter = await getAdapter();
    adapter.addSchema({
      type: 'OracleModule',
      displayName: 'Oracle Module',
      color: '#888888',
      semanticDescription: '',
      compilation: { format: 'json' },
      ports: [],
      fields: [],
    });

    // Create an organizer node and a member construct
    const organizerNode = {
      id: 'org1',
      type: 'organizer',
      position: { x: 0, y: 0 },
      data: {
        constructType: '',
        semanticId: '',
        values: {},
        connections: [],
        isOrganizer: true,
        name: 'Test Group',
        layout: 'freeform',
        color: '#888888',
        collapsed: false,
      } as any,
    };
    const memberNode = {
      ...createTestNode({ id: 'm1', type: 'OracleModule', semanticId: 'grouped-module' }),
      parentId: 'org1',
    };

    adapter.setNodes([organizerNode, memberNode]);
    const output = compileDocument(adapter);

    // Organizer section should contain group name and member
    expect(output).toContain('Organizers');
    expect(output).toContain('Test Group');
    expect(output).toContain('grouped-module');
  });

  it('field values appear in compiled construct entries', async () => {
    const adapter = await getAdapter();
    adapter.addSchema({
      type: 'OracleEntity',
      displayName: 'Oracle Entity',
      color: '#888888',
      semanticDescription: '',
      compilation: { format: 'json' },
      ports: [],
      fields: [{ name: 'status', kind: 'string' }],
    });

    adapter.setNodes([
      createTestNode({
        id: 'e1',
        type: 'OracleEntity',
        semanticId: 'my-entity',
        values: { status: 'active' },
      }),
    ]);
    const output = compileDocument(adapter);
    expect(output).toContain('my-entity');
    expect(output).toContain('active');
  });
});
