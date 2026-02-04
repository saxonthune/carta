import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { ConstructSchema, ConstructNodeData, Deployable, PortSchema, SchemaGroup, Level } from '@carta/domain';

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
 * Hook providing document state and operations through the Yjs adapter.
 * This is the primary hook for accessing and modifying document state.
 */
export function useDocument(): UseDocumentResult {
  const { adapter } = useDocumentContext();

  // Local state that syncs with adapter
  const [nodes, setNodesState] = useState<Node[]>(() => adapter.getNodes() as Node[]);
  const [edges, setEdgesState] = useState<Edge[]>(() => adapter.getEdges() as Edge[]);
  const [title, setTitleState] = useState<string>(() => adapter.getTitle());
  const [description, setDescriptionState] = useState<string>(() => adapter.getDescription());
  const [schemas, setSchemasState] = useState<ConstructSchema[]>(() => adapter.getSchemas());
  const [portSchemas, setPortSchemasState] = useState<PortSchema[]>(() => adapter.getPortSchemas());
  const [deployables, setDeployablesState] = useState<Deployable[]>(() => adapter.getDeployables());
  const [schemaGroups, setSchemaGroupsState] = useState<SchemaGroup[]>(() => adapter.getSchemaGroups());
  const [levels, setLevelsState] = useState<Level[]>(() => adapter.getLevels());
  const [activeLevel, setActiveLevelState] = useState<string | undefined>(() => adapter.getActiveLevel());

  // Subscribe to adapter changes
  useEffect(() => {
    const unsubscribe = adapter.subscribe(() => {
      setNodesState(adapter.getNodes() as Node[]);
      setEdgesState(adapter.getEdges() as Edge[]);
      setTitleState(adapter.getTitle());
      setDescriptionState(adapter.getDescription());
      setSchemasState(adapter.getSchemas());
      setPortSchemasState(adapter.getPortSchemas());
      setDeployablesState(adapter.getDeployables());
      setSchemaGroupsState(adapter.getSchemaGroups());
      setLevelsState(adapter.getLevels());
      setActiveLevelState(adapter.getActiveLevel());
    });
    return unsubscribe;
  }, [adapter]);

  // Graph actions
  const setNodes = useCallback(
    (nodesOrUpdater: Node[] | ((prev: Node[]) => Node[])) => {
      adapter.setNodes(nodesOrUpdater as unknown[] | ((prev: unknown[]) => unknown[]));
    },
    [adapter]
  );

  const setEdges = useCallback(
    (edgesOrUpdater: Edge[] | ((prev: Edge[]) => Edge[])) => {
      adapter.setEdges(edgesOrUpdater as unknown[] | ((prev: unknown[]) => unknown[]));
    },
    [adapter]
  );

  const setTitle = useCallback(
    (newTitle: string) => {
      adapter.setTitle(newTitle);
    },
    [adapter]
  );

  const setDescription = useCallback(
    (newDescription: string) => {
      adapter.setDescription(newDescription);
    },
    [adapter]
  );

  const getNextNodeId = useCallback(() => {
    return adapter.generateNodeId();
  }, [adapter]);

  const updateNode = useCallback(
    (nodeId: string, updates: Partial<ConstructNodeData>) => {
      adapter.updateNode(nodeId, updates);
    },
    [adapter]
  );

  // Level actions
  const setActiveLevel = useCallback(
    (levelId: string) => {
      adapter.setActiveLevel(levelId);
    },
    [adapter]
  );

  const createLevel = useCallback(
    (name: string, description?: string) => adapter.createLevel(name, description),
    [adapter]
  );

  const deleteLevel = useCallback(
    (levelId: string) => adapter.deleteLevel(levelId),
    [adapter]
  );

  const updateLevel = useCallback(
    (levelId: string, updates: Partial<Omit<Level, 'id' | 'nodes' | 'edges' | 'deployables'>>) => {
      adapter.updateLevel(levelId, updates);
    },
    [adapter]
  );

  const duplicateLevel = useCallback(
    (levelId: string, newName: string) => adapter.duplicateLevel(levelId, newName),
    [adapter]
  );

  const copyNodesToLevel = useCallback(
    (nodeIds: string[], targetLevelId: string) => {
      adapter.copyNodesToLevel(nodeIds, targetLevelId);
    },
    [adapter]
  );

  // Schema actions
  const getSchema = useCallback(
    (type: string) => adapter.getSchema(type),
    [adapter]
  );

  const setSchemas = useCallback(
    (newSchemas: ConstructSchema[]) => {
      adapter.setSchemas(newSchemas);
    },
    [adapter]
  );

  const addSchema = useCallback(
    (schema: ConstructSchema) => {
      adapter.addSchema(schema);
    },
    [adapter]
  );

  const updateSchema = useCallback(
    (type: string, updates: Partial<ConstructSchema>) => {
      adapter.updateSchema(type, updates);
    },
    [adapter]
  );

  const removeSchema = useCallback(
    (type: string) => adapter.removeSchema(type),
    [adapter]
  );

  // Port Schema actions
  const getPortSchema = useCallback(
    (id: string) => adapter.getPortSchema(id),
    [adapter]
  );

  const getPortSchemas = useCallback(() => adapter.getPortSchemas(), [adapter]);

  const setPortSchemas = useCallback(
    (newSchemas: PortSchema[]) => {
      adapter.setPortSchemas(newSchemas);
    },
    [adapter]
  );

  const addPortSchema = useCallback(
    (schema: PortSchema) => {
      adapter.addPortSchema(schema);
    },
    [adapter]
  );

  const updatePortSchema = useCallback(
    (id: string, updates: Partial<PortSchema>) => {
      adapter.updatePortSchema(id, updates);
    },
    [adapter]
  );

  const removePortSchema = useCallback(
    (id: string) => adapter.removePortSchema(id),
    [adapter]
  );

  // Deployable actions
  const getDeployable = useCallback(
    (id: string) => adapter.getDeployable(id),
    [adapter]
  );

  const setDeployables = useCallback(
    (newDeployables: Deployable[]) => {
      adapter.setDeployables(newDeployables);
    },
    [adapter]
  );

  const addDeployable = useCallback(
    (deployable: Omit<Deployable, 'id'>) => adapter.addDeployable(deployable),
    [adapter]
  );

  const updateDeployable = useCallback(
    (id: string, updates: Partial<Deployable>) => {
      adapter.updateDeployable(id, updates);
    },
    [adapter]
  );

  const removeDeployable = useCallback(
    (id: string) => adapter.removeDeployable(id),
    [adapter]
  );

  // Schema Group actions
  const getSchemaGroup = useCallback(
    (id: string) => adapter.getSchemaGroup(id),
    [adapter]
  );

  const getSchemaGroups = useCallback(() => adapter.getSchemaGroups(), [adapter]);

  const setSchemaGroups = useCallback(
    (groups: SchemaGroup[]) => {
      adapter.setSchemaGroups(groups);
    },
    [adapter]
  );

  const addSchemaGroup = useCallback(
    (group: Omit<SchemaGroup, 'id'>) => adapter.addSchemaGroup(group),
    [adapter]
  );

  const updateSchemaGroup = useCallback(
    (id: string, updates: Partial<SchemaGroup>) => {
      adapter.updateSchemaGroup(id, updates);
    },
    [adapter]
  );

  const removeSchemaGroup = useCallback(
    (id: string) => adapter.removeSchemaGroup(id),
    [adapter]
  );

  // Import operation
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
