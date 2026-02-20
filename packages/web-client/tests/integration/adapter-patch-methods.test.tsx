import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDocumentContext } from '../../src/contexts/DocumentContext';
import { DocumentTestProvider } from '../setup/testProviders';
import { createTestNode, createTestEdge } from '../setup/testHelpers';

// Get a ready adapter via the DocumentContext hook
async function getAdapter() {
  const { result } = renderHook(() => useDocumentContext(), { wrapper: DocumentTestProvider });
  await waitFor(() => {
    expect(result.current.isReady).toBe(true);
  });
  return result.current.adapter;
}

describe('patchNodes', () => {
  it('patches position only', async () => {
    const adapter = await getAdapter();
    const node1 = createTestNode({ id: 'node-1', x: 0, y: 0 });
    const node2 = createTestNode({ id: 'node-2', x: 100, y: 100 });

    adapter.setNodes([node1, node2]);

    adapter.patchNodes([{ id: 'node-1', position: { x: 50, y: 50 } }]);

    const nodes = adapter.getNodes();
    const updated = nodes.find(n => n.id === 'node-1');
    expect(updated).toBeDefined();
    expect(updated!.position).toEqual({ x: 50, y: 50 });

    // Other node unchanged
    const unchanged = nodes.find(n => n.id === 'node-2');
    expect(unchanged!.position).toEqual({ x: 100, y: 100 });
  });

  it('patches style only', async () => {
    const adapter = await getAdapter();
    const node1 = createTestNode({ id: 'node-1', x: 0, y: 0 });

    adapter.setNodes([node1]);

    adapter.patchNodes([{ id: 'node-1', style: { width: 200, height: 150 } }]);

    const nodes = adapter.getNodes();
    const updated = nodes.find(n => n.id === 'node-1');
    expect(updated).toBeDefined();
    expect(updated!.style).toEqual({ width: 200, height: 150 });
  });

  it('patches multiple nodes in one call', async () => {
    const adapter = await getAdapter();
    const node1 = createTestNode({ id: 'node-1', x: 0, y: 0 });
    const node2 = createTestNode({ id: 'node-2', x: 100, y: 100 });
    const node3 = createTestNode({ id: 'node-3', x: 200, y: 200 });

    adapter.setNodes([node1, node2, node3]);

    adapter.patchNodes([
      { id: 'node-1', position: { x: 10, y: 10 } },
      { id: 'node-2', position: { x: 110, y: 110 } },
      { id: 'node-3', position: { x: 210, y: 210 } },
    ]);

    const nodes = adapter.getNodes();
    expect(nodes.find(n => n.id === 'node-1')!.position).toEqual({ x: 10, y: 10 });
    expect(nodes.find(n => n.id === 'node-2')!.position).toEqual({ x: 110, y: 110 });
    expect(nodes.find(n => n.id === 'node-3')!.position).toEqual({ x: 210, y: 210 });
  });

  it('patches position and style together', async () => {
    const adapter = await getAdapter();
    const node1 = createTestNode({ id: 'node-1', x: 0, y: 0 });

    adapter.setNodes([node1]);

    adapter.patchNodes([{
      id: 'node-1',
      position: { x: 50, y: 50 },
      style: { width: 300, height: 200 },
    }]);

    const nodes = adapter.getNodes();
    const updated = nodes.find(n => n.id === 'node-1');
    expect(updated!.position).toEqual({ x: 50, y: 50 });
    expect(updated!.style).toEqual({ width: 300, height: 200 });
  });

  it('patches nonexistent node without error, other patches still apply', async () => {
    const adapter = await getAdapter();
    const node1 = createTestNode({ id: 'node-1', x: 0, y: 0 });

    adapter.setNodes([node1]);

    // Patch both existing and nonexistent nodes
    adapter.patchNodes([
      { id: 'nonexistent', position: { x: 999, y: 999 } },
      { id: 'node-1', position: { x: 50, y: 50 } },
    ]);

    const nodes = adapter.getNodes();
    expect(nodes.length).toBe(1); // Only the original node
    expect(nodes[0].position).toEqual({ x: 50, y: 50 }); // Patch applied
  });

  it('position-only patch preserves other node data', async () => {
    const adapter = await getAdapter();
    const node1 = createTestNode({
      id: 'node-1',
      x: 0,
      y: 0,
      type: 'Service',
      semanticId: 'my-service',
      values: { name: 'Test Service' },
    });

    adapter.setNodes([node1]);

    adapter.patchNodes([{ id: 'node-1', position: { x: 100, y: 100 } }]);

    const nodes = adapter.getNodes();
    const updated = nodes.find(n => n.id === 'node-1');
    expect(updated!.position).toEqual({ x: 100, y: 100 });
    expect(updated!.type).toBe('construct');
    expect(updated!.data).toEqual({
      constructType: 'Service',
      semanticId: 'my-service',
      values: { name: 'Test Service' },
      connections: [],
      groupId: undefined,
    });
  });

  it('sequential patches - final state reflects last patch', async () => {
    const adapter = await getAdapter();
    const node1 = createTestNode({ id: 'node-1', x: 0, y: 0 });

    adapter.setNodes([node1]);

    adapter.patchNodes([{ id: 'node-1', position: { x: 50, y: 50 } }]);
    adapter.patchNodes([{ id: 'node-1', position: { x: 100, y: 100 } }]);

    const nodes = adapter.getNodes();
    const updated = nodes.find(n => n.id === 'node-1');
    expect(updated!.position).toEqual({ x: 100, y: 100 });
  });
});

describe('patchEdgeData', () => {
  it('sets waypoints in edge data', async () => {
    const adapter = await getAdapter();
    const edge1 = createTestEdge({ id: 'edge-1', source: 'a', target: 'b' });

    adapter.setEdges([edge1]);

    const waypoints = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    adapter.patchEdgeData([{ id: 'edge-1', data: { waypoints } }]);

    const edges = adapter.getEdges();
    const updated = edges.find(e => e.id === 'edge-1');
    expect(updated).toBeDefined();
    // patchEdgeData sets keys directly on the edge, not inside a nested data object
    expect((updated as any).waypoints).toEqual(waypoints);
  });

  it('clears waypoints when set to null', async () => {
    const adapter = await getAdapter();
    const edge1 = createTestEdge({ id: 'edge-1', source: 'a', target: 'b' });

    adapter.setEdges([edge1]);

    // First set waypoints
    adapter.patchEdgeData([{
      id: 'edge-1',
      data: { waypoints: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
    }]);

    // Then clear them
    adapter.patchEdgeData([{ id: 'edge-1', data: { waypoints: null } }]);

    const edges = adapter.getEdges();
    const updated = edges.find(e => e.id === 'edge-1');
    expect(updated).toBeDefined();
    // patchEdgeData sets keys directly on the edge, waypoints should be deleted
    expect((updated as any).waypoints).toBeUndefined();
  });

  it('patches multiple edges in one call', async () => {
    const adapter = await getAdapter();
    const edge1 = createTestEdge({ id: 'edge-1', source: 'a', target: 'b' });
    const edge2 = createTestEdge({ id: 'edge-2', source: 'b', target: 'c' });
    const edge3 = createTestEdge({ id: 'edge-3', source: 'c', target: 'd' });

    adapter.setEdges([edge1, edge2, edge3]);

    adapter.patchEdgeData([
      { id: 'edge-1', data: { label: 'Edge 1' } },
      { id: 'edge-2', data: { label: 'Edge 2' } },
      { id: 'edge-3', data: { label: 'Edge 3' } },
    ]);

    const edges = adapter.getEdges();
    expect((edges.find(e => e.id === 'edge-1') as any).label).toBe('Edge 1');
    expect((edges.find(e => e.id === 'edge-2') as any).label).toBe('Edge 2');
    expect((edges.find(e => e.id === 'edge-3') as any).label).toBe('Edge 3');
  });

  it('patches nonexistent edge without error, other patches still apply', async () => {
    const adapter = await getAdapter();
    const edge1 = createTestEdge({ id: 'edge-1', source: 'a', target: 'b' });

    adapter.setEdges([edge1]);

    adapter.patchEdgeData([
      { id: 'nonexistent', data: { label: 'Ghost' } },
      { id: 'edge-1', data: { label: 'Real' } },
    ]);

    const edges = adapter.getEdges();
    expect(edges.length).toBe(1);
    expect((edges[0] as any).label).toBe('Real');
  });

  it('partial data update - multiple patches accumulate keys', async () => {
    const adapter = await getAdapter();
    const edge1 = createTestEdge({ id: 'edge-1', source: 'a', target: 'b' });

    adapter.setEdges([edge1]);

    adapter.patchEdgeData([{ id: 'edge-1', data: { foo: 'bar' } }]);
    adapter.patchEdgeData([{ id: 'edge-1', data: { baz: 'qux' } }]);

    const edges = adapter.getEdges();
    const updated = edges.find(e => e.id === 'edge-1') as any;
    expect(updated).toBeDefined();
    expect(updated.foo).toBe('bar');
    expect(updated.baz).toBe('qux');
  });

  it('deletes specific key while preserving others', async () => {
    const adapter = await getAdapter();
    const edge1 = createTestEdge({ id: 'edge-1', source: 'a', target: 'b' });

    adapter.setEdges([edge1]);

    // Set multiple data fields
    adapter.patchEdgeData([{
      id: 'edge-1',
      data: {
        waypoints: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        label: 'test',
      },
    }]);

    // Delete waypoints only
    adapter.patchEdgeData([{ id: 'edge-1', data: { waypoints: null } }]);

    const edges = adapter.getEdges();
    const updated = edges.find(e => e.id === 'edge-1') as any;
    expect(updated.waypoints).toBeUndefined();
    expect(updated.label).toBe('test');
  });
});
