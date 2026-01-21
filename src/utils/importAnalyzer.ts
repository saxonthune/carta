import type { Node } from '@xyflow/react';
import type { CartaFile } from './cartaFile';
import type { ConstructSchema, Deployable, ConstructNodeData } from '../constructs/types';
import { registry } from '../constructs/registry';

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
  item: Node<ConstructNodeData>;
  status: ItemStatus;
  existingItem?: Node<ConstructNodeData>;
}

/**
 * Analyzed deployable item
 */
export interface AnalyzedDeployable {
  item: Deployable;
  status: ItemStatus;
  existingItem?: Deployable;
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

  schemas: AnalyzedCategory<AnalyzedSchema>;
  nodes: AnalyzedCategory<AnalyzedNode>;
  deployables: AnalyzedCategory<AnalyzedDeployable>;
  edges: { count: number };

  hasConflicts: boolean;
}

/**
 * Options for what to import
 */
export interface ImportOptions {
  schemas: boolean;
  nodes: boolean;
  deployables: boolean;
}

/**
 * Default import options
 */
export const defaultImportOptions: ImportOptions = {
  schemas: true,
  nodes: false,
  deployables: false,
};

/**
 * Analyze a CartaFile for import preview
 */
export function analyzeImport(file: CartaFile, fileName: string): ImportAnalysis {
  // Analyze schemas
  const analyzedSchemas: AnalyzedSchema[] = file.customSchemas.map(schema => {
    const existing = registry.getSchema(schema.type);
    // Check if it's a user schema (not built-in) with the same type
    const isConflict = existing && !existing.isBuiltIn;
    return {
      item: schema,
      status: isConflict ? 'conflict' : 'new',
      existingItem: isConflict ? existing : undefined,
    };
  });

  const schemasNew = analyzedSchemas.filter(s => s.status === 'new').length;
  const schemasConflicts = analyzedSchemas.filter(s => s.status === 'conflict').length;

  // Analyze nodes (for future use)
  const analyzedNodes: AnalyzedNode[] = file.nodes.map(node => ({
    item: node as Node<ConstructNodeData>,
    status: 'new' as ItemStatus,
  }));

  // Analyze deployables (for future use)
  const analyzedDeployables: AnalyzedDeployable[] = file.deployables.map(dep => ({
    item: dep,
    status: 'new' as ItemStatus,
  }));

  const hasConflicts = schemasConflicts > 0;

  return {
    fileName,
    title: file.title,
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
        new: analyzedNodes.length,
        conflicts: 0,
      },
    },
    deployables: {
      items: analyzedDeployables,
      summary: {
        total: analyzedDeployables.length,
        new: analyzedDeployables.length,
        conflicts: 0,
      },
    },
    edges: {
      count: file.edges.length,
    },
    hasConflicts,
  };
}
