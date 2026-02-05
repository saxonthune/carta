import type { ConstructNodeData, ConstructSchema } from '@carta/domain';

/**
 * JSON Formatter
 * Default formatter for custom/unknown construct types
 * Outputs a simple JSON representation of the construct data
 */
export function formatJSON(
  nodes: ConstructNodeData[],
  _edges: Array<{ source: string; target: string }>,
  _schema: ConstructSchema,
  _allNodes?: ConstructNodeData[]
): string {
  const output = nodes.map((node) => ({
    id: node.semanticId,
    type: node.constructType,
    ...(node.connections && node.connections.length > 0 && { connections: node.connections }),
    ...(node.references && node.references.length > 0 && { references: node.references }),
    ...(node.referencedBy && node.referencedBy.length > 0 && { referencedBy: node.referencedBy }),
    ...node.values,
  }));

  return JSON.stringify(output, null, 2);
}

export default formatJSON;
