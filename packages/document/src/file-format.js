/**
 * .carta file format types and validation.
 *
 * Platform-agnostic: uses unknown[] for nodes/edges instead of @xyflow/react types.
 * Web-client re-exports these and adds browser-specific import/export functions.
 */
import { CARTA_FILE_VERSION } from './constants.js';
/**
 * Parse and validate a .carta file from raw string content
 */
export function importProjectFromString(content) {
    const data = JSON.parse(content);
    return validateCartaFile(data);
}
/**
 * Validate the structure of a .carta file
 */
export function validateCartaFile(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid file: expected JSON object');
    }
    const obj = data;
    // Check version
    if (typeof obj.version !== 'number') {
        throw new Error('Invalid file: missing or invalid version');
    }
    if (obj.version > CARTA_FILE_VERSION) {
        throw new Error(`File version ${obj.version} is newer than supported version ${CARTA_FILE_VERSION}`);
    }
    // Check required fields
    if (typeof obj.title !== 'string') {
        throw new Error('Invalid file: missing or invalid title');
    }
    // Require levels array
    if (!Array.isArray(obj.levels) || obj.levels.length === 0) {
        throw new Error('Invalid file: missing or empty levels array');
    }
    if (!Array.isArray(obj.customSchemas)) {
        throw new Error('Invalid file: missing or invalid customSchemas array');
    }
    // Validate levels
    for (const level of obj.levels) {
        if (!level || typeof level !== 'object') {
            throw new Error('Invalid file: invalid level structure');
        }
        const l = level;
        if (typeof l.id !== 'string' || typeof l.name !== 'string' || typeof l.order !== 'number') {
            throw new Error('Invalid file: level missing required fields (id, name, order)');
        }
        if (!Array.isArray(l.nodes) || !Array.isArray(l.edges) || !Array.isArray(l.deployables)) {
            throw new Error('Invalid file: level missing required arrays (nodes, edges, deployables)');
        }
    }
    // Validate nodes across all levels
    const nodesToValidate = obj.levels.flatMap(l => l.nodes);
    for (const node of nodesToValidate) {
        if (!node || typeof node !== 'object') {
            throw new Error('Invalid file: invalid node structure');
        }
        const n = node;
        if (typeof n.id !== 'string' || !n.position || typeof n.type !== 'string') {
            throw new Error('Invalid file: node missing required fields (id, position, type)');
        }
        if (n.data && typeof n.data === 'object') {
            const nodeData = n.data;
            if (nodeData.connections !== undefined) {
                if (!Array.isArray(nodeData.connections)) {
                    throw new Error(`Invalid file: node "${n.id}" has invalid connections (must be array)`);
                }
                for (const conn of nodeData.connections) {
                    if (!conn || typeof conn !== 'object') {
                        throw new Error(`Invalid file: node "${n.id}" has invalid connection structure`);
                    }
                    const c = conn;
                    if (typeof c.portId !== 'string' || typeof c.targetSemanticId !== 'string' ||
                        typeof c.targetPortId !== 'string') {
                        throw new Error(`Invalid file: node "${n.id}" has connection missing required fields`);
                    }
                }
            }
        }
    }
    // Validate edges across all levels
    const edgesToValidate = obj.levels.flatMap(l => l.edges);
    for (const edge of edgesToValidate) {
        if (!edge || typeof edge !== 'object') {
            throw new Error('Invalid file: invalid edge structure');
        }
        const e = edge;
        if (typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') {
            throw new Error('Invalid file: edge missing required fields (id, source, target)');
        }
    }
    // Validate deployables across all levels
    const deployablesToValidate = obj.levels.flatMap(l => l.deployables);
    for (const deployable of deployablesToValidate) {
        if (!deployable || typeof deployable !== 'object') {
            throw new Error('Invalid file: invalid deployable structure');
        }
        const d = deployable;
        if (typeof d.id !== 'string' || typeof d.name !== 'string' || typeof d.description !== 'string') {
            throw new Error('Invalid file: deployable missing required fields');
        }
    }
    // Validate custom schemas
    for (const schema of obj.customSchemas) {
        if (!schema || typeof schema !== 'object') {
            throw new Error('Invalid file: invalid schema structure');
        }
        const s = schema;
        if (typeof s.type !== 'string' || typeof s.displayName !== 'string' ||
            typeof s.color !== 'string' || !Array.isArray(s.fields) || !s.compilation) {
            throw new Error('Invalid file: schema missing required fields');
        }
        if (s.ports !== undefined) {
            if (!Array.isArray(s.ports)) {
                throw new Error(`Invalid file: schema "${s.type}" has invalid ports (must be array)`);
            }
            for (const port of s.ports) {
                if (!port || typeof port !== 'object') {
                    throw new Error(`Invalid file: schema "${s.type}" has invalid port structure`);
                }
                const p = port;
                if (typeof p.id !== 'string' || typeof p.portType !== 'string' ||
                    typeof p.label !== 'string') {
                    throw new Error(`Invalid file: schema "${s.type}" has port missing required fields (id, portType, label)`);
                }
            }
        }
    }
    // Validate portSchemas (required)
    if (!Array.isArray(obj.portSchemas)) {
        throw new Error('Invalid file: missing or invalid portSchemas array');
    }
    for (const ps of obj.portSchemas) {
        if (!ps || typeof ps !== 'object') {
            throw new Error('Invalid file: invalid portSchema structure');
        }
        const p = ps;
        if (typeof p.id !== 'string' || typeof p.displayName !== 'string' ||
            typeof p.semanticDescription !== 'string' || typeof p.polarity !== 'string' ||
            !Array.isArray(p.compatibleWith) ||
            typeof p.color !== 'string') {
            throw new Error(`Invalid file: portSchema missing required fields (id, displayName, semanticDescription, polarity, compatibleWith, color)`);
        }
        const validPolarities = ['source', 'sink', 'bidirectional', 'relay', 'intercept'];
        if (!validPolarities.includes(p.polarity)) {
            throw new Error(`Invalid file: portSchema "${p.id}" has invalid polarity "${p.polarity}"`);
        }
    }
    // Validate schemaGroups (required for v5 and earlier, optional for v6+)
    if (!Array.isArray(obj.schemaGroups)) {
        // Allow missing schemaGroups for newer files
        if (obj.version < 6) {
            throw new Error('Invalid file: missing or invalid schemaGroups array');
        }
        obj.schemaGroups = [];
    }
    for (const sg of obj.schemaGroups) {
        if (!sg || typeof sg !== 'object') {
            throw new Error('Invalid file: invalid schemaGroup structure');
        }
        const g = sg;
        if (typeof g.id !== 'string' || typeof g.name !== 'string') {
            throw new Error(`Invalid file: schemaGroup missing required fields (id, name)`);
        }
        if (g.parentId !== undefined && typeof g.parentId !== 'string') {
            throw new Error(`Invalid file: schemaGroup "${g.id}" has invalid parentId (must be string)`);
        }
    }
    // Repair orphaned connections before returning
    const repairedData = repairOrphanedConnections(obj);
    return {
        version: repairedData.version,
        title: repairedData.title,
        description: repairedData.description,
        levels: repairedData.levels,
        customSchemas: repairedData.customSchemas,
        portSchemas: repairedData.portSchemas,
        schemaGroups: repairedData.schemaGroups,
        exportedAt: repairedData.exportedAt || new Date().toISOString(),
    };
}
/**
 * Repair orphaned connections in a .carta file.
 * Removes connections that reference non-existent nodes.
 */
function repairOrphanedConnections(obj) {
    // Build set of all valid semantic IDs
    const validSemanticIds = new Set();
    const nodesToCheck = obj.levels.flatMap(l => l.nodes);
    for (const node of nodesToCheck) {
        if (!node || typeof node !== 'object')
            continue;
        const n = node;
        if (n.data && typeof n.data === 'object') {
            const nodeData = n.data;
            if (typeof nodeData.semanticId === 'string') {
                validSemanticIds.add(nodeData.semanticId);
            }
        }
    }
    // Repair connections in all levels
    const repairedLevels = obj.levels.map((level) => {
        if (!level || typeof level !== 'object')
            return level;
        const l = level;
        if (!Array.isArray(l.nodes))
            return level;
        const repairedNodes = l.nodes.map((node) => {
            if (!node || typeof node !== 'object')
                return node;
            const n = node;
            if (!n.data || typeof n.data !== 'object')
                return node;
            const nodeData = n.data;
            if (!Array.isArray(nodeData.connections))
                return node;
            const validConnections = nodeData.connections.filter((conn) => {
                if (!conn || typeof conn !== 'object')
                    return false;
                const c = conn;
                return validSemanticIds.has(c.targetSemanticId);
            });
            // Only modify if connections changed
            if (validConnections.length === nodeData.connections.length)
                return node;
            return {
                ...n,
                data: {
                    ...nodeData,
                    connections: validConnections,
                },
            };
        });
        return {
            ...l,
            nodes: repairedNodes,
        };
    });
    return {
        ...obj,
        levels: repairedLevels,
    };
}
