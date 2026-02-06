/**
 * Y.Doc mutation operations for Carta documents.
 *
 * Level-aware: construct/edge/deployable operations take a `levelId` parameter.
 * Schema operations are shared across levels.
 *
 * All operations use 'mcp' as the transaction origin,
 * allowing users to undo AI-made changes.
 */
import * as Y from 'yjs';
import { generateSemanticId, builtInConstructSchemas, } from '@carta/domain';
import { CompilerEngine } from '@carta/compiler';
import { yToPlain, deepPlainToY, safeGet } from './yjs-helpers.js';
import { generateNodeId, generateDeployableId, generateDeployableColor } from './id-generators.js';
import { MCP_ORIGIN, SERVER_FORMAT_VERSION } from './constants.js';
/**
 * Get or create a level-scoped Y.Map inside a container map.
 */
function getLevelMap(ydoc, mapName, levelId) {
    const container = ydoc.getMap(mapName);
    let levelMap = container.get(levelId);
    if (!levelMap) {
        levelMap = new Y.Map();
        container.set(levelId, levelMap);
    }
    return levelMap;
}
// ===== CONSTRUCT OPERATIONS =====
/**
 * List all constructs in a document level
 */
export function listConstructs(ydoc, levelId) {
    const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
    const nodes = [];
    levelNodes.forEach((ynode, id) => {
        const nodeObj = yToPlain(ynode);
        nodes.push({
            id,
            type: nodeObj.type || 'construct',
            position: nodeObj.position || { x: 0, y: 0 },
            data: nodeObj.data,
        });
    });
    return nodes;
}
/**
 * Get a construct by semantic ID within a level
 */
export function getConstruct(ydoc, levelId, semanticId) {
    const nodes = listConstructs(ydoc, levelId);
    return nodes.find((n) => n.data.semanticId === semanticId) || null;
}
/**
 * Create a new construct in a level
 */
export function createConstruct(ydoc, levelId, constructType, values = {}, position = { x: 100, y: 100 }) {
    const semanticId = generateSemanticId(constructType);
    const nodeId = generateNodeId();
    const nodeData = {
        constructType,
        semanticId,
        values,
        connections: [],
    };
    const node = {
        id: nodeId,
        type: 'construct',
        position,
        data: nodeData,
    };
    const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
    ydoc.transact(() => {
        const ynode = new Y.Map();
        ynode.set('type', node.type);
        ynode.set('position', deepPlainToY(position));
        ynode.set('data', deepPlainToY(nodeData));
        levelNodes.set(nodeId, ynode);
    }, MCP_ORIGIN);
    return node;
}
/**
 * Update an existing construct within a level
 */
export function updateConstruct(ydoc, levelId, semanticId, updates) {
    const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
    // Find the node by semantic ID
    let foundId = null;
    let foundYnode = null;
    levelNodes.forEach((ynode, id) => {
        const data = ynode.get('data');
        if (data && safeGet(data, 'semanticId') === semanticId) {
            foundId = id;
            foundYnode = ynode;
        }
    });
    if (!foundId || !foundYnode)
        return null;
    ydoc.transact(() => {
        const ydata = foundYnode.get('data');
        if (updates.values !== undefined) {
            // Merge values
            const existingValues = ydata.get('values') || new Y.Map();
            const newValues = deepPlainToY(updates.values);
            // Update each value individually
            newValues.forEach((value, key) => {
                existingValues.set(key, value);
            });
            ydata.set('values', existingValues);
        }
        if (updates.deployableId !== undefined) {
            ydata.set('deployableId', updates.deployableId);
        }
        if (updates.instanceColor !== undefined) {
            ydata.set('instanceColor', updates.instanceColor);
        }
    }, MCP_ORIGIN);
    return getConstruct(ydoc, levelId, semanticId);
}
/**
 * Delete a construct and its connections within a level
 */
export function deleteConstruct(ydoc, levelId, semanticId) {
    const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
    const levelEdges = getLevelMap(ydoc, 'edges', levelId);
    // Find the node by semantic ID
    let foundId = null;
    levelNodes.forEach((ynode, id) => {
        const data = ynode.get('data');
        if (data && safeGet(data, 'semanticId') === semanticId) {
            foundId = id;
        }
    });
    if (!foundId)
        return false;
    ydoc.transact(() => {
        // Remove edges connected to this node
        const edgesToDelete = [];
        levelEdges.forEach((yedge, edgeId) => {
            if (yedge.get('source') === foundId || yedge.get('target') === foundId) {
                edgesToDelete.push(edgeId);
            }
        });
        for (const edgeId of edgesToDelete) {
            levelEdges.delete(edgeId);
        }
        // Remove connections referencing this node from other nodes
        levelNodes.forEach((ynode) => {
            const ydata = ynode.get('data');
            if (ydata) {
                const yconns = safeGet(ydata, 'connections');
                if (yconns && Array.isArray(yconns)) {
                    // Plain array - filter out connections to deleted node
                    const filtered = yconns.filter((conn) => {
                        const c = conn;
                        return c.targetSemanticId !== semanticId;
                    });
                    if (ydata instanceof Y.Map) {
                        ydata.set('connections', deepPlainToY(filtered));
                    }
                }
                else if (yconns instanceof Y.Array) {
                    // Find indices to remove (in reverse to avoid shifting issues)
                    const indicesToRemove = [];
                    for (let i = 0; i < yconns.length; i++) {
                        const conn = yconns.get(i);
                        if (conn && safeGet(conn, 'targetSemanticId') === semanticId) {
                            indicesToRemove.push(i);
                        }
                    }
                    // Remove in reverse order
                    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
                        yconns.delete(indicesToRemove[i], 1);
                    }
                }
            }
        });
        // Delete the node
        levelNodes.delete(foundId);
    }, MCP_ORIGIN);
    return true;
}
// ===== CONNECTION OPERATIONS =====
/**
 * Connect two constructs via ports within a level
 */
export function connect(ydoc, levelId, sourceSemanticId, sourcePortId, targetSemanticId, targetPortId) {
    const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
    const levelEdges = getLevelMap(ydoc, 'edges', levelId);
    // Find source and target nodes
    let sourceNodeId = null;
    let targetNodeId = null;
    let sourceYdata = null;
    levelNodes.forEach((ynode, id) => {
        const ydata = ynode.get('data');
        if (ydata) {
            const sid = safeGet(ydata, 'semanticId');
            if (sid === sourceSemanticId) {
                sourceNodeId = id;
                sourceYdata = ydata;
            }
            if (sid === targetSemanticId) {
                targetNodeId = id;
            }
        }
    });
    if (!sourceNodeId || !targetNodeId || !sourceYdata)
        return null;
    const edgeId = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    ydoc.transact(() => {
        // Create edge
        const yedge = new Y.Map();
        yedge.set('source', sourceNodeId);
        yedge.set('target', targetNodeId);
        yedge.set('sourceHandle', sourcePortId);
        yedge.set('targetHandle', targetPortId);
        levelEdges.set(edgeId, yedge);
        // Add connection to source node
        let yconns = sourceYdata.get('connections');
        if (!yconns) {
            yconns = new Y.Array();
            sourceYdata.set('connections', yconns);
        }
        const connectionData = {
            portId: sourcePortId,
            targetSemanticId,
            targetPortId,
        };
        yconns.push([deepPlainToY(connectionData)]);
    }, MCP_ORIGIN);
    return {
        id: edgeId,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: sourcePortId,
        targetHandle: targetPortId,
    };
}
/**
 * Disconnect two constructs within a level
 */
export function disconnect(ydoc, levelId, sourceSemanticId, sourcePortId, targetSemanticId) {
    const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
    const levelEdges = getLevelMap(ydoc, 'edges', levelId);
    // Find source and target node IDs
    let sourceNodeId = null;
    let targetNodeId = null;
    let sourceYdata = null;
    levelNodes.forEach((ynode, id) => {
        const ydata = ynode.get('data');
        if (ydata) {
            const sid = safeGet(ydata, 'semanticId');
            if (sid === sourceSemanticId) {
                sourceNodeId = id;
                sourceYdata = ydata;
            }
            if (sid === targetSemanticId) {
                targetNodeId = id;
            }
        }
    });
    if (!sourceNodeId || !sourceYdata)
        return false;
    ydoc.transact(() => {
        // Remove connection from source node
        const yconns = safeGet(sourceYdata, 'connections');
        if (yconns instanceof Y.Array) {
            for (let i = yconns.length - 1; i >= 0; i--) {
                const conn = yconns.get(i);
                if (conn &&
                    safeGet(conn, 'portId') === sourcePortId &&
                    safeGet(conn, 'targetSemanticId') === targetSemanticId) {
                    yconns.delete(i, 1);
                    break;
                }
            }
        }
        else if (Array.isArray(yconns)) {
            // Plain array - filter and replace
            const filtered = yconns.filter((conn) => {
                const c = conn;
                return !(c.portId === sourcePortId && c.targetSemanticId === targetSemanticId);
            });
            if (sourceYdata instanceof Y.Map) {
                sourceYdata.set('connections', deepPlainToY(filtered));
            }
        }
        // Remove corresponding edge
        if (targetNodeId) {
            const edgesToDelete = [];
            levelEdges.forEach((yedge, edgeId) => {
                if (yedge.get('source') === sourceNodeId &&
                    yedge.get('target') === targetNodeId &&
                    yedge.get('sourceHandle') === sourcePortId) {
                    edgesToDelete.push(edgeId);
                }
            });
            for (const edgeId of edgesToDelete) {
                levelEdges.delete(edgeId);
            }
        }
    }, MCP_ORIGIN);
    return true;
}
// ===== SCHEMA OPERATIONS (shared across levels) =====
/**
 * List all schemas (built-in + custom)
 */
export function listSchemas(ydoc) {
    const yschemas = ydoc.getMap('schemas');
    const schemas = [...builtInConstructSchemas];
    // Add custom schemas from document
    yschemas.forEach((yschema) => {
        const schema = yToPlain(yschema);
        // Only add if not already a built-in
        if (!schemas.some(s => s.type === schema.type)) {
            schemas.push(schema);
        }
    });
    return schemas;
}
/**
 * Get a schema by type
 */
export function getSchema(ydoc, type) {
    // Check built-in first
    const builtIn = builtInConstructSchemas.find((s) => s.type === type);
    if (builtIn)
        return builtIn;
    // Check custom schemas
    const yschemas = ydoc.getMap('schemas');
    const yschema = yschemas.get(type);
    if (yschema) {
        return yToPlain(yschema);
    }
    return null;
}
/**
 * Apply smart defaults to a schema for better UX
 */
function applySchemaDefaults(schema) {
    const processed = { ...schema };
    // Auto-detect primary fields and set displayTier
    const primaryFieldNames = ['name', 'title', 'label', 'summary', 'condition'];
    if (Array.isArray(processed.fields)) {
        processed.fields = processed.fields.map((field) => {
            if (primaryFieldNames.includes(field.name.toLowerCase()) && field.displayTier === undefined) {
                return { ...field, displayTier: 'minimal' };
            }
            return field;
        });
    }
    // Add default ports if none specified
    if (!processed.ports || processed.ports.length === 0) {
        processed.ports = [
            { id: 'flow-in', portType: 'flow-in', position: 'left', offset: 50, label: 'In' },
            { id: 'flow-out', portType: 'flow-out', position: 'right', offset: 50, label: 'Out' },
            { id: 'parent', portType: 'parent', position: 'bottom', offset: 50, label: 'Children' },
            { id: 'child', portType: 'child', position: 'top', offset: 50, label: 'Parent' },
        ];
    }
    return processed;
}
/**
 * Create a custom schema
 */
export function createSchema(ydoc, schema) {
    const yschemas = ydoc.getMap('schemas');
    // Check if already exists
    if (yschemas.has(schema.type))
        return null;
    // Apply smart defaults
    const processedSchema = applySchemaDefaults(schema);
    ydoc.transact(() => {
        yschemas.set(processedSchema.type, deepPlainToY(processedSchema));
    }, MCP_ORIGIN);
    return processedSchema;
}
/**
 * Remove a custom schema
 */
export function removeSchema(ydoc, type) {
    const yschemas = ydoc.getMap('schemas');
    if (!yschemas.has(type))
        return false;
    ydoc.transact(() => {
        yschemas.delete(type);
    }, MCP_ORIGIN);
    return true;
}
// ===== DEPLOYABLE OPERATIONS =====
/**
 * List all deployables in a level
 */
export function listDeployables(ydoc, levelId) {
    const levelDeployables = getLevelMap(ydoc, 'deployables', levelId);
    const deployables = [];
    levelDeployables.forEach((ydeployable) => {
        deployables.push(yToPlain(ydeployable));
    });
    return deployables;
}
/**
 * Create a deployable in a level
 */
export function createDeployable(ydoc, levelId, name, description, color) {
    const levelDeployables = getLevelMap(ydoc, 'deployables', levelId);
    const deployable = {
        id: generateDeployableId(),
        name,
        description,
        color: color || generateDeployableColor(),
    };
    ydoc.transact(() => {
        levelDeployables.set(deployable.id, deepPlainToY(deployable));
    }, MCP_ORIGIN);
    return deployable;
}
// ===== COMPILATION =====
/**
 * Compile a level's document to AI-readable output
 */
export function compile(ydoc, levelId) {
    const nodes = listConstructs(ydoc, levelId);
    const schemas = listSchemas(ydoc);
    const deployables = listDeployables(ydoc, levelId);
    // Get edges for level
    const levelEdges = getLevelMap(ydoc, 'edges', levelId);
    const edges = [];
    levelEdges.forEach((yedge, id) => {
        edges.push({
            id,
            source: yedge.get('source'),
            target: yedge.get('target'),
            sourceHandle: yedge.get('sourceHandle'),
            targetHandle: yedge.get('targetHandle'),
        });
    });
    const compilerEngine = new CompilerEngine();
    return compilerEngine.compile(nodes, edges, { schemas, deployables });
}
// ===== DOCUMENT EXTRACTION =====
/**
 * Extract full document from Y.Doc for a given level
 */
export function extractDocument(ydoc, roomId, levelId) {
    const ymeta = ydoc.getMap('meta');
    const nodes = listConstructs(ydoc, levelId);
    const schemas = listSchemas(ydoc);
    const deployables = listDeployables(ydoc, levelId);
    // Get edges for level
    const levelEdges = getLevelMap(ydoc, 'edges', levelId);
    const edges = [];
    levelEdges.forEach((yedge, id) => {
        edges.push({
            id,
            source: yedge.get('source'),
            target: yedge.get('target'),
            sourceHandle: yedge.get('sourceHandle'),
            targetHandle: yedge.get('targetHandle'),
        });
    });
    const now = new Date().toISOString();
    // Only include custom schemas (filter out built-ins)
    const builtInTypes = new Set(builtInConstructSchemas.map((s) => s.type));
    const customSchemas = schemas.filter((s) => !builtInTypes.has(s.type));
    return {
        id: roomId,
        title: ymeta.get('title') || 'Untitled Project',
        folder: ymeta.get('folder') || '/',
        version: ymeta.get('version') || 3,
        formatVersion: SERVER_FORMAT_VERSION,
        createdAt: now,
        updatedAt: now,
        nodes,
        edges,
        deployables,
        customSchemas,
    };
}
