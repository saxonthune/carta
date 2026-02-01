import * as Y from 'yjs';

/**
 * Convert a plain object to a Y.Map (shallow)
 */
export function objectToYMap(obj: object): Y.Map<unknown> {
  const ymap = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(obj)) {
    ymap.set(key, value);
  }
  return ymap;
}

/**
 * Convert Yjs types to plain JavaScript values (deep conversion).
 * Handles Y.Map, Y.Array, nested plain objects, and plain arrays.
 */
export function yToPlain(value: unknown): unknown {
  if (value instanceof Y.Map) {
    const obj: Record<string, unknown> = {};
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
    const obj: Record<string, unknown> = {};
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
export function yMapToObject<T>(ymap: Y.Map<unknown>): T {
  return yToPlain(ymap) as T;
}

/**
 * Deep convert plain objects to Y structures
 */
export function deepPlainToY(value: unknown): unknown {
  if (Array.isArray(value)) {
    const yarr = new Y.Array();
    yarr.push(value.map(deepPlainToY));
    return yarr;
  }
  if (value !== null && typeof value === 'object') {
    const ymap = new Y.Map<unknown>();
    for (const [k, v] of Object.entries(value)) {
      ymap.set(k, deepPlainToY(v));
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
export function safeGet(value: Y.Map<unknown> | Record<string, unknown> | undefined, key: string): unknown {
  if (!value) return undefined;
  if (value instanceof Y.Map) {
    return value.get(key);
  }
  return (value as Record<string, unknown>)[key];
}
