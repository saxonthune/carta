/**
 * File operations for extracting CartaFile from Y.Doc and hydrating Y.Doc from CartaFile.
 *
 * Used by desktop persistence to save/load human-readable JSON files.
 */

import * as Y from 'yjs';
import type { ConstructSchema, PortSchema, SchemaGroup } from '@carta/domain';
import { builtInConstructSchemas, builtInPortSchemas } from '@carta/domain';
import { yToPlain, deepPlainToY } from './yjs-helpers.js';
import { CARTA_FILE_VERSION } from './constants.js';
import type { CartaFile, CartaFileLevel } from './file-format.js';

/**
 * Extract a CartaFile from a Y.Doc for saving.
 */
export function extractCartaFile(doc: Y.Doc): CartaFile {
  const ymeta = doc.getMap('meta');
  const ylevels = doc.getMap<Y.Map<unknown>>('levels');
  const ynodes = doc.getMap<Y.Map<unknown>>('nodes');
  const yedges = doc.getMap<Y.Map<unknown>>('edges');
  const yschemas = doc.getMap<Y.Map<unknown>>('schemas');
  const yportSchemas = doc.getMap<Y.Map<unknown>>('portSchemas');
  const yschemaGroups = doc.getMap<Y.Map<unknown>>('schemaGroups');

  const title = (ymeta.get('title') as string) || 'Untitled Project';
  const description = ymeta.get('description') as string | undefined;

  // Extract levels with their data
  const levels: CartaFileLevel[] = [];
  ylevels.forEach((ylevel, levelId) => {
    const levelData = yToPlain(ylevel) as { id: string; name: string; description?: string; order: number };

    // Get nodes for this level
    const levelNodes = ynodes.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
    const nodes: unknown[] = [];
    if (levelNodes) {
      levelNodes.forEach((ynode, nodeId) => {
        const nodeData = yToPlain(ynode) as Record<string, unknown>;
        nodes.push({ id: nodeId, ...nodeData });
      });
    }

    // Get edges for this level
    const levelEdges = yedges.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
    const edges: unknown[] = [];
    if (levelEdges) {
      levelEdges.forEach((yedge, edgeId) => {
        const edgeData = yToPlain(yedge) as Record<string, unknown>;
        edges.push({ id: edgeId, ...edgeData });
      });
    }

    levels.push({
      id: levelData.id,
      name: levelData.name,
      description: levelData.description,
      order: levelData.order,
      nodes,
      edges,
    });
  });

  // Sort levels by order
  levels.sort((a, b) => a.order - b.order);

  // Extract custom schemas (filter out built-ins)
  const builtInTypes = new Set(builtInConstructSchemas.map(s => s.type));
  const customSchemas: ConstructSchema[] = [];
  yschemas.forEach((yschema) => {
    const schema = yToPlain(yschema) as ConstructSchema;
    if (!builtInTypes.has(schema.type)) {
      customSchemas.push(schema);
    }
  });

  // Extract custom port schemas (filter out built-ins)
  const builtInPortIds = new Set(builtInPortSchemas.map(p => p.id));
  const portSchemas: PortSchema[] = [];
  yportSchemas.forEach((yps) => {
    const ps = yToPlain(yps) as PortSchema;
    if (!builtInPortIds.has(ps.id)) {
      portSchemas.push(ps);
    }
  });

  // Extract schema groups
  const schemaGroups: SchemaGroup[] = [];
  yschemaGroups.forEach((ysg) => {
    schemaGroups.push(yToPlain(ysg) as SchemaGroup);
  });

  return {
    version: CARTA_FILE_VERSION,
    title,
    description,
    levels,
    customSchemas,
    portSchemas,
    schemaGroups,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Hydrate a Y.Doc from a CartaFile.
 *
 * Clears existing data and populates from the CartaFile.
 */
export function hydrateYDocFromCartaFile(doc: Y.Doc, data: CartaFile): void {
  const ymeta = doc.getMap('meta');
  const ylevels = doc.getMap<Y.Map<unknown>>('levels');
  const ynodes = doc.getMap<Y.Map<unknown>>('nodes');
  const yedges = doc.getMap<Y.Map<unknown>>('edges');
  const yschemas = doc.getMap<Y.Map<unknown>>('schemas');
  const yportSchemas = doc.getMap<Y.Map<unknown>>('portSchemas');
  const yschemaGroups = doc.getMap<Y.Map<unknown>>('schemaGroups');

  doc.transact(() => {
    // Clear existing data
    ymeta.clear();
    ylevels.clear();
    ynodes.clear();
    yedges.clear();
    yschemas.clear();
    yportSchemas.clear();
    yschemaGroups.clear();

    // Set metadata
    ymeta.set('title', data.title);
    if (data.description) {
      ymeta.set('description', data.description);
    }
    ymeta.set('version', data.version);

    // Hydrate levels
    let firstLevelId: string | null = null;

    for (const level of data.levels) {
      if (!firstLevelId) firstLevelId = level.id;

      // Create level metadata
      const levelMap = new Y.Map<unknown>();
      levelMap.set('id', level.id);
      levelMap.set('name', level.name);
      if (level.description) levelMap.set('description', level.description);
      levelMap.set('order', level.order);
      ylevels.set(level.id, levelMap);

      // Create nodes map for this level
      const levelNodesMap = new Y.Map<Y.Map<unknown>>();
      for (const node of level.nodes) {
        const nodeObj = node as Record<string, unknown>;
        const nodeId = nodeObj.id as string;
        const ynode = deepPlainToY({
          type: nodeObj.type,
          position: nodeObj.position,
          data: nodeObj.data,
          ...(nodeObj.width ? { width: nodeObj.width } : {}),
          ...(nodeObj.height ? { height: nodeObj.height } : {}),
          ...(nodeObj.style ? { style: nodeObj.style } : {}),
          ...(nodeObj.parentId ? { parentId: nodeObj.parentId } : {}),
        }) as Y.Map<unknown>;
        levelNodesMap.set(nodeId, ynode);
      }
      ynodes.set(level.id, levelNodesMap as unknown as Y.Map<unknown>);

      // Create edges map for this level
      const levelEdgesMap = new Y.Map<Y.Map<unknown>>();
      for (const edge of level.edges) {
        const edgeObj = edge as Record<string, unknown>;
        const edgeId = edgeObj.id as string;
        const yedge = deepPlainToY({
          source: edgeObj.source,
          target: edgeObj.target,
          sourceHandle: edgeObj.sourceHandle,
          targetHandle: edgeObj.targetHandle,
        }) as Y.Map<unknown>;
        levelEdgesMap.set(edgeId, yedge);
      }
      yedges.set(level.id, levelEdgesMap as unknown as Y.Map<unknown>);
    }

    // Set active level to first level
    if (firstLevelId) {
      ymeta.set('activeLevel', firstLevelId);
    }

    // Set custom schemas
    for (const schema of data.customSchemas) {
      const ys = deepPlainToY(schema) as Y.Map<unknown>;
      yschemas.set(schema.type, ys);
    }

    // Set port schemas
    for (const ps of data.portSchemas) {
      const yps = deepPlainToY(ps) as Y.Map<unknown>;
      yportSchemas.set(ps.id, yps);
    }

    // Set schema groups
    for (const sg of data.schemaGroups) {
      const ysg = deepPlainToY(sg) as Y.Map<unknown>;
      yschemaGroups.set(sg.id, ysg);
    }
  });
}
