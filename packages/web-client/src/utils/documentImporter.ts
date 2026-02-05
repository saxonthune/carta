import type { Node, Edge } from '@xyflow/react';
import type { CartaFile } from './cartaFile';
import { syncWithDocumentStore, getPortsForSchema, getHandleType } from '@carta/domain';
import type { DocumentAdapter, ConstructNodeData, ConstructSchema } from '@carta/domain';

export interface ImportConfig {
  schemas: Set<string>;
  nodes: Set<string>;
  targetLevel: 'replace' | 'new' | string;
}

/**
 * Pure function to import a CartaFile into a DocumentAdapter.
 * No React hooks - just direct adapter manipulation.
 */
export function importDocument(
  adapter: DocumentAdapter,
  data: CartaFile,
  config: ImportConfig,
  schemasToImport: ConstructSchema[]
): void {
  if (config.targetLevel === 'replace') {
    importReplaceDocument(adapter, data, config, schemasToImport);
  } else {
    importIntoLevel(adapter, data, config, schemasToImport);
  }
}

/**
 * Full document replacement (original behavior)
 */
function importReplaceDocument(
  adapter: DocumentAdapter,
  data: CartaFile,
  config: ImportConfig,
  schemasToImport: ConstructSchema[]
): void {
  // Clear existing document state (like Excalidraw)
  // Clear all levels' data first
  adapter.transaction(() => {
    const existingLevels = adapter.getLevels();
    for (const level of existingLevels) {
      adapter.setActiveLevel(level.id);
      adapter.setNodes([]);
      adapter.setEdges([]);
    }
    // Delete all levels except first, then reset first
    if (existingLevels.length > 1) {
      for (let i = 1; i < existingLevels.length; i++) {
        adapter.deleteLevel(existingLevels[i].id);
      }
    }
    adapter.setSchemas([]);
    adapter.setPortSchemas([]);
    adapter.setSchemaGroups([]);
  });

  // Set title and description
  if (data.title) {
    adapter.setTitle(data.title);
  }
  if (data.description) {
    adapter.setDescription(data.description);
  }

  mergeSchemas(adapter, data, schemasToImport);
  importWithLevels(adapter, data, config, schemasToImport);
}

/**
 * Import file content into a specific level (existing or new), preserving existing content
 */
function importIntoLevel(
  adapter: DocumentAdapter,
  data: CartaFile,
  config: ImportConfig,
  schemasToImport: ConstructSchema[]
): void {
  // Merge schemas/port schemas/schema groups additively
  mergeSchemas(adapter, data, schemasToImport);

  // Determine target level ID
  let targetLevelId: string;
  if (config.targetLevel === 'new') {
    const newLevel = adapter.createLevel(`Imported: ${data.title || 'Untitled'}`);
    targetLevelId = newLevel.id;
  } else {
    targetLevelId = config.targetLevel;
  }

  // Switch to target level
  adapter.setActiveLevel(targetLevelId);

  // Flatten all file levels' nodes and edges
  const allNodes = data.levels.flatMap(l => l.nodes) as Node[];
  const allEdges = data.levels.flatMap(l => l.edges) as Edge[];

  // Import nodes and edges additively (importNodesAndEdges creates new IDs, so no conflicts)
  importNodesAndEdgesAdditive(adapter, allNodes, allEdges, config, schemasToImport);
}

/**
 * Merge schemas, port schemas, and schema groups from file into existing document
 */
function mergeSchemas(
  adapter: DocumentAdapter,
  data: CartaFile,
  schemasToImport: ConstructSchema[]
): void {
  // Import port schemas first (needed for edge validation)
  if (data.portSchemas && data.portSchemas.length > 0) {
    adapter.setPortSchemas(data.portSchemas);
    syncWithDocumentStore(data.portSchemas);
  }

  // Import schema groups
  if (data.schemaGroups && data.schemaGroups.length > 0) {
    adapter.setSchemaGroups(data.schemaGroups);
  }

  // Import selected schemas
  if (schemasToImport.length > 0) {
    adapter.setSchemas(schemasToImport);
  }
}

function importWithLevels(
  adapter: DocumentAdapter,
  data: CartaFile,
  config: ImportConfig,
  schemasToImport: ConstructSchema[]
): void {
  const existingLevels = adapter.getLevels();
  const firstLevelId = existingLevels[0]?.id;

  for (let i = 0; i < data.levels.length; i++) {
    const fileLevel = data.levels[i];
    let levelId: string;

    if (i === 0 && firstLevelId) {
      // Use existing first level for first imported level
      levelId = firstLevelId;
      adapter.updateLevel(levelId, { name: fileLevel.name, description: fileLevel.description, order: fileLevel.order });
    } else {
      // Create new level for subsequent ones
      const newLevel = adapter.createLevel(fileLevel.name, fileLevel.description);
      levelId = newLevel.id;
      adapter.updateLevel(levelId, { order: fileLevel.order });
    }

    // Switch to this level and import its data
    adapter.setActiveLevel(levelId);

    // Import nodes and edges for this level
    importNodesAndEdges(adapter, fileLevel.nodes as Node[], fileLevel.edges as Edge[], config, schemasToImport);
  }

  // Switch back to first level
  if (firstLevelId) {
    adapter.setActiveLevel(firstLevelId);
  }
}

/**
 * Import nodes and edges into the active level
 */
function importNodesAndEdges(
  adapter: DocumentAdapter,
  nodes: Node[],
  edges: Edge[],
  config: ImportConfig,
  schemasToImport: ConstructSchema[]
): void {
  if (config.nodes.size === 0 || nodes.length === 0) return;

  const nodesToImport = nodes.filter(n => config.nodes.has(n.id));
  const importedNodeIds = new Set(nodesToImport.map(n => n.id));
  const edgesToImport = edges.filter(
    e => importedNodeIds.has(e.source) && importedNodeIds.has(e.target)
  );

  if (nodesToImport.length === 0) return;

  // Sort so parent nodes (visual groups) come before children for idMap lookups
  const sorted = [...nodesToImport].sort((a, b) => {
    const aIsParent = !a.parentId ? 0 : 1;
    const bIsParent = !b.parentId ? 0 : 1;
    return aIsParent - bIsParent;
  });

  // Build ID mapping for new node IDs
  const idMap: Record<string, string> = {};
  const newNodes: Node[] = sorted.map((node) => {
    const newId = crypto.randomUUID();
    idMap[node.id] = newId;
    const isChild = !!node.parentId;
    return {
      ...node,
      id: newId,
      parentId: node.parentId ? (idMap[node.parentId] || node.parentId) : undefined,
      position: isChild ? node.position : {
        x: (node.position?.x || 0) + 50,
        y: (node.position?.y || 0) + 50,
      },
    };
  });

  // Build lookups for edge normalization
  const nodesByOldId = new Map(nodesToImport.map(n => [n.id, n]));
  const schemaLookup = new Map(schemasToImport.map(s => [s.type, s]));

  // Remap edges and normalize direction
  const newEdges: Edge[] = edgesToImport.map((edge) => {
    let normalizedEdge: Edge = {
      ...edge,
      id: `edge-${Math.random()}`,
      source: idMap[edge.source] || edge.source,
      target: idMap[edge.target] || edge.target,
    };

    // Normalize direction for construct nodes
    const sourceNode = nodesByOldId.get(edge.source);
    const targetNode = nodesByOldId.get(edge.target);

    if (sourceNode?.type === 'construct' && targetNode?.type === 'construct' &&
        edge.sourceHandle && edge.targetHandle) {
      const sourceData = sourceNode.data as ConstructNodeData;
      const targetData = targetNode.data as ConstructNodeData;
      const sourceSchema = schemaLookup.get(sourceData.constructType);
      const targetSchema = schemaLookup.get(targetData.constructType);

      if (sourceSchema && targetSchema) {
        const sourcePorts = getPortsForSchema(sourceSchema.ports);
        const targetPorts = getPortsForSchema(targetSchema.ports);
        const sourcePort = sourcePorts.find(p => p.id === edge.sourceHandle);
        const targetPort = targetPorts.find(p => p.id === edge.targetHandle);

        if (sourcePort && targetPort) {
          const sourceHandleType = getHandleType(sourcePort.portType);
          const targetHandleType = getHandleType(targetPort.portType);
          const needsFlip = sourceHandleType === 'target' && targetHandleType === 'source';

          if (needsFlip) {
            normalizedEdge = {
              ...edge,
              id: `edge-${Math.random()}`,
              source: idMap[edge.target] || edge.target,
              sourceHandle: edge.targetHandle,
              target: idMap[edge.source] || edge.source,
              targetHandle: edge.sourceHandle,
            };
          }
        }
      }
    }

    return normalizedEdge;
  });

  adapter.setNodes(newNodes);
  adapter.setEdges(newEdges);
}

/**
 * Import nodes and edges additively into the active level (preserves existing content)
 */
function importNodesAndEdgesAdditive(
  adapter: DocumentAdapter,
  nodes: Node[],
  edges: Edge[],
  config: ImportConfig,
  schemasToImport: ConstructSchema[]
): void {
  if (config.nodes.size === 0 || nodes.length === 0) return;

  const nodesToImport = nodes.filter(n => config.nodes.has(n.id));
  const importedNodeIds = new Set(nodesToImport.map(n => n.id));
  const edgesToImport = edges.filter(
    e => importedNodeIds.has(e.source) && importedNodeIds.has(e.target)
  );

  if (nodesToImport.length === 0) return;

  // Sort so parent nodes come before children for idMap lookups
  const sorted = [...nodesToImport].sort((a, b) => {
    const aIsParent = !a.parentId ? 0 : 1;
    const bIsParent = !b.parentId ? 0 : 1;
    return aIsParent - bIsParent;
  });

  // Build ID mapping for new node IDs
  const idMap: Record<string, string> = {};
  const newNodes: Node[] = sorted.map((node) => {
    const newId = crypto.randomUUID();
    idMap[node.id] = newId;
    const isChild = !!node.parentId;
    return {
      ...node,
      id: newId,
      parentId: node.parentId ? (idMap[node.parentId] || node.parentId) : undefined,
      position: isChild ? node.position : {
        x: (node.position?.x || 0) + 50,
        y: (node.position?.y || 0) + 50,
      },
    };
  });

  // Build lookups for edge normalization
  const nodesByOldId = new Map(nodesToImport.map(n => [n.id, n]));
  const schemaLookup = new Map(schemasToImport.map(s => [s.type, s]));

  // Remap edges and normalize direction
  const newEdges: Edge[] = edgesToImport.map((edge) => {
    let normalizedEdge: Edge = {
      ...edge,
      id: `edge-${Math.random()}`,
      source: idMap[edge.source] || edge.source,
      target: idMap[edge.target] || edge.target,
    };

    const sourceNode = nodesByOldId.get(edge.source);
    const targetNode = nodesByOldId.get(edge.target);

    if (sourceNode?.type === 'construct' && targetNode?.type === 'construct' &&
        edge.sourceHandle && edge.targetHandle) {
      const sourceData = sourceNode.data as ConstructNodeData;
      const targetData = targetNode.data as ConstructNodeData;
      const sourceSchema = schemaLookup.get(sourceData.constructType);
      const targetSchema = schemaLookup.get(targetData.constructType);

      if (sourceSchema && targetSchema) {
        const sourcePorts = getPortsForSchema(sourceSchema.ports);
        const targetPorts = getPortsForSchema(targetSchema.ports);
        const sourcePort = sourcePorts.find(p => p.id === edge.sourceHandle);
        const targetPort = targetPorts.find(p => p.id === edge.targetHandle);

        if (sourcePort && targetPort) {
          const sourceHandleType = getHandleType(sourcePort.portType);
          const targetHandleType = getHandleType(targetPort.portType);
          const needsFlip = sourceHandleType === 'target' && targetHandleType === 'source';

          if (needsFlip) {
            normalizedEdge = {
              ...edge,
              id: `edge-${Math.random()}`,
              source: idMap[edge.target] || edge.target,
              sourceHandle: edge.targetHandle,
              target: idMap[edge.source] || edge.source,
              targetHandle: edge.sourceHandle,
            };
          }
        }
      }
    }

    return normalizedEdge;
  });

  // Additive: merge with existing nodes and edges
  const existingNodes = adapter.getNodes() as Node[];
  const existingEdges = adapter.getEdges() as Edge[];
  adapter.setNodes([...existingNodes, ...newNodes]);
  adapter.setEdges([...existingEdges, ...newEdges]);
}
