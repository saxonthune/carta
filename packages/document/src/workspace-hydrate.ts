/**
 * Workspace Y.Doc hydration: load CanvasFile JSON into a Y.Doc room and extract it back.
 *
 * Uses a single-page shim so existing @carta/document operations (listConstructs, etc.)
 * work unchanged. This is intentionally temporary — workspace-08 will refactor to flat
 * Y.Doc structure when DocumentAdapter is rewritten.
 */

import * as Y from 'yjs';
import { deepPlainToY, yToPlain } from './yjs-helpers.js';
import type { CanvasFile } from './workspace-format.js';

/**
 * Well-known page ID for workspace canvas Y.Docs.
 * Canvas Y.Docs use a single-page shim so existing doc-operations work unchanged.
 * Internal constant — consumers that need it import from this module.
 */
export const WORKSPACE_CANVAS_PAGE_ID = 'canvas';

/**
 * Hydrate a Y.Doc from a CanvasFile.
 *
 * Clears all existing Y.Doc state and populates from the CanvasFile using a
 * single synthetic page keyed by WORKSPACE_CANVAS_PAGE_ID.
 */
export function hydrateYDocFromCanvasFile(doc: Y.Doc, canvas: CanvasFile): void {
  const ymeta = doc.getMap('meta');
  const ypages = doc.getMap<Y.Map<unknown>>('pages');
  const ynodes = doc.getMap<Y.Map<unknown>>('nodes');
  const yedges = doc.getMap<Y.Map<unknown>>('edges');

  doc.transact(() => {
    // Clear existing state
    ymeta.clear();
    ypages.clear();
    ynodes.clear();
    yedges.clear();

    // Set metadata
    ymeta.set('formatVersion', 'workspace-canvas-1');

    // Create single synthetic page entry
    const pageMap = new Y.Map<unknown>();
    pageMap.set('id', WORKSPACE_CANVAS_PAGE_ID);
    pageMap.set('name', 'Canvas');
    pageMap.set('order', 0);
    ypages.set(WORKSPACE_CANVAS_PAGE_ID, pageMap);

    // Set active page
    ymeta.set('activePage', WORKSPACE_CANVAS_PAGE_ID);

    // Hydrate nodes
    const pageNodesMap = new Y.Map<Y.Map<unknown>>();
    for (const node of canvas.nodes) {
      const nodeObj = node as Record<string, unknown>;
      const nodeId = nodeObj.id as string;
      const ynode = deepPlainToY({
        type: nodeObj.type,
        position: nodeObj.position,
        data: nodeObj.data,
        ...(nodeObj.width !== undefined ? { width: nodeObj.width } : {}),
        ...(nodeObj.height !== undefined ? { height: nodeObj.height } : {}),
        ...(nodeObj.style !== undefined ? { style: nodeObj.style } : {}),
        ...(nodeObj.parentId !== undefined ? { parentId: nodeObj.parentId } : {}),
      }) as Y.Map<unknown>;
      pageNodesMap.set(nodeId, ynode);
    }
    ynodes.set(WORKSPACE_CANVAS_PAGE_ID, pageNodesMap as unknown as Y.Map<unknown>);

    // Hydrate edges
    const pageEdgesMap = new Y.Map<Y.Map<unknown>>();
    for (const edge of canvas.edges) {
      const edgeObj = edge as Record<string, unknown>;
      const edgeId = edgeObj.id as string;
      const yedge = deepPlainToY({
        source: edgeObj.source,
        target: edgeObj.target,
        sourceHandle: edgeObj.sourceHandle,
        targetHandle: edgeObj.targetHandle,
      }) as Y.Map<unknown>;
      pageEdgesMap.set(edgeId, yedge);
    }
    yedges.set(WORKSPACE_CANVAS_PAGE_ID, pageEdgesMap as unknown as Y.Map<unknown>);
  });
}

/**
 * Extract a CanvasFile from a Y.Doc hydrated by hydrateYDocFromCanvasFile.
 */
export function extractCanvasFileFromYDoc(doc: Y.Doc): CanvasFile {
  const ynodes = doc.getMap<Y.Map<unknown>>('nodes');
  const yedges = doc.getMap<Y.Map<unknown>>('edges');

  // Extract nodes for the synthetic canvas page
  const pageNodes = ynodes.get(WORKSPACE_CANVAS_PAGE_ID) as Y.Map<Y.Map<unknown>> | undefined;
  const nodes: unknown[] = [];
  if (pageNodes) {
    pageNodes.forEach((ynode, nodeId) => {
      const nodeData = yToPlain(ynode) as Record<string, unknown>;
      nodes.push({ id: nodeId, ...nodeData });
    });
  }

  // Extract edges for the synthetic canvas page
  const pageEdges = yedges.get(WORKSPACE_CANVAS_PAGE_ID) as Y.Map<Y.Map<unknown>> | undefined;
  const edges: unknown[] = [];
  if (pageEdges) {
    pageEdges.forEach((yedge, edgeId) => {
      const edgeData = yToPlain(yedge) as Record<string, unknown>;
      edges.push({ id: edgeId, ...edgeData });
    });
  }

  return { formatVersion: 1, nodes, edges };
}
