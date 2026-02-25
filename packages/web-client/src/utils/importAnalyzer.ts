import type { CartaNode } from '@carta/types';
import type { CartaFile } from './cartaFile';
import { standardLibrary } from '@carta/domain';
import type { ConstructSchema, ConstructNodeData, PortSchema, SchemaGroup, Resource } from '@carta/domain';

// Set of built-in schema types for quick lookup
const BUILT_IN_TYPES = new Set(
  standardLibrary.flatMap(pkg => pkg.schemas.map(s => s.type))
);

/**
 * Status of an analyzed item
 */
export type ItemStatus = 'new' | 'conflict';

/**
 * Summary for a category of items
 */
export interface CategorySummary {
  total: number;
  new: number;
  conflicts: number;
}

/**
 * Analyzed schema item
 */
export interface AnalyzedSchema {
  item: ConstructSchema;
  status: ItemStatus;
  existingItem?: ConstructSchema;
}

/**
 * Analyzed node item
 */
export interface AnalyzedNode {
  item: CartaNode<ConstructNodeData>;
  status: ItemStatus;
  existingItem?: CartaNode<ConstructNodeData>;
}

/**
 * Category of analyzed items
 */
export interface AnalyzedCategory<T> {
  items: T[];
  summary: CategorySummary;
}

/**
 * Full import analysis result
 */
export interface ImportAnalysis {
  fileName: string;
  title: string;
  description?: string;

  schemas: AnalyzedCategory<AnalyzedSchema>;
  nodes: AnalyzedCategory<AnalyzedNode>;
  edges: { count: number };

  // These are always imported (not selectable) but shown for information
  portSchemas: { items: PortSchema[]; count: number };
  schemaGroups: { items: SchemaGroup[]; count: number };
  resources: { items: Resource[]; count: number };

  hasConflicts: boolean;

  // Pages info for target picker
  filePageCount: number;
}

/**
 * Options for what to import - tracks individual items
 */
export interface ImportOptions {
  schemas: Set<string>; // Set of schema types to import
  nodes: Set<string>;   // Set of node IDs to import
  targetLevel: 'replace' | 'new' | string; // 'replace' = full doc replace, 'new' = create new page, or existing page ID
}

/**
 * Default import options - selects all items
 */
export const defaultImportOptions = (analysis: ImportAnalysis): ImportOptions => {
  return {
    schemas: new Set(analysis.schemas.items.map(s => s.item.type)),
    nodes: new Set(analysis.nodes.items.map(n => n.item.id)),
    targetLevel: 'replace',
  };
};

/**
 * Analyze a CartaFile for import preview
 */
export function analyzeImport(
  file: CartaFile,
  fileName: string,
  currentNodes: CartaNode[] = [],
  currentSchemas: ConstructSchema[] = []
): ImportAnalysis {
  // Flatten all nodes/edges across pages for analysis
  const fileNodes = file.pages.flatMap(l => l.nodes) as CartaNode[];
  const fileEdges = file.pages.flatMap(l => l.edges);

  // Analyze schemas
  const analyzedSchemas: AnalyzedSchema[] = file.customSchemas.map(schema => {
    const existing = currentSchemas.find(s => s.type === schema.type);
    // Check if it's a user schema (not built-in) with the same type
    const isConflict = existing && !BUILT_IN_TYPES.has(schema.type);
    return {
      item: schema,
      status: isConflict ? 'conflict' : 'new',
      existingItem: isConflict ? existing : undefined,
    };
  });

  const schemasNew = analyzedSchemas.filter(s => s.status === 'new').length;
  const schemasConflicts = analyzedSchemas.filter(s => s.status === 'conflict').length;

  // Analyze nodes by checking for semanticId conflicts
  const analyzedNodes: AnalyzedNode[] = fileNodes.map(node => {
    const nodeData = node.data as ConstructNodeData;
    const semanticId = nodeData.semanticId;

    // Check if a node with the same semanticId already exists
    const existingNode = currentNodes.find(n => {
      const existing = n.data as ConstructNodeData;
      return existing.semanticId === semanticId;
    });

    return {
      item: node as CartaNode<ConstructNodeData>,
      status: existingNode ? 'conflict' : 'new',
      existingItem: existingNode as CartaNode<ConstructNodeData> | undefined,
    };
  });

  const nodesNew = analyzedNodes.filter(n => n.status === 'new').length;
  const nodesConflicts = analyzedNodes.filter(n => n.status === 'conflict').length;

  const hasConflicts = schemasConflicts > 0 || nodesConflicts > 0;

  return {
    fileName,
    title: file.title,
    description: file.description,
    schemas: {
      items: analyzedSchemas,
      summary: {
        total: analyzedSchemas.length,
        new: schemasNew,
        conflicts: schemasConflicts,
      },
    },
    nodes: {
      items: analyzedNodes,
      summary: {
        total: analyzedNodes.length,
        new: nodesNew,
        conflicts: nodesConflicts,
      },
    },
    edges: {
      count: fileEdges.length,
    },
    // Port schemas and schema groups are always imported (required for proper functioning)
    portSchemas: {
      items: file.portSchemas || [],
      count: file.portSchemas?.length || 0,
    },
    schemaGroups: {
      items: file.schemaGroups || [],
      count: file.schemaGroups?.length || 0,
    },
    resources: {
      items: file.resources || [],
      count: file.resources?.length || 0,
    },
    hasConflicts,
    filePageCount: file.pages.length,
  };
}
