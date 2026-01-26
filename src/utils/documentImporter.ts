import type { Node, Edge } from '@xyflow/react';
import type { CartaFile } from './cartaFile';
import type { DocumentAdapter, ConstructNodeData, ConstructSchema } from '../constructs/types';
import { syncWithDocumentStore } from '../constructs/portRegistry';
import { getPortsForSchema, getHandleType } from '../constructs/ports';

export interface ImportConfig {
  schemas: Set<string>;
  nodes: Set<string>;
  deployables: Set<string>;
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
  // Clear existing document state (like Excalidraw)
  adapter.transaction(() => {
    adapter.setNodes([]);
    adapter.setEdges([]);
    adapter.setSchemas([]);
    adapter.setDeployables([]);
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

  // Import selected deployables
  if (config.deployables.size > 0 && data.deployables.length > 0) {
    const deployablesToImport = data.deployables.filter(d => config.deployables.has(d.id));
    if (deployablesToImport.length > 0) {
      adapter.setDeployables(deployablesToImport);
    }
  }

  // Import selected nodes and edges
  if (config.nodes.size > 0 && data.nodes.length > 0) {
    const nodesToImport = data.nodes.filter(n => config.nodes.has(n.id));
    const importedNodeIds = new Set(nodesToImport.map(n => n.id));
    const edgesToImport = data.edges.filter(
      e => importedNodeIds.has(e.source) && importedNodeIds.has(e.target)
    );

    if (nodesToImport.length > 0) {
      // Build ID mapping for new node IDs
      const idMap: Record<string, string> = {};
      const newNodes: Node[] = nodesToImport.map((node) => {
        const newId = crypto.randomUUID();
        idMap[node.id] = newId;
        return {
          ...node,
          id: newId,
          position: {
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
  }
}
