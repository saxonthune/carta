import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import {
  hydrateYDocFromCanvasFile,
  extractCanvasFileFromYDoc,
  WORKSPACE_CANVAS_PAGE_ID,
} from '../src/workspace-hydrate';
import { listConstructs } from '../src/doc-operations';
import type { CanvasFile } from '../src/workspace-format';

// ============================================
// Fixtures
// ============================================

function makeConstructNode(id: string, x = 0, y = 0) {
  return {
    id,
    type: 'construct',
    position: { x, y },
    data: { semanticId: id, schemaType: 'Service' },
  };
}

function makeOrganizerNode(id: string, parentId?: string) {
  return {
    id,
    type: 'organizer',
    position: { x: 0, y: 0 },
    data: { isOrganizer: true, label: 'Group' },
    ...(parentId !== undefined ? { parentId } : {}),
  };
}

function makeEdge(id: string, source: string, target: string, sourceHandle?: string, targetHandle?: string) {
  return {
    id,
    source,
    target,
    ...(sourceHandle !== undefined ? { sourceHandle } : {}),
    ...(targetHandle !== undefined ? { targetHandle } : {}),
  };
}

// ============================================
// Tests
// ============================================

describe('WORKSPACE_CANVAS_PAGE_ID', () => {
  it('is exported and equals "canvas"', () => {
    expect(WORKSPACE_CANVAS_PAGE_ID).toBe('canvas');
  });
});

describe('hydrateYDocFromCanvasFile / extractCanvasFileFromYDoc', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
  });

  it('round-trip: hydrate then extract returns equivalent CanvasFile', () => {
    const canvas: CanvasFile = {
      formatVersion: 1,
      nodes: [
        makeConstructNode('node-a', 100, 200),
        makeConstructNode('node-b', 300, 400),
        makeOrganizerNode('org-1'),
      ],
      edges: [
        makeEdge('edge-1', 'node-a', 'node-b', 'port-out', 'port-in'),
        makeEdge('edge-2', 'node-b', 'org-1'),
      ],
    };

    hydrateYDocFromCanvasFile(doc, canvas);
    const extracted = extractCanvasFileFromYDoc(doc);

    expect(extracted.formatVersion).toBe(1);
    expect(extracted.nodes).toEqual(expect.arrayContaining(canvas.nodes));
    expect(extracted.nodes).toHaveLength(canvas.nodes.length);
    expect(extracted.edges).toEqual(expect.arrayContaining(canvas.edges));
    expect(extracted.edges).toHaveLength(canvas.edges.length);
  });

  it('empty canvas round-trip produces identical structure', () => {
    const canvas: CanvasFile = { formatVersion: 1, nodes: [], edges: [] };

    hydrateYDocFromCanvasFile(doc, canvas);
    const extracted = extractCanvasFileFromYDoc(doc);

    expect(extracted).toEqual({ formatVersion: 1, nodes: [], edges: [] });
  });

  it('hydrated Y.Doc is compatible with listConstructs', () => {
    const canvas: CanvasFile = {
      formatVersion: 1,
      nodes: [
        makeConstructNode('svc-a', 10, 20),
        makeConstructNode('svc-b', 30, 40),
      ],
      edges: [],
    };

    hydrateYDocFromCanvasFile(doc, canvas);
    const constructs = listConstructs(doc, WORKSPACE_CANVAS_PAGE_ID);

    expect(constructs).toHaveLength(2);
    const ids = constructs.map(c => c.id);
    expect(ids).toContain('svc-a');
    expect(ids).toContain('svc-b');
  });

  it('all optional node fields are preserved through round-trip', () => {
    const nodeWithAllFields = {
      id: 'full-node',
      type: 'construct',
      position: { x: 5, y: 10 },
      data: { semanticId: 'Full', schemaType: 'Service' },
      width: 200,
      height: 100,
      style: { border: '1px solid red' },
      parentId: 'org-parent',
    };

    const canvas: CanvasFile = {
      formatVersion: 1,
      nodes: [nodeWithAllFields],
      edges: [],
    };

    hydrateYDocFromCanvasFile(doc, canvas);
    const extracted = extractCanvasFileFromYDoc(doc);

    expect(extracted.nodes).toHaveLength(1);
    const extractedNode = extracted.nodes[0] as Record<string, unknown>;
    expect(extractedNode.id).toBe('full-node');
    expect(extractedNode.width).toBe(200);
    expect(extractedNode.height).toBe(100);
    expect(extractedNode.style).toEqual({ border: '1px solid red' });
    expect(extractedNode.parentId).toBe('org-parent');
  });

  it('second hydrate replaces first — no merging', () => {
    const canvasA: CanvasFile = {
      formatVersion: 1,
      nodes: [makeConstructNode('only-in-a')],
      edges: [],
    };
    const canvasB: CanvasFile = {
      formatVersion: 1,
      nodes: [makeConstructNode('only-in-b')],
      edges: [makeEdge('edge-b', 'only-in-b', 'only-in-b')],
    };

    hydrateYDocFromCanvasFile(doc, canvasA);
    hydrateYDocFromCanvasFile(doc, canvasB);
    const extracted = extractCanvasFileFromYDoc(doc);

    const nodeIds = (extracted.nodes as Array<Record<string, unknown>>).map(n => n.id);
    expect(nodeIds).not.toContain('only-in-a');
    expect(nodeIds).toContain('only-in-b');
    expect(extracted.edges).toHaveLength(1);
  });

  it('edge sourceHandle and targetHandle are preserved through round-trip', () => {
    const canvas: CanvasFile = {
      formatVersion: 1,
      nodes: [makeConstructNode('n1'), makeConstructNode('n2')],
      edges: [makeEdge('e1', 'n1', 'n2', 'handle-out', 'handle-in')],
    };

    hydrateYDocFromCanvasFile(doc, canvas);
    const extracted = extractCanvasFileFromYDoc(doc);

    const edge = (extracted.edges as Array<Record<string, unknown>>).find(e => e.id === 'e1');
    expect(edge).toBeDefined();
    expect(edge!.sourceHandle).toBe('handle-out');
    expect(edge!.targetHandle).toBe('handle-in');
  });
});
