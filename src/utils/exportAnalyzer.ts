import type { Node, Edge } from '@xyflow/react';
import type { ConstructSchema, Deployable, ConstructNodeData } from '../constructs/types';

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
  schemas: ExportCategory<ConstructSchema>;
  nodes: ExportCategory<Node<ConstructNodeData>>;
  deployables: ExportCategory<Deployable>;
  edgeCount: number;
}

/**
 * Options for what to export
 */
export interface ExportOptions {
  schemas: boolean;
  nodes: boolean;
  deployables: boolean;
  portSchemas?: boolean;
}

/**
 * Default export options (all enabled)
 */
export const defaultExportOptions: ExportOptions = {
  schemas: true,
  nodes: true,
  deployables: true,
};

/**
 * Analyze current state for export preview
 */
export function analyzeExport(
  title: string,
  nodes: Node[],
  edges: Edge[],
  deployables: Deployable[],
  userSchemas: ConstructSchema[]
): ExportAnalysis {
  return {
    title,
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
    edgeCount: edges.length,
  };
}
