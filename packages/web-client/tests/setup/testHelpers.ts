import type { Node, Edge } from '@xyflow/react';
import type { ConstructNodeData } from '@carta/domain';

/**
 * Creates a test node with sensible defaults.
 */
export function createTestNode(options: {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  semanticId?: string;
  values?: Record<string, unknown>;
  connections?: ConstructNodeData['connections'];
  deployableId?: string | null;
}): Node {
  const id = options.id ?? crypto.randomUUID();
  const constructType = options.type ?? 'Task';
  const semanticId = options.semanticId ?? `${constructType.toLowerCase()}-${Date.now()}`;

  return {
    id,
    type: 'construct',
    position: { x: options.x ?? 0, y: options.y ?? 0 },
    data: {
      constructType,
      semanticId,
      values: options.values ?? {},
      viewLevel: 'summary' as const,
      connections: options.connections ?? [],
      deployableId: options.deployableId ?? null,
    } satisfies ConstructNodeData,
  };
}

/**
 * Creates a test edge between two nodes.
 */
export function createTestEdge(options: {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}): Edge {
  return {
    id: options.id ?? `edge-${options.source}-${options.target}`,
    source: options.source,
    target: options.target,
    sourceHandle: options.sourceHandle ?? 'flow-out',
    targetHandle: options.targetHandle ?? 'flow-in',
  };
}

/**
 * Creates a sample document with nodes and edges for testing.
 */
export function createSampleDocument() {
  const nodes: Node[] = [
    createTestNode({ id: '1', type: 'Task', semanticId: 'task-one', x: 0, y: 0 }),
    createTestNode({ id: '2', type: 'Task', semanticId: 'task-two', x: 200, y: 0 }),
    createTestNode({ id: '3', type: 'Service', semanticId: 'service-one', x: 400, y: 0 }),
  ];

  const edges: Edge[] = [
    createTestEdge({ source: '1', target: '2' }),
    createTestEdge({ source: '2', target: '3' }),
  ];

  return { nodes, edges };
}

/**
 * Waits for a condition to be true, with timeout.
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error('waitFor timeout');
}
