import type { Node, Edge } from '@xyflow/react';
import type { ConstructSchema, Deployable, ConstructNodeData, PortSchema, SchemaGroup } from '../constructs/types';

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
  nodes: ExportCategory<Node<ConstructNodeData>>;
  deployables: ExportCategory<Deployable>;
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
  deployables: boolean;
  portSchemas: boolean;
  schemaGroups: boolean;
}

/**
 * Default export options (all enabled)
 */
export const defaultExportOptions: ExportOptions = {
  schemas: true,
  nodes: true,
  deployables: true,
  portSchemas: true,
  schemaGroups: true,
};

/**
 * Analyze current state for export preview
 */
export function analyzeExport(
  title: string,
  description: string,
  nodes: Node[],
  edges: Edge[],
  deployables: Deployable[],
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
      items: nodes as Node<ConstructNodeData>[],
      count: nodes.length,
    },
    deployables: {
      items: deployables,
      count: deployables.length,
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
