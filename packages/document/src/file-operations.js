/**
 * File operations for extracting CartaFile from Y.Doc and hydrating Y.Doc from CartaFile.
 *
 * Used by desktop persistence to save/load human-readable JSON files.
 */
import * as Y from 'yjs';
import { builtInConstructSchemas, builtInPortSchemas } from '@carta/domain';
import { yToPlain, deepPlainToY } from './yjs-helpers.js';
import { CARTA_FILE_VERSION } from './constants.js';
/**
 * Extract a CartaFile from a Y.Doc for saving.
 */
export function extractCartaFile(doc) {
    const ymeta = doc.getMap('meta');
    const ylevels = doc.getMap('levels');
    const ynodes = doc.getMap('nodes');
    const yedges = doc.getMap('edges');
    const ydeployables = doc.getMap('deployables');
    const yschemas = doc.getMap('schemas');
    const yportSchemas = doc.getMap('portSchemas');
    const yschemaGroups = doc.getMap('schemaGroups');
    const title = ymeta.get('title') || 'Untitled Project';
    const description = ymeta.get('description');
    // Extract levels with their data
    const levels = [];
    ylevels.forEach((ylevel, levelId) => {
        const levelData = yToPlain(ylevel);
        // Get nodes for this level
        const levelNodes = ynodes.get(levelId);
        const nodes = [];
        if (levelNodes) {
            levelNodes.forEach((ynode, nodeId) => {
                const nodeData = yToPlain(ynode);
                nodes.push({ id: nodeId, ...nodeData });
            });
        }
        // Get edges for this level
        const levelEdges = yedges.get(levelId);
        const edges = [];
        if (levelEdges) {
            levelEdges.forEach((yedge, edgeId) => {
                const edgeData = yToPlain(yedge);
                edges.push({ id: edgeId, ...edgeData });
            });
        }
        // Get deployables for this level
        const levelDeployables = ydeployables.get(levelId);
        const deployables = [];
        if (levelDeployables) {
            levelDeployables.forEach((ydeployable) => {
                deployables.push(yToPlain(ydeployable));
            });
        }
        levels.push({
            id: levelData.id,
            name: levelData.name,
            description: levelData.description,
            order: levelData.order,
            nodes,
            edges,
            deployables,
        });
    });
    // Sort levels by order
    levels.sort((a, b) => a.order - b.order);
    // Extract custom schemas (filter out built-ins)
    const builtInTypes = new Set(builtInConstructSchemas.map(s => s.type));
    const customSchemas = [];
    yschemas.forEach((yschema) => {
        const schema = yToPlain(yschema);
        if (!builtInTypes.has(schema.type)) {
            customSchemas.push(schema);
        }
    });
    // Extract custom port schemas (filter out built-ins)
    const builtInPortIds = new Set(builtInPortSchemas.map(p => p.id));
    const portSchemas = [];
    yportSchemas.forEach((yps) => {
        const ps = yToPlain(yps);
        if (!builtInPortIds.has(ps.id)) {
            portSchemas.push(ps);
        }
    });
    // Extract schema groups
    const schemaGroups = [];
    yschemaGroups.forEach((ysg) => {
        schemaGroups.push(yToPlain(ysg));
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
export function hydrateYDocFromCartaFile(doc, data) {
    const ymeta = doc.getMap('meta');
    const ylevels = doc.getMap('levels');
    const ynodes = doc.getMap('nodes');
    const yedges = doc.getMap('edges');
    const ydeployables = doc.getMap('deployables');
    const yschemas = doc.getMap('schemas');
    const yportSchemas = doc.getMap('portSchemas');
    const yschemaGroups = doc.getMap('schemaGroups');
    doc.transact(() => {
        // Clear existing data
        ymeta.clear();
        ylevels.clear();
        ynodes.clear();
        yedges.clear();
        ydeployables.clear();
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
        let firstLevelId = null;
        for (const level of data.levels) {
            if (!firstLevelId)
                firstLevelId = level.id;
            // Create level metadata
            const levelMap = new Y.Map();
            levelMap.set('id', level.id);
            levelMap.set('name', level.name);
            if (level.description)
                levelMap.set('description', level.description);
            levelMap.set('order', level.order);
            ylevels.set(level.id, levelMap);
            // Create nodes map for this level
            const levelNodesMap = new Y.Map();
            for (const node of level.nodes) {
                const nodeObj = node;
                const nodeId = nodeObj.id;
                const ynode = deepPlainToY({
                    type: nodeObj.type,
                    position: nodeObj.position,
                    data: nodeObj.data,
                    ...(nodeObj.width ? { width: nodeObj.width } : {}),
                    ...(nodeObj.height ? { height: nodeObj.height } : {}),
                    ...(nodeObj.style ? { style: nodeObj.style } : {}),
                    ...(nodeObj.parentId ? { parentId: nodeObj.parentId } : {}),
                });
                levelNodesMap.set(nodeId, ynode);
            }
            ynodes.set(level.id, levelNodesMap);
            // Create edges map for this level
            const levelEdgesMap = new Y.Map();
            for (const edge of level.edges) {
                const edgeObj = edge;
                const edgeId = edgeObj.id;
                const yedge = deepPlainToY({
                    source: edgeObj.source,
                    target: edgeObj.target,
                    sourceHandle: edgeObj.sourceHandle,
                    targetHandle: edgeObj.targetHandle,
                });
                levelEdgesMap.set(edgeId, yedge);
            }
            yedges.set(level.id, levelEdgesMap);
            // Create deployables map for this level
            const levelDeployablesMap = new Y.Map();
            for (const deployable of level.deployables) {
                const yd = deepPlainToY(deployable);
                levelDeployablesMap.set(deployable.id, yd);
            }
            ydeployables.set(level.id, levelDeployablesMap);
        }
        // Set active level to first level
        if (firstLevelId) {
            ymeta.set('activeLevel', firstLevelId);
        }
        // Set custom schemas
        for (const schema of data.customSchemas) {
            const ys = deepPlainToY(schema);
            yschemas.set(schema.type, ys);
        }
        // Set port schemas
        for (const ps of data.portSchemas) {
            const yps = deepPlainToY(ps);
            yportSchemas.set(ps.id, yps);
        }
        // Set schema groups
        for (const sg of data.schemaGroups) {
            const ysg = deepPlainToY(sg);
            yschemaGroups.set(sg.id, ysg);
        }
    });
}
