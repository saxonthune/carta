import { canConnect, getHandleType, type ConstructSchema } from '@carta/schema';
import { stripHandlePrefix } from './handlePrefix.js';

/** Input for connection validation/creation */
export interface ConnectionEndpoint {
  nodeId: string;
  nodeType: string; // 'construct' | 'organizer' | etc.
  constructType?: string;
  handle: string;
}

/** Validated connection with normalized direction */
export interface NormalizedConnection {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

/**
 * Validate whether a connection between two ports is allowed.
 * Returns false for self-connections, missing handles, and incompatible port types.
 */
export function validateConnection(
  conn: { source: string; sourceHandle: string; target: string; targetHandle: string },
  getSchema: (type: string) => ConstructSchema | undefined,
  findNode: (id: string) => { type?: string; data: Record<string, unknown> } | undefined,
): boolean {
  if (conn.source === conn.target) return false;
  if (!conn.sourceHandle || !conn.targetHandle) return false;

  const cleanSourceHandle = stripHandlePrefix(conn.sourceHandle);
  const cleanTargetHandle = stripHandlePrefix(conn.targetHandle);

  const sourceNode = findNode(conn.source);
  const targetNode = findNode(conn.target);
  if (!sourceNode || !targetNode) return false;
  if (sourceNode.type !== 'construct' || targetNode.type !== 'construct') return true;

  const sourceSchema = getSchema((sourceNode.data as any).constructType);
  const targetSchema = getSchema((targetNode.data as any).constructType);
  if (!sourceSchema || !targetSchema) return false;

  const sourcePort = sourceSchema.ports?.find((p: any) => p.id === cleanSourceHandle);
  const targetPort = targetSchema.ports?.find((p: any) => p.id === cleanTargetHandle);
  if (!sourcePort || !targetPort) return false;

  return canConnect(sourcePort.portType, targetPort.portType);
}

/**
 * Normalize a connection: strip handle prefixes, determine direction,
 * and flip source/target if needed so source always has 'source' handle type.
 * Returns null if the connection is invalid (missing node/schema/port).
 */
export function normalizeConnection(
  conn: { source: string; sourceHandle: string; target: string; targetHandle: string },
  getSchema: (type: string) => ConstructSchema | undefined,
  findNode: (id: string) => { type?: string; data: Record<string, unknown> } | undefined,
): NormalizedConnection | null {
  const sourceNode = findNode(conn.source);
  const targetNode = findNode(conn.target);
  if (!sourceNode || !targetNode) return null;
  if (sourceNode.type !== 'construct' || targetNode.type !== 'construct') return null;

  const cleanSourceHandle = stripHandlePrefix(conn.sourceHandle);
  const cleanTargetHandle = stripHandlePrefix(conn.targetHandle);

  const sourceSchema = getSchema((sourceNode.data as any).constructType);
  const targetSchema = getSchema((targetNode.data as any).constructType);
  if (!sourceSchema || !targetSchema) return null;

  const sourcePort = sourceSchema.ports?.find((p: any) => p.id === cleanSourceHandle);
  const targetPort = targetSchema.ports?.find((p: any) => p.id === cleanTargetHandle);
  if (!sourcePort || !targetPort) return null;

  const sourceHandleType = getHandleType(sourcePort.portType);
  const targetHandleType = getHandleType(targetPort.portType);
  const needsFlip = sourceHandleType === 'target' && targetHandleType === 'source';

  if (needsFlip) {
    return {
      source: conn.target,
      sourceHandle: cleanTargetHandle,
      target: conn.source,
      targetHandle: cleanSourceHandle,
    };
  }

  return {
    source: conn.source,
    sourceHandle: cleanSourceHandle,
    target: conn.target,
    targetHandle: cleanTargetHandle,
  };
}
