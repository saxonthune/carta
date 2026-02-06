/**
 * Y.Doc migrations for Carta documents.
 *
 * Detects flat Y.Doc format (pre-levels) and wraps data under a new default level.
 * Repairs orphaned connections that reference non-existent nodes.
 */
import * as Y from 'yjs';
import { generateLevelId } from './id-generators.js';
/**
 * Migrate flat data structure to level-based structure.
 *
 * Detects if the Y.Doc has flat nodes (old format where node-shaped Y.Maps
 * are stored directly in the 'nodes' map) and wraps them under a new default level.
 */
export function migrateToLevels(ydoc) {
    const ymeta = ydoc.getMap('meta');
    const ylevels = ydoc.getMap('levels');
    const ynodes = ydoc.getMap('nodes');
    const yedges = ydoc.getMap('edges');
    const ydeployables = ydoc.getMap('deployables');
    // Check if we have flat nodes (old format) by looking for Y.Map values that have
    // node-like properties (position, data, type) directly in ynodes
    let hasFlatNodes = false;
    ynodes.forEach((value) => {
        // If the value has 'position' or 'data' or 'type', it's a flat node (old format)
        if (value instanceof Y.Map && (value.has('position') || value.has('data') || value.has('type'))) {
            hasFlatNodes = true;
        }
    });
    if (!hasFlatNodes && ylevels.size > 0)
        return; // Already migrated or empty doc
    if (!hasFlatNodes && ylevels.size === 0 && ynodes.size === 0 && yedges.size === 0)
        return; // New doc, nothing to migrate
    // Create default level
    const levelId = generateLevelId();
    const levelData = new Y.Map();
    levelData.set('id', levelId);
    levelData.set('name', 'Main');
    levelData.set('order', 0);
    ylevels.set(levelId, levelData);
    ymeta.set('activeLevel', levelId);
    if (hasFlatNodes) {
        // Move flat nodes into level-scoped map
        const levelNodesMap = new Y.Map();
        const flatNodeEntries = [];
        ynodes.forEach((value, key) => {
            flatNodeEntries.push([key, value]);
        });
        ynodes.clear();
        for (const [key, value] of flatNodeEntries) {
            levelNodesMap.set(key, value);
        }
        ynodes.set(levelId, levelNodesMap);
        // Move flat edges into level-scoped map
        const levelEdgesMap = new Y.Map();
        const flatEdgeEntries = [];
        yedges.forEach((value, key) => {
            flatEdgeEntries.push([key, value]);
        });
        yedges.clear();
        for (const [key, value] of flatEdgeEntries) {
            levelEdgesMap.set(key, value);
        }
        yedges.set(levelId, levelEdgesMap);
        // Move flat deployables into level-scoped map
        const levelDeployablesMap = new Y.Map();
        const flatDeployableEntries = [];
        ydeployables.forEach((value, key) => {
            flatDeployableEntries.push([key, value]);
        });
        ydeployables.clear();
        for (const [key, value] of flatDeployableEntries) {
            levelDeployablesMap.set(key, value);
        }
        ydeployables.set(levelId, levelDeployablesMap);
    }
}
/**
 * Repair orphaned connections in a Y.Doc.
 *
 * Removes connections from nodes that reference non-existent target nodes.
 * This can happen when nodes are deleted but their connection references aren't cleaned up.
 */
export function repairOrphanedConnections(ydoc) {
    const ylevels = ydoc.getMap('levels');
    if (ylevels.size === 0)
        return; // No levels, nothing to repair
    ylevels.forEach((ylevelData) => {
        const ylevel = ylevelData;
        const ynodes = ylevel.get('nodes');
        if (!ynodes)
            return;
        // Build set of valid semantic IDs in this level
        const validSemanticIds = new Set();
        ynodes.forEach((ynodeData) => {
            const data = ynodeData.get('data');
            if (data) {
                const semanticId = data.get('semanticId');
                if (semanticId) {
                    validSemanticIds.add(semanticId);
                }
            }
        });
        // Repair connections in all nodes
        ynodes.forEach((ynodeData) => {
            const data = ynodeData.get('data');
            if (!data)
                return;
            const connections = data.get('connections');
            if (!connections || connections.length === 0)
                return;
            // Find invalid connections (references to non-existent nodes)
            const invalidIndices = [];
            connections.forEach((conn, index) => {
                const targetSemanticId = conn.get('targetSemanticId');
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
