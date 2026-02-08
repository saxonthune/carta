import { describe, it, expect } from 'vitest';
import {
  computePresentation,
  computeCollapsedSet,
  computeHiddenDescendants,
  computeEdgeRemap,
  computeEdgeAggregation,
  traceGraph,
} from '../../src/presentation';
import type { ProcessableNode, ProcessableEdge } from '../../src/presentation';

// --- helpers ---

function node(id: string, overrides: Partial<ProcessableNode> = {}): ProcessableNode {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {},
    ...overrides,
  };
}

function organizer(id: string, collapsed: boolean, overrides: Partial<ProcessableNode> = {}): ProcessableNode {
  return node(id, {
    type: 'organizer',
    data: { collapsed, name: id, color: '#000' },
    ...overrides,
  });
}

function child(id: string, parentId: string, overrides: Partial<ProcessableNode> = {}): ProcessableNode {
  return node(id, { parentId, ...overrides });
}

function edge(id: string, source: string, target: string, extra: Record<string, unknown> = {}): ProcessableEdge {
  return { id, source, target, ...extra };
}

// --- computeCollapsedSet ---

describe('computeCollapsedSet', () => {
  it('returns empty set when no organizers', () => {
    const nodes = [node('a'), node('b')];
    expect(computeCollapsedSet(nodes).size).toBe(0);
  });

  it('returns collapsed organizer IDs', () => {
    const nodes = [
      organizer('org1', true),
      organizer('org2', false),
      organizer('org3', true),
    ];
    const result = computeCollapsedSet(nodes);
    expect(result).toEqual(new Set(['org1', 'org3']));
  });

  it('ignores non-organizer nodes with collapsed data', () => {
    const nodes = [
      node('n1', { type: 'construct', data: { collapsed: true } }),
    ];
    expect(computeCollapsedSet(nodes).size).toBe(0);
  });

  it('ignores expanded organizers', () => {
    const nodes = [organizer('org1', false)];
    expect(computeCollapsedSet(nodes).size).toBe(0);
  });
});

// --- computeHiddenDescendants ---

describe('computeHiddenDescendants', () => {
  it('returns empty set when nothing collapsed', () => {
    const nodes = [organizer('org1', false), child('a', 'org1')];
    const result = computeHiddenDescendants(nodes, new Set());
    expect(result.size).toBe(0);
  });

  it('hides direct children of collapsed organizer', () => {
    const nodes = [
      organizer('org1', true),
      child('a', 'org1'),
      child('b', 'org1'),
    ];
    const result = computeHiddenDescendants(nodes, new Set(['org1']));
    expect(result).toEqual(new Set(['a', 'b']));
  });

  it('hides grandchildren recursively', () => {
    const nodes = [
      organizer('org1', true),
      organizer('inner', false, { parentId: 'org1' }),
      child('a', 'inner'),
    ];
    const result = computeHiddenDescendants(nodes, new Set(['org1']));
    expect(result).toEqual(new Set(['inner', 'a']));
  });

  it('stops at depth 20 safeguard', () => {
    // Build chain of 25 levels
    const nodes: ProcessableNode[] = [organizer('org0', true)];
    for (let i = 1; i <= 25; i++) {
      nodes.push(child(`n${i}`, i === 1 ? 'org0' : `n${i - 1}`));
    }
    const result = computeHiddenDescendants(nodes, new Set(['org0']));
    // Should have nodes up to depth 20 (n1 through n21) but not beyond
    expect(result.has('n1')).toBe(true);
    expect(result.has('n21')).toBe(true);
    expect(result.has('n22')).toBe(false);
  });

  it('handles multiple independent collapsed organizers', () => {
    const nodes = [
      organizer('org1', true),
      child('a', 'org1'),
      organizer('org2', true),
      child('b', 'org2'),
      node('free'),
    ];
    const result = computeHiddenDescendants(nodes, new Set(['org1', 'org2']));
    expect(result).toEqual(new Set(['a', 'b']));
  });

  it('does NOT hide siblings of collapsed organizer', () => {
    const nodes = [
      organizer('org1', true),
      child('a', 'org1'),
      node('sibling'),
    ];
    const result = computeHiddenDescendants(nodes, new Set(['org1']));
    expect(result.has('sibling')).toBe(false);
  });
});

// --- computeEdgeRemap ---

describe('computeEdgeRemap', () => {
  it('returns empty map when nothing hidden', () => {
    const nodes = [node('a'), node('b')];
    const result = computeEdgeRemap(nodes, new Set(), new Set());
    expect(result.size).toBe(0);
  });

  it('maps hidden node to its collapsed ancestor', () => {
    const nodes = [
      organizer('org1', true),
      child('a', 'org1'),
    ];
    const result = computeEdgeRemap(nodes, new Set(['a']), new Set(['org1']));
    expect(result.get('a')).toBe('org1');
  });

  it('maps deeply nested hidden node to topmost collapsed ancestor', () => {
    const nodes = [
      organizer('outer', true),
      organizer('inner', true, { parentId: 'outer' }),
      child('deep', 'inner'),
    ];
    const hiddenSet = new Set(['inner', 'deep']);
    const collapsedSet = new Set(['outer', 'inner']);
    const result = computeEdgeRemap(nodes, hiddenSet, collapsedSet);
    // deep is inside inner which is inside outer; outer is the topmost collapsed
    expect(result.get('deep')).toBe('outer');
    expect(result.get('inner')).toBe('outer');
  });

  it('handles nested collapsed organizers (inner inside outer)', () => {
    // Only outer collapsed, inner expanded
    const nodes = [
      organizer('outer', true),
      organizer('inner', false, { parentId: 'outer' }),
      child('a', 'inner'),
    ];
    const hiddenSet = new Set(['inner', 'a']);
    const collapsedSet = new Set(['outer']);
    const result = computeEdgeRemap(nodes, hiddenSet, collapsedSet);
    expect(result.get('inner')).toBe('outer');
    expect(result.get('a')).toBe('outer');
  });
});

// --- computePresentation (full pipeline) ---

describe('computePresentation', () => {
  it('flat graph passes through unchanged', () => {
    const nodes = [node('a'), node('b')];
    const edges = [edge('e1', 'a', 'b')];
    const result = computePresentation({ nodes, edges });
    expect(result.processedNodes).toHaveLength(2);
    expect(result.processedNodes.every(n => !n.hidden)).toBe(true);
    expect(result.processedEdges).toEqual(edges);
    expect(result.edgeRemap.size).toBe(0);
  });

  it('collapsed organizer hides all descendants', () => {
    const nodes = [
      organizer('org1', true),
      child('a', 'org1'),
      child('b', 'org1'),
      node('free'),
    ];
    const result = computePresentation({ nodes, edges: [] });
    const hidden = result.processedNodes.filter(n => n.hidden);
    expect(hidden.map(n => n.id).sort()).toEqual(['a', 'b']);
    expect(result.processedNodes.find(n => n.id === 'free')!.hidden).toBeFalsy();
  });

  it('hidden nodes edges get remapped to collapsed ancestor', () => {
    const nodes = [
      organizer('org1', true),
      child('a', 'org1'),
      node('ext'),
    ];
    const edges = [edge('e1', 'a', 'ext')];
    const result = computePresentation({ nodes, edges });
    expect(result.edgeRemap.get('a')).toBe('org1');
  });

  it('multiple collapsed organizers work independently', () => {
    const nodes = [
      organizer('org1', true),
      child('a', 'org1'),
      organizer('org2', true),
      child('b', 'org2'),
    ];
    const result = computePresentation({ nodes, edges: [] });
    expect(result.edgeRemap.get('a')).toBe('org1');
    expect(result.edgeRemap.get('b')).toBe('org2');
  });
});

// --- computeEdgeAggregation ---

describe('computeEdgeAggregation', () => {
  it('edges within same organizer stay individual', () => {
    const nodes = [
      organizer('org1', false),
      child('a', 'org1'),
      child('b', 'org1'),
    ];
    const edges = [edge('e1', 'a', 'b')];
    const result = computeEdgeAggregation(edges, nodes, new Map(), new Set());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });

  it('cross-organizer edges aggregate with bundleCount', () => {
    const nodes = [
      organizer('org1', false),
      child('a1', 'org1'),
      child('a2', 'org1'),
      organizer('org2', false),
      child('b1', 'org2'),
    ];
    const edges = [
      edge('e1', 'a1', 'b1'),
      edge('e2', 'a2', 'b1'),
    ];
    const result = computeEdgeAggregation(edges, nodes, new Map(), new Set());
    // Both edges cross org1→org2, should aggregate
    const aggregated = result.filter(e => (e as any).data?.bundleCount);
    expect(aggregated).toHaveLength(1);
    expect((aggregated[0] as any).data.bundleCount).toBe(2);
  });

  it('selected nodes unwrap their edges', () => {
    const nodes = [
      organizer('org1', false),
      child('a', 'org1'),
      organizer('org2', false),
      child('b', 'org2'),
    ];
    const edges = [edge('e1', 'a', 'b')];
    // Select 'a' — it keeps its own ID as effective endpoint
    const result = computeEdgeAggregation(edges, nodes, new Map(), new Set(['a', 'b']));
    // With both selected, neither is remapped → individual edge
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });

  it('remapped (hidden) edges route to collapsed ancestor', () => {
    const nodes = [
      organizer('org1', true),
      child('a', 'org1'),
      node('ext'),
    ];
    const edges = [edge('e1', 'a', 'ext')];
    const remap = new Map([['a', 'org1']]);
    const result = computeEdgeAggregation(edges, nodes, remap, new Set());
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('org1');
    expect(result[0].target).toBe('ext');
  });

  it('self-loop edges (both ends remap to same node) are dropped', () => {
    const nodes = [
      organizer('org1', true),
      child('a', 'org1'),
      child('b', 'org1'),
    ];
    const edges = [edge('e1', 'a', 'b')];
    const remap = new Map([['a', 'org1'], ['b', 'org1']]);
    const result = computeEdgeAggregation(edges, nodes, remap, new Set());
    expect(result).toHaveLength(0);
  });

  it('free nodes with no organizer keep individual edges', () => {
    const nodes = [node('a'), node('b')];
    const edges = [edge('e1', 'a', 'b')];
    const result = computeEdgeAggregation(edges, nodes, new Map(), new Set());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });
});

// --- traceGraph ---

describe('traceGraph', () => {
  it('linear chain produces correct distances', () => {
    const edges = [
      edge('e1', 'a', 'b'),
      edge('e2', 'b', 'c'),
      edge('e3', 'c', 'd'),
    ];
    const result = traceGraph('a', edges);
    expect(result.nodeDistances.get('a')).toBe(0);
    expect(result.nodeDistances.get('b')).toBe(1);
    expect(result.nodeDistances.get('c')).toBe(2);
    expect(result.nodeDistances.get('d')).toBe(3);
    expect(result.edgeDistances.get('e1')).toBe(1);
    expect(result.edgeDistances.get('e2')).toBe(2);
    expect(result.edgeDistances.get('e3')).toBe(3);
    expect(result.maxDepth).toBe(3);
  });

  it('branching produces correct distances', () => {
    const edges = [
      edge('e1', 'root', 'left'),
      edge('e2', 'root', 'right'),
      edge('e3', 'left', 'leaf'),
    ];
    const result = traceGraph('root', edges);
    expect(result.nodeDistances.get('root')).toBe(0);
    expect(result.nodeDistances.get('left')).toBe(1);
    expect(result.nodeDistances.get('right')).toBe(1);
    expect(result.nodeDistances.get('leaf')).toBe(2);
    expect(result.maxDepth).toBe(2);
  });

  it('cycles do not infinite-loop', () => {
    const edges = [
      edge('e1', 'a', 'b'),
      edge('e2', 'b', 'c'),
      edge('e3', 'c', 'a'), // back edge
    ];
    const result = traceGraph('a', edges);
    expect(result.nodeDistances.size).toBe(3);
    expect(result.maxDepth).toBe(2);
  });

  it('disconnected nodes not in result', () => {
    const edges = [
      edge('e1', 'a', 'b'),
    ];
    const result = traceGraph('a', edges);
    expect(result.nodeDistances.has('a')).toBe(true);
    expect(result.nodeDistances.has('b')).toBe(true);
    expect(result.nodeDistances.has('c')).toBe(false);
    expect(result.maxDepth).toBe(1);
  });

  it('empty edges returns only start node', () => {
    const result = traceGraph('a', []);
    expect(result.nodeDistances.get('a')).toBe(0);
    expect(result.maxDepth).toBe(0);
  });
});
