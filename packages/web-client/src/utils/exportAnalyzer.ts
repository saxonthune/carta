import type { CartaNode, CartaEdge } from '@carta/types';
import type { ConstructSchema, ConstructNodeData, PortSchema, SchemaGroup } from '@carta/domain';

/**
 * Category of items for export
 */
export interface ExportCategory<T> {
  items: T[];
  count: number;
}

/**
 * Full export analysis result
 */
export interface ExportAnalysis {
  title: string;
  description: string;
  schemas: ExportCategory<ConstructSchema>;
  nodes: ExportCategory<CartaNode<ConstructNodeData>>;
  portSchemas: ExportCategory<PortSchema>;
  schemaGroups: ExportCategory<SchemaGroup>;
  edgeCount: number;
}

/**
 * Options for what to export
 */
export interface ExportOptions {
  schemas: boolean;
  nodes: boolean;
  portSchemas: boolean;
  schemaGroups: boolean;
}

/**
 * Default export options (all enabled)
 */
export const defaultExportOptions: ExportOptions = {
  schemas: true,
  nodes: true,
  portSchemas: true,
  schemaGroups: true,
};

/**
 * Analyze current state for export preview
 */
export function analyzeExport(
  title: string,
  description: string,
  nodes: CartaNode[],
  edges: CartaEdge[],
  userSchemas: ConstructSchema[],
  portSchemas: PortSchema[],
  schemaGroups: SchemaGroup[]
): ExportAnalysis {
  return {
    title,
    description,
    schemas: {
      items: userSchemas,
      count: userSchemas.length,
    },
    nodes: {
      items: nodes as CartaNode<ConstructNodeData>[],
      count: nodes.length,
    },
    portSchemas: {
      items: portSchemas,
      count: portSchemas.length,
    },
    schemaGroups: {
      items: schemaGroups,
      count: schemaGroups.length,
    },
    edgeCount: edges.length,
  };
}
