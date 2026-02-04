/**
 * Y.Doc migrations for Carta documents.
 *
 * Detects flat Y.Doc format (pre-levels) and wraps data under a new default level.
 * Repairs orphaned connections that reference non-existent nodes.
 * Migrates deployables and schemaGroups to unified visualGroups.
 */

import * as Y from 'yjs';
import { generateLevelId, generateVisualGroupId } from './id-generators.js';
import { METAMAP_LEVEL_ID } from './constants.js';

/**
 * Migrate flat data structure to level-based structure.
 *
 * Detects if the Y.Doc has flat nodes (old format where node-shaped Y.Maps
 * are stored directly in the 'nodes' map) and wraps them under a new default level.
 */
export function migrateToLevels(ydoc: Y.Doc): void {
  const ymeta = ydoc.getMap('meta');
  const ylevels = ydoc.getMap<Y.Map<unknown>>('levels');
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

  if (!hasFlatNodes && ylevels.size > 0) return; // Already migrated or empty doc
  if (!hasFlatNodes && ylevels.size === 0 && ynodes.size === 0 && yedges.size === 0) return; // New doc, nothing to migrate

  // Create default level
  const levelId = generateLevelId();
  const levelData = new Y.Map<unknown>();
  levelData.set('id', levelId);
  levelData.set('name', 'Main');
  levelData.set('order', 0);
  ylevels.set(levelId, levelData);
  ymeta.set('activeLevel', levelId);

  if (hasFlatNodes) {
    // Move flat nodes into level-scoped map
    const levelNodesMap = new Y.Map<Y.Map<unknown>>();
    const flatNodeEntries: [string, Y.Map<unknown>][] = [];
    ynodes.forEach((value, key) => {
      flatNodeEntries.push([key, value as Y.Map<unknown>]);
    });
    ynodes.clear();
    for (const [key, value] of flatNodeEntries) {
      levelNodesMap.set(key, value);
    }
    ynodes.set(levelId, levelNodesMap as unknown as Y.Map<unknown>);

    // Move flat edges into level-scoped map
    const levelEdgesMap = new Y.Map<Y.Map<unknown>>();
    const flatEdgeEntries: [string, Y.Map<unknown>][] = [];
    yedges.forEach((value, key) => {
      flatEdgeEntries.push([key, value as Y.Map<unknown>]);
    });
    yedges.clear();
    for (const [key, value] of flatEdgeEntries) {
      levelEdgesMap.set(key, value);
    }
    yedges.set(levelId, levelEdgesMap as unknown as Y.Map<unknown>);

    // Move flat deployables into level-scoped map
    const levelDeployablesMap = new Y.Map<Y.Map<unknown>>();
    const flatDeployableEntries: [string, Y.Map<unknown>][] = [];
    ydeployables.forEach((value, key) => {
      flatDeployableEntries.push([key, value as Y.Map<unknown>]);
    });
    ydeployables.clear();
    for (const [key, value] of flatDeployableEntries) {
      levelDeployablesMap.set(key, value);
    }
    ydeployables.set(levelId, levelDeployablesMap as unknown as Y.Map<unknown>);
  }
}

/**
 * Repair orphaned connections in a Y.Doc.
 *
 * Removes connections from nodes that reference non-existent target nodes.
 * This can happen when nodes are deleted but their connection references aren't cleaned up.
 */
export function repairOrphanedConnections(ydoc: Y.Doc): void {
  const ylevels = ydoc.getMap<Y.Map<unknown>>('levels');

  if (ylevels.size === 0) return; // No levels, nothing to repair

  ylevels.forEach((ylevelData) => {
    const ylevel = ylevelData as Y.Map<unknown>;
    const ynodes = ylevel.get('nodes') as Y.Map<Y.Map<unknown>> | undefined;

    if (!ynodes) return;

    // Build set of valid semantic IDs in this level
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
 * Migrate deployables and schemaGroups to unified visualGroups.
 *
 * This migration:
 * 1. Converts deployables (per-level) to visualGroups in the same level
 * 2. Converts schemaGroups to visualGroups in the special "__metamap__" level
 * 3. Updates node.data.deployableId references to groupId
 * 4. Updates schema.groupId and portSchema.groupId to reference new visualGroup IDs
 *
 * Migration tracking uses 'migrationVersion' in ymeta (version 2 = visualGroups migrated).
 */
export function migrateToVisualGroups(ydoc: Y.Doc): void {
  const ymeta = ydoc.getMap('meta');
  const ylevels = ydoc.getMap<Y.Map<unknown>>('levels');
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const ydeployables = ydoc.getMap<Y.Map<unknown>>('deployables');
  const yschemaGroups = ydoc.getMap<Y.Map<unknown>>('schemaGroups');
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yportSchemas = ydoc.getMap<Y.Map<unknown>>('portSchemas');
  const yvisualGroups = ydoc.getMap<Y.Map<unknown>>('visualGroups');

  // Check migration version
  const migrationVersion = (ymeta.get('migrationVersion') as number) || 0;
  if (migrationVersion >= 2) return; // Already migrated

  // Track old ID to new ID mappings for references
  const deployableIdMap = new Map<string, string>(); // oldDeployableId -> newVisualGroupId
  const schemaGroupIdMap = new Map<string, string>(); // oldSchemaGroupId -> newVisualGroupId

  // 1. Migrate deployables per level
  ylevels.forEach((_, levelId) => {
    const levelDeployables = ydeployables.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
    if (!levelDeployables || levelDeployables.size === 0) return;

    // Create visual groups map for this level if it doesn't exist
    let levelVisualGroups = yvisualGroups.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
    if (!levelVisualGroups) {
      levelVisualGroups = new Y.Map<Y.Map<unknown>>();
      yvisualGroups.set(levelId, levelVisualGroups as unknown as Y.Map<unknown>);
    }

    levelDeployables.forEach((ydeployable, oldId) => {
      const newId = generateVisualGroupId();
      deployableIdMap.set(oldId, newId);

      // Convert deployable to visual group
      const name = (ydeployable as Y.Map<unknown>).get('name') as string || 'Untitled';
      const description = (ydeployable as Y.Map<unknown>).get('description') as string | undefined;
      const color = (ydeployable as Y.Map<unknown>).get('color') as string | undefined;

      const visualGroupMap = new Y.Map<unknown>();
      visualGroupMap.set('id', newId);
      visualGroupMap.set('name', name);
      if (description) visualGroupMap.set('description', description);
      if (color) visualGroupMap.set('color', color);
      visualGroupMap.set('collapsed', false);

      levelVisualGroups!.set(newId, visualGroupMap as unknown as Y.Map<unknown>);
    });
  });

  // 2. Migrate schemaGroups to __metamap__ level
  if (yschemaGroups.size > 0) {
    let metamapVisualGroups = yvisualGroups.get(METAMAP_LEVEL_ID) as Y.Map<Y.Map<unknown>> | undefined;
    if (!metamapVisualGroups) {
      metamapVisualGroups = new Y.Map<Y.Map<unknown>>();
      yvisualGroups.set(METAMAP_LEVEL_ID, metamapVisualGroups as unknown as Y.Map<unknown>);
    }

    // First pass: create all visual groups
    yschemaGroups.forEach((yschemaGroup, oldId) => {
      const newId = generateVisualGroupId();
      schemaGroupIdMap.set(oldId, newId);

      const name = (yschemaGroup as Y.Map<unknown>).get('name') as string || 'Untitled';
      const description = (yschemaGroup as Y.Map<unknown>).get('description') as string | undefined;
      const color = (yschemaGroup as Y.Map<unknown>).get('color') as string | undefined;
      // Note: parentId will be updated in second pass

      const visualGroupMap = new Y.Map<unknown>();
      visualGroupMap.set('id', newId);
      visualGroupMap.set('name', name);
      if (description) visualGroupMap.set('description', description);
      if (color) visualGroupMap.set('color', color);
      visualGroupMap.set('collapsed', false);

      metamapVisualGroups!.set(newId, visualGroupMap as unknown as Y.Map<unknown>);
    });

    // Second pass: update parentGroupId references
    yschemaGroups.forEach((yschemaGroup, oldId) => {
      const parentId = (yschemaGroup as Y.Map<unknown>).get('parentId') as string | undefined;
      if (parentId) {
        const newParentId = schemaGroupIdMap.get(parentId);
        const newId = schemaGroupIdMap.get(oldId);
        if (newParentId && newId) {
          const visualGroup = metamapVisualGroups!.get(newId) as Y.Map<unknown> | undefined;
          if (visualGroup) {
            visualGroup.set('parentGroupId', newParentId);
          }
        }
      }
    });
  }

  // 3. Update node.data.deployableId -> groupId
  ylevels.forEach((_, levelId) => {
    const levelNodes = ynodes.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
    if (!levelNodes) return;

    levelNodes.forEach((ynode) => {
      const data = (ynode as Y.Map<unknown>).get('data') as Record<string, unknown> | undefined;
      if (!data) return;

      const deployableId = data.deployableId as string | undefined;
      if (deployableId) {
        const newGroupId = deployableIdMap.get(deployableId);
        if (newGroupId) {
          // Create updated data with groupId instead of deployableId
          const updatedData = { ...data };
          delete updatedData.deployableId;
          updatedData.groupId = newGroupId;
          (ynode as Y.Map<unknown>).set('data', updatedData);
        }
      }
    });
  });

  // 4. Update schema.groupId references
  yschemas.forEach((yschema, schemaType) => {
    const groupId = (yschema as Y.Map<unknown>).get('groupId') as string | undefined;
    if (groupId) {
      const newGroupId = schemaGroupIdMap.get(groupId);
      if (newGroupId) {
        const schemaData = {} as Record<string, unknown>;
        (yschema as Y.Map<unknown>).forEach((value, key) => {
          schemaData[key] = value;
        });
        schemaData.groupId = newGroupId;
        // Recreate the schema Y.Map with updated groupId
        const newSchemaMap = new Y.Map<unknown>();
        Object.entries(schemaData).forEach(([key, value]) => {
          if (value !== undefined) {
            if (typeof value === 'object' && value !== null) {
              // Deep convert objects to Y.Map
              newSchemaMap.set(key, value);
            } else {
              newSchemaMap.set(key, value);
            }
          }
        });
        yschemas.set(schemaType, newSchemaMap as unknown as Y.Map<unknown>);
      }
    }
  });

  // 5. Update portSchema.groupId references
  yportSchemas.forEach((yportSchema, portId) => {
    const groupId = (yportSchema as Y.Map<unknown>).get('groupId') as string | undefined;
    if (groupId) {
      const newGroupId = schemaGroupIdMap.get(groupId);
      if (newGroupId) {
        const portSchemaData = {} as Record<string, unknown>;
        (yportSchema as Y.Map<unknown>).forEach((value, key) => {
          portSchemaData[key] = value;
        });
        portSchemaData.groupId = newGroupId;
        // Recreate the portSchema Y.Map with updated groupId
        const newPortSchemaMap = new Y.Map<unknown>();
        Object.entries(portSchemaData).forEach(([key, value]) => {
          if (value !== undefined) {
            newPortSchemaMap.set(key, value);
          }
        });
        yportSchemas.set(portId, newPortSchemaMap as unknown as Y.Map<unknown>);
      }
    }
  });

  // Set migration version
  ymeta.set('migrationVersion', 2);
}
