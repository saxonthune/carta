/**
 * CartaNode - Platform-agnostic node type for Carta's graph structure.
 * This matches the shape of React Flow nodes but without the @xyflow/react dependency.
 * Represents nodes as stored in Yjs and used throughout the adapter/hook layer.
 */
export interface CartaNode<T = Record<string, unknown>> {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: T;
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
  style?: Record<string, unknown>;
  hidden?: boolean;
  selected?: boolean;
  dragging?: boolean;
  parentId?: string;
  [key: string]: unknown;
}

/**
 * CartaEdge - Platform-agnostic edge type for Carta's graph structure.
 * This matches the shape of React Flow edges but without the @xyflow/react dependency.
 */
export interface CartaEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  label?: string;
  data?: Record<string, unknown>;
  hidden?: boolean;
  selected?: boolean;
  animated?: boolean;
  style?: Record<string, unknown>;
  [key: string]: unknown;
}
