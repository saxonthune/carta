import type { CartaNode, CartaEdge } from '@carta/types';
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
  groupId?: string;
}): CartaNode {
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
      connections: options.connections ?? [],
      groupId: options.groupId,
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
}): CartaEdge {
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
  const nodes: CartaNode[] = [
    createTestNode({ id: '1', type: 'Task', semanticId: 'task-one', x: 0, y: 0 }),
    createTestNode({ id: '2', type: 'Task', semanticId: 'task-two', x: 200, y: 0 }),
    createTestNode({ id: '3', type: 'Service', semanticId: 'service-one', x: 400, y: 0 }),
  ];

  const edges: CartaEdge[] = [
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

export interface ParsedConstructEntry {
  id: string;
  type: string;
  references?: string[];
  referencedBy?: string[];
  organizedIn?: string;
  organizedMembers?: string[];
  [key: string]: unknown;
}

/**
 * Parses compiler output into structured construct entries.
 * The compiler outputs constructs as raw JSON arrays (not in code blocks).
 * This function extracts all JSON arrays from the output, whether they're in code blocks or not.
 */
export function parseCompilerOutput(output: string): ParsedConstructEntry[] {
  const entries: ParsedConstructEntry[] = [];

  // Strategy: Split by section headers and look for JSON arrays
  // The compiler outputs constructs under "## TypeDisplayName" headers followed by raw JSON arrays

  // First, try to extract JSON code blocks (for organizers/schemas - we skip these as they're not arrays)
  const jsonBlockRegex = /```json\n([\s\S]*?)\n```/g;
  let match;
  while ((match = jsonBlockRegex.exec(output)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        entries.push(...parsed);
      }
    } catch {
      // Skip non-JSON blocks
    }
  }

  // Second, look for raw JSON arrays (the main construct entries)
  // These appear after "## DisplayName" headers
  // We need to track bracket depth since arrays can contain nested arrays
  const lines = output.split('\n');
  let inJsonArray = false;
  let jsonBuffer = '';
  let bracketDepth = 0;

  for (const line of lines) {
    // Detect start of top-level JSON array (bracket depth 0 → 1)
    if (!inJsonArray && line.trim() === '[') {
      inJsonArray = true;
      jsonBuffer = line;
      bracketDepth = 1;
    } else if (inJsonArray) {
      jsonBuffer += '\n' + line;
      // Update bracket depth
      for (const char of line) {
        if (char === '[') bracketDepth++;
        if (char === ']') bracketDepth--;
      }
      // When we return to depth 0, we've closed the top-level array
      if (bracketDepth === 0) {
        try {
          const parsed = JSON.parse(jsonBuffer);
          if (Array.isArray(parsed)) {
            entries.push(...parsed);
          }
        } catch {
          // Skip invalid JSON
        }
        inJsonArray = false;
        jsonBuffer = '';
      }
    }
  }

  return entries;
}
