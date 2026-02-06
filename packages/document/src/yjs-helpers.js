import * as Y from 'yjs';
/**
 * Convert a plain object to a Y.Map (shallow).
 *
 * Guards against:
 * - undefined values (skipped)
 * - NaN/Infinity (throws)
 * - Functions (throws)
 */
export function objectToYMap(obj) {
    const ymap = new Y.Map();
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined)
            continue;
        if (typeof value === 'number' && !Number.isFinite(value)) {
            throw new Error(`Cannot store ${value} in Y.Doc field "${key}" (NaN/Infinity not allowed)`);
        }
        if (typeof value === 'function') {
            throw new Error(`Cannot store function in Y.Doc field "${key}"`);
        }
        ymap.set(key, value);
    }
    return ymap;
}
/**
 * Convert Yjs types to plain JavaScript values (deep conversion).
 * Handles Y.Map, Y.Array, nested plain objects, and plain arrays.
 */
export function yToPlain(value) {
    if (value instanceof Y.Map) {
        const obj = {};
        value.forEach((v, k) => {
            obj[k] = yToPlain(v);
        });
        return obj;
    }
    if (value instanceof Y.Array) {
        return value.toArray().map(yToPlain);
    }
    if (Array.isArray(value)) {
        return value.map(yToPlain);
    }
    if (value && typeof value === 'object' && value.constructor === Object) {
        const obj = {};
        for (const [k, v] of Object.entries(value)) {
            obj[k] = yToPlain(v);
        }
        return obj;
    }
    return value;
}
/** Alias for yToPlain */
export const deepYToPlain = yToPlain;
/**
 * Convert a Y.Map to a plain object (deep conversion)
 */
export function yMapToObject(ymap) {
    return yToPlain(ymap);
}
/**
 * Deep convert plain objects to Y structures.
 *
 * Guards against:
 * - undefined values (skipped)
 * - NaN/Infinity (throws)
 * - Functions, Symbols, Dates (throws)
 * - Circular references (throws via visited WeakSet)
 * - Excessive nesting (throws at depth > 50)
 */
export function deepPlainToY(value, visited = new WeakSet(), depth = 0) {
    const MAX_DEPTH = 50;
    if (depth > MAX_DEPTH) {
        throw new Error('deepPlainToY: max depth exceeded (possible circular reference)');
    }
    // Primitives
    if (value === null)
        return null;
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error(`Cannot store ${value} in Y.Doc (NaN/Infinity not allowed)`);
        }
        return value;
    }
    // Reject unsupported types
    if (typeof value === 'function') {
        throw new Error('Cannot serialize function to Y.Doc');
    }
    if (typeof value === 'symbol') {
        throw new Error('Cannot serialize symbol to Y.Doc');
    }
    if (value instanceof Date) {
        throw new Error('Cannot serialize Date to Y.Doc (use ISO string instead)');
    }
    // Circular reference detection for objects/arrays
    if (visited.has(value)) {
        throw new Error('Circular reference detected in deepPlainToY');
    }
    visited.add(value);
    if (Array.isArray(value)) {
        const yarr = new Y.Array();
        yarr.push(value.map(v => deepPlainToY(v, visited, depth + 1)));
        return yarr;
    }
    if (typeof value === 'object') {
        const ymap = new Y.Map();
        for (const [k, v] of Object.entries(value)) {
            if (v !== undefined) {
                ymap.set(k, deepPlainToY(v, visited, depth + 1));
            }
        }
        return ymap;
    }
    return value;
}
/**
 * Safely get a value from either a Y.Map or plain object.
 * After certain Yjs operations, data structures may be plain objects
 * rather than Y.Map instances.
 */
export function safeGet(value, key) {
    if (!value)
        return undefined;
    if (value instanceof Y.Map) {
        return value.get(key);
    }
    return value[key];
}
/**
 * Safely get a string from a Y.Map or plain object.
 * Returns empty string if missing, null, or wrong type.
 */
export function safeGetString(value, key, defaultValue = '') {
    const val = safeGet(value, key);
    if (typeof val !== 'string')
        return defaultValue;
    return val;
}
/**
 * Safely get a number from a Y.Map or plain object.
 * Returns 0 if missing, null, NaN, Infinity, or wrong type.
 */
export function safeGetNumber(value, key, defaultValue = 0) {
    const val = safeGet(value, key);
    if (typeof val !== 'number' || !Number.isFinite(val))
        return defaultValue;
    return val;
}
/**
 * Safely get a boolean from a Y.Map or plain object.
 * Returns false if missing, null, or wrong type.
 */
export function safeGetBoolean(value, key, defaultValue = false) {
    const val = safeGet(value, key);
    if (typeof val !== 'boolean')
        return defaultValue;
    return val;
}
