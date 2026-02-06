import { portRegistry } from './registry.js';
/**
 * Check if two port types can be connected
 * Delegates to the port registry
 */
export function canConnect(sourcePortType, targetPortType) {
    return portRegistry.canConnect(sourcePortType, targetPortType);
}
/**
 * Get the color for a port type
 * Delegates to the port registry
 */
export function getPortColor(portType) {
    return portRegistry.getColor(portType);
}
/**
 * Default ports for constructs that don't define their own
 */
export const DEFAULT_PORTS = [
    { id: 'flow-in', portType: 'flow-in', label: 'Flow In' },
    { id: 'flow-out', portType: 'flow-out', label: 'Flow Out' },
];
/**
 * Get ports for a schema, falling back to defaults
 */
export function getPortsForSchema(ports) {
    if (ports && ports.length > 0) {
        return ports;
    }
    return DEFAULT_PORTS;
}
/**
 * Create a port config from a port type
 */
export function createPortFromType(portTypeId, overrides) {
    const portDef = portRegistry.get(portTypeId);
    if (!portDef)
        return null;
    return {
        id: portTypeId,
        portType: portTypeId,
        label: portDef.displayName,
        ...overrides,
    };
}
/**
 * Determine React Flow handle type from port type using polarity
 * 'target' handles receive connections, 'source' handles initiate them
 */
export function getHandleType(portType) {
    const schema = portRegistry.get(portType);
    if (!schema)
        return 'source';
    return (schema.polarity === 'sink' || schema.polarity === 'intercept') ? 'target' : 'source';
}
