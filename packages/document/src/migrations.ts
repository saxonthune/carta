/**
 * Y.Doc migrations for Carta documents.
 *
 * Detects flat Y.Doc format (pre-pages) and wraps data under a new default page.
 * Repairs orphaned connections that reference non-existent nodes.
 */

import * as Y from 'yjs';
import { generatePageId } from './id-generators.js';

/**
 * Migrate flat data structure to page-based structure.
 *
 * Detects if the Y.Doc has flat nodes (old format where node-shaped Y.Maps
 * are stored directly in the 'nodes' map) and wraps them under a new default page.
 */
export function migrateToPages(ydoc: Y.Doc): void {
  const ymeta = ydoc.getMap('meta');
  const ypages = ydoc.getMap<Y.Map<unknown>>('pages');
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const yedges = ydoc.getMap<Y.Map<unknown>>('edges');
  const ydeployables = ydoc.getMap<Y.Map<unknown>>('deployables');

  // Check if we have flat nodes (old format) by looking for Y.Map values that have
  // node-like properties (position, data, type) directly in ynodes
  let hasFlatNodes = false;
  ynodes.forEach((value) => {
    // If the value has 'position' or 'data' or 'type', it's a flat node (old format)
    if (value instanceof Y.Map && (value.has('position') || value.has('data') || value.has('type'))) {
      hasFlatNodes = true;
    }
  });

  if (!hasFlatNodes && ypages.size > 0) return; // Already migrated or empty doc
  if (!hasFlatNodes && ypages.size === 0 && ynodes.size === 0 && yedges.size === 0) return; // New doc, nothing to migrate

  // Create default page
  const pageId = generatePageId();
  const pageData = new Y.Map<unknown>();
  pageData.set('id', pageId);
  pageData.set('name', 'Main');
  pageData.set('order', 0);
  ypages.set(pageId, pageData);
  ymeta.set('activePage', pageId);
  if (hasFlatNodes) {
    // Move flat nodes into page-scoped map
    const pageNodesMap = new Y.Map<Y.Map<unknown>>();
    const flatNodeEntries: [string, Y.Map<unknown>][] = [];
    ynodes.forEach((value, key) => {
      flatNodeEntries.push([key, value as Y.Map<unknown>]);
    });
    ynodes.clear();
    for (const [key, value] of flatNodeEntries) {
      pageNodesMap.set(key, value);
    }
    ynodes.set(pageId, pageNodesMap as unknown as Y.Map<unknown>);

    // Move flat edges into page-scoped map
    const pageEdgesMap = new Y.Map<Y.Map<unknown>>();
    const flatEdgeEntries: [string, Y.Map<unknown>][] = [];
    yedges.forEach((value, key) => {
      flatEdgeEntries.push([key, value as Y.Map<unknown>]);
    });
    yedges.clear();
    for (const [key, value] of flatEdgeEntries) {
      pageEdgesMap.set(key, value);
    }
    yedges.set(pageId, pageEdgesMap as unknown as Y.Map<unknown>);

    // Move flat deployables into page-scoped map
    const pageDeployablesMap = new Y.Map<Y.Map<unknown>>();
    const flatDeployableEntries: [string, Y.Map<unknown>][] = [];
    ydeployables.forEach((value, key) => {
      flatDeployableEntries.push([key, value as Y.Map<unknown>]);
    });
    ydeployables.clear();
    for (const [key, value] of flatDeployableEntries) {
      pageDeployablesMap.set(key, value);
    }
    ydeployables.set(pageId, pageDeployablesMap as unknown as Y.Map<unknown>);
  }
}

/**
 * Repair orphaned connections in a Y.Doc.
 *
 * Removes connections from nodes that reference non-existent target nodes.
 * This can happen when nodes are deleted but their connection references aren't cleaned up.
 */
export function repairOrphanedConnections(ydoc: Y.Doc): void {
  const ypages = ydoc.getMap<Y.Map<unknown>>('pages');

  if (ypages.size === 0) return; // No pages, nothing to repair

  ypages.forEach((ypageData) => {
    const ypage = ypageData as Y.Map<unknown>;
    const ynodes = ypage.get('nodes') as Y.Map<Y.Map<unknown>> | undefined;

    if (!ynodes) return;

    // Build set of valid semantic IDs in this page
    const validSemanticIds = new Set<string>();
    ynodes.forEach((ynodeData) => {
      const data = ynodeData.get('data') as Y.Map<unknown> | undefined;
      if (data) {
        const semanticId = data.get('semanticId') as string | undefined;
        if (semanticId) {
          validSemanticIds.add(semanticId);
        }
      }
    });

    // Repair connections in all nodes
    ynodes.forEach((ynodeData) => {
      const data = ynodeData.get('data') as Y.Map<unknown> | undefined;
      if (!data) return;

      const connections = data.get('connections') as Y.Array<Y.Map<unknown>> | undefined;
      if (!connections || connections.length === 0) return;

      // Find invalid connections (references to non-existent nodes)
      const invalidIndices: number[] = [];
      connections.forEach((conn, index) => {
        const targetSemanticId = conn.get('targetSemanticId') as string | undefined;
        if (targetSemanticId && !validSemanticIds.has(targetSemanticId)) {
          invalidIndices.push(index);
        }
      });

      // Remove invalid connections (iterate backwards to preserve indices)
      for (let i = invalidIndices.length - 1; i >= 0; i--) {
        connections.delete(invalidIndices[i], 1);
      }
    });
  });
}

/**
 * Migrate schema renderStyle key to nodeShape.
 *
 * Walks all custom schemas in the Y.Doc and renames the 'renderStyle' key to 'nodeShape'.
 */
export function migrateRenderStyleToNodeShape(ydoc: Y.Doc): void {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');

  if (yschemas.size === 0) return;

  yschemas.forEach((yschemaData) => {
    const yschema = yschemaData as Y.Map<unknown>;
    const renderStyle = yschema.get('renderStyle');
    if (renderStyle !== undefined) {
      yschema.set('nodeShape', renderStyle);
      yschema.delete('renderStyle');
    }
  });
}

