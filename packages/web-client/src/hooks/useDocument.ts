import { useCallback, useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { ConstructSchema, ConstructNodeData, Deployable, PortSchema, SchemaGroup, Level } from '@carta/domain';
import { useNodes } from './useNodes';
import { useEdges } from './useEdges';
import { useSchemas } from './useSchemas';
import { usePortSchemas } from './usePortSchemas';
import { useDeployables } from './useDeployables';
import { useSchemaGroups } from './useSchemaGroups';
import { useLevels } from './useLevels';
import { useDocumentMeta } from './useDocumentMeta';

/**
 * Interface matching useDocumentStore for backward compatibility
 */
export interface UseDocumentResult {
  // State
  nodes: Node[];
  edges: Edge[];
  title: string;
  description: string;
  schemas: ConstructSchema[];
  portSchemas: PortSchema[];
  deployables: Deployable[];

  // State - Levels
  levels: Level[];
  activeLevel: string | undefined;

  // Actions - Graph
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  getNextNodeId: () => string;
  updateNode: (nodeId: string, updates: Partial<ConstructNodeData>) => void;

  // Actions - Levels
  setActiveLevel: (levelId: string) => void;
  createLevel: (name: string, description?: string) => Level;
  deleteLevel: (levelId: string) => boolean;
  updateLevel: (levelId: string, updates: Partial<Omit<Level, 'id' | 'nodes' | 'edges' | 'deployables'>>) => void;
  duplicateLevel: (levelId: string, newName: string) => Level;
  copyNodesToLevel: (nodeIds: string[], targetLevelId: string) => void;

  // Actions - Schemas
  getSchema: (type: string) => ConstructSchema | undefined;
  setSchemas: (schemas: ConstructSchema[]) => void;
  addSchema: (schema: ConstructSchema) => void;
  updateSchema: (type: string, updates: Partial<ConstructSchema>) => void;
  removeSchema: (type: string) => boolean;

  // Actions - Port Schemas
  getPortSchema: (id: string) => PortSchema | undefined;
  getPortSchemas: () => PortSchema[];
  setPortSchemas: (schemas: PortSchema[]) => void;
  addPortSchema: (schema: PortSchema) => void;
  updatePortSchema: (id: string, updates: Partial<PortSchema>) => void;
  removePortSchema: (id: string) => boolean;

  // Actions - Deployables
  getDeployable: (id: string) => Deployable | undefined;
  setDeployables: (deployables: Deployable[]) => void;
  addDeployable: (deployable: Omit<Deployable, 'id'>) => Deployable;
  updateDeployable: (id: string, updates: Partial<Deployable>) => void;
  removeDeployable: (id: string) => boolean;

  // State - Schema Groups
  schemaGroups: SchemaGroup[];

  // Actions - Schema Groups
  getSchemaGroup: (id: string) => SchemaGroup | undefined;
  getSchemaGroups: () => SchemaGroup[];
  setSchemaGroups: (groups: SchemaGroup[]) => void;
  addSchemaGroup: (group: Omit<SchemaGroup, 'id'>) => SchemaGroup;
  updateSchemaGroup: (id: string, updates: Partial<SchemaGroup>) => void;
  removeSchemaGroup: (id: string) => boolean;

  // For import operations
  importNodes: (nodes: Node[], edges: Edge[]) => void;
}

/**
 * @deprecated Use focused hooks instead for better render performance.
 *
 * This facade subscribes to ALL document state, causing re-renders on any change.
 * Migrate to focused hooks that only subscribe to the state you need:
 *
 * - useNodes() — nodes, setNodes, updateNode, getNextNodeId
 * - useEdges() — edges, setEdges
 * - useSchemas() — schemas, getSchema, addSchema, updateSchema, removeSchema
 * - usePortSchemas() — portSchemas, getPortSchema, add/update/remove
 * - useDeployables() — deployables, getDeployable, add/update/remove
 * - useSchemaGroups() — schemaGroups, getSchemaGroup, add/update/remove
 * - useLevels() — levels, activeLevel, setActiveLevel, create/delete/update
 * - useDocumentMeta() — title, description, setTitle, setDescription
 *
 * Example migration:
 * ```ts
 * // Before (re-renders on ANY document change)
 * const { schemas, addDeployable } = useDocument();
 *
 * // After (only re-renders when schemas or deployables change)
 * const { schemas } = useSchemas();
 * const { addDeployable } = useDeployables();
 * ```
 */
export function useDocument(): UseDocumentResult {
  const { adapter } = useDocumentContext();

  // Compose focused hooks
  const { nodes, setNodes, updateNode, getNextNodeId } = useNodes();
  const { edges, setEdges } = useEdges();
  const { schemas, getSchema, setSchemas, addSchema, updateSchema, removeSchema } = useSchemas();
  const {
    portSchemas,
    getPortSchema,
    getPortSchemas,
    setPortSchemas,
    addPortSchema,
    updatePortSchema,
    removePortSchema,
  } = usePortSchemas();
  const {
    deployables,
    getDeployable,
    setDeployables,
    addDeployable,
    updateDeployable,
    removeDeployable,
  } = useDeployables();
  const {
    schemaGroups,
    getSchemaGroup,
    getSchemaGroups,
    setSchemaGroups,
    addSchemaGroup,
    updateSchemaGroup,
    removeSchemaGroup,
  } = useSchemaGroups();
  const {
    levels,
    activeLevel,
    setActiveLevel,
    createLevel,
    deleteLevel,
    updateLevel,
    duplicateLevel,
    copyNodesToLevel,
  } = useLevels();
  const { title, description, setTitle, setDescription } = useDocumentMeta();

  // Import operation (needs adapter directly for transaction)
  const importNodes = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      adapter.transaction(() => {
        adapter.setNodes(newNodes);
        adapter.setEdges(newEdges);
      });
    },
    [adapter]
  );

  return useMemo(
    () => ({
      nodes,
      edges,
      title,
      description,
      schemas,
      portSchemas,
      deployables,
      schemaGroups,
      levels,
      activeLevel,
      setNodes,
      setEdges,
      setTitle,
      setDescription,
      getNextNodeId,
      updateNode,
      setActiveLevel,
      createLevel,
      deleteLevel,
      updateLevel,
      duplicateLevel,
      copyNodesToLevel,
      getSchema,
      setSchemas,
      addSchema,
      updateSchema,
      removeSchema,
      getPortSchema,
      getPortSchemas,
      setPortSchemas,
      addPortSchema,
      updatePortSchema,
      removePortSchema,
      getDeployable,
      setDeployables,
      addDeployable,
      updateDeployable,
      removeDeployable,
      getSchemaGroup,
      getSchemaGroups,
      setSchemaGroups,
      addSchemaGroup,
      updateSchemaGroup,
      removeSchemaGroup,
      importNodes,
    }),
    [
      nodes,
      edges,
      title,
      description,
      schemas,
      portSchemas,
      deployables,
      schemaGroups,
      levels,
      activeLevel,
      setNodes,
      setEdges,
      setTitle,
      setDescription,
      getNextNodeId,
      updateNode,
      setActiveLevel,
      createLevel,
      deleteLevel,
      updateLevel,
      duplicateLevel,
      copyNodesToLevel,
      getSchema,
      setSchemas,
      addSchema,
      updateSchema,
      removeSchema,
      getPortSchema,
      getPortSchemas,
      setPortSchemas,
      addPortSchema,
      updatePortSchema,
      removePortSchema,
      getDeployable,
      setDeployables,
      addDeployable,
      updateDeployable,
      removeDeployable,
      getSchemaGroup,
      getSchemaGroups,
      setSchemaGroups,
      addSchemaGroup,
      updateSchemaGroup,
      removeSchemaGroup,
      importNodes,
    ]
  );
}

export default useDocument;
