import type { Node } from '@xyflow/react';
import type { CartaFile } from './cartaFile';
import { builtInConstructSchemas } from '@carta/domain';
import type { ConstructSchema, Deployable, ConstructNodeData, PortSchema, SchemaGroup } from '@carta/domain';

// Set of built-in schema types for quick lookup
const BUILT_IN_TYPES = new Set(builtInConstructSchemas.map(s => s.type));

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
  description?: string;

  schemas: AnalyzedCategory<AnalyzedSchema>;
  nodes: AnalyzedCategory<AnalyzedNode>;
  deployables: AnalyzedCategory<AnalyzedDeployable>;
  edges: { count: number };

  // These are always imported (not selectable) but shown for information
  portSchemas: { items: PortSchema[]; count: number };
  schemaGroups: { items: SchemaGroup[]; count: number };

  hasConflicts: boolean;

  // Levels info for target picker
  fileLevelCount: number;
}

/**
 * Options for what to import - tracks individual items
 */
export interface ImportOptions {
  schemas: Set<string>; // Set of schema types to import
  nodes: Set<string>;   // Set of node IDs to import
  deployables: Set<string>; // Set of deployable IDs to import
  targetLevel: 'replace' | 'new' | string; // 'replace' = full doc replace, 'new' = create new level, or existing level ID
}

/**
 * Default import options - selects all items
 */
export const defaultImportOptions = (analysis: ImportAnalysis): ImportOptions => {
  return {
    schemas: new Set(analysis.schemas.items.map(s => s.item.type)),
    nodes: new Set(analysis.nodes.items.map(n => n.item.id)),
    deployables: new Set(analysis.deployables.items.map(d => d.item.id)),
    targetLevel: 'replace',
  };
};

/**
 * Analyze a CartaFile for import preview
 */
export function analyzeImport(
  file: CartaFile,
  fileName: string,
  currentNodes: Node[] = [],
  currentDeployables: Deployable[] = [],
  currentSchemas: ConstructSchema[] = []
): ImportAnalysis {
  // Flatten all nodes/edges/deployables across levels for analysis
  const fileNodes = file.levels.flatMap(l => l.nodes) as Node[];
  const fileEdges = file.levels.flatMap(l => l.edges);
  const fileDeployables = file.levels.flatMap(l => l.deployables);

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
      item: node as Node<ConstructNodeData>,
      status: existingNode ? 'conflict' : 'new',
      existingItem: existingNode as Node<ConstructNodeData> | undefined,
    };
  });

  const nodesNew = analyzedNodes.filter(n => n.status === 'new').length;
  const nodesConflicts = analyzedNodes.filter(n => n.status === 'conflict').length;

  // Analyze deployables by checking for id conflicts
  const analyzedDeployables: AnalyzedDeployable[] = fileDeployables.map(dep => {
    // Check if a deployable with the same id already exists
    const existingDeployable = currentDeployables.find(d => d.id === dep.id);

    return {
      item: dep,
      status: existingDeployable ? 'conflict' : 'new',
      existingItem: existingDeployable,
    };
  });

  const deployablesNew = analyzedDeployables.filter(d => d.status === 'new').length;
  const deployablesConflicts = analyzedDeployables.filter(d => d.status === 'conflict').length;

  const hasConflicts = schemasConflicts > 0 || nodesConflicts > 0 || deployablesConflicts > 0;

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
    deployables: {
      items: analyzedDeployables,
      summary: {
        total: analyzedDeployables.length,
        new: deployablesNew,
        conflicts: deployablesConflicts,
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
    hasConflicts,
    fileLevelCount: file.levels.length,
  };
}
