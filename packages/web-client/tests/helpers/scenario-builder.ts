import type { CartaNode } from '@carta/schema';

/** Minimal construct node. Uses type-based defaults from getNodeDimensions. */
export function makeConstruct(id: string, opts?: {
  position?: { x: number; y: number };
  parentId?: string;
  semanticId?: string;
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
}): CartaNode {
  const node: CartaNode = {
    id,
    type: 'construct',
    position: opts?.position ?? { x: 0, y: 0 },
    data: { constructType: 'Task', semanticId: opts?.semanticId ?? id },
  };
  if (opts?.parentId !== undefined) node.parentId = opts.parentId;
  if (opts?.measured !== undefined) node.measured = opts.measured;
  if (opts?.width !== undefined) node.width = opts.width;
  if (opts?.height !== undefined) node.height = opts.height;
  return node;
}

/** Organizer node with explicit style dimensions. */
export function makeOrganizer(id: string, opts?: {
  position?: { x: number; y: number };
  parentId?: string;
  style?: { width: number; height: number };
  measured?: { width?: number; height?: number };
  layoutPinned?: boolean;
  name?: string;
}): CartaNode {
  const node: CartaNode = {
    id,
    type: 'organizer',
    position: opts?.position ?? { x: 0, y: 0 },
    data: {
      isOrganizer: true,
      name: opts?.name ?? id,
      ...(opts?.layoutPinned !== undefined ? { layoutPinned: opts.layoutPinned } : {}),
    },
    style: opts?.style ?? { width: 400, height: 300 },
  };
  if (opts?.parentId !== undefined) node.parentId = opts.parentId;
  if (opts?.measured !== undefined) node.measured = opts.measured;
  return node;
}

/** Wagon organizer attached to a construct's semanticId. */
export function makeWagon(id: string, opts: {
  parentId: string;
  attachedToSemanticId: string;
  position?: { x: number; y: number };
  style?: { width: number; height: number };
}): CartaNode {
  return {
    id,
    type: 'organizer',
    position: opts.position ?? { x: 0, y: 0 },
    parentId: opts.parentId,
    data: {
      isOrganizer: true,
      attachedToSemanticId: opts.attachedToSemanticId,
      name: id,
    },
    style: opts.style ?? { width: 400, height: 300 },
  };
}
