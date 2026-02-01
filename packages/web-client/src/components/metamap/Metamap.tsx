import { useState, useCallback, useEffect } from 'react';
import {
  ReactFlowProvider,
  ReactFlow,
  type Node,
  type NodeChange,
  type Connection,
  Controls,
  ControlButton,
  applyNodeChanges,
  useReactFlow,
} from '@xyflow/react';
import SchemaNode from './SchemaNode';
import SchemaGroupNode from './SchemaGroupNode';
import MetamapConnectionModal from './MetamapConnectionModal';
import ConstructEditor from '../ConstructEditor';
import ContextMenu from '../ui/ContextMenu';
import { useDocument } from '../../hooks/useDocument';
import { useMetamapLayout } from '../../hooks/useMetamapLayout';
import type { ConstructSchema } from '@carta/domain';

const nodeTypes = {
  'schema-node': SchemaNode,
  'schema-group': SchemaGroupNode,
};

interface ConnectionModalState {
  sourceSchema: ConstructSchema;
  targetSchema: ConstructSchema;
  sourceHandle?: string;
  targetHandle?: string;
}

function MetamapInner() {
  const { schemas, schemaGroups, getSchema, updateSchema, addSchemaGroup } = useDocument();
  const [connectionModal, setConnectionModal] = useState<ConnectionModalState | null>(null);
  const [editorState, setEditorState] = useState<{ open: boolean; editSchema?: ConstructSchema }>({ open: false });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; schemaType?: string } | null>(null);
  const { nodes: layoutNodes, edges, reLayout } = useMetamapLayout(schemas, schemaGroups);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [dragHoverGroupId, setDragHoverGroupId] = useState<string | null>(null);
  const reactFlow = useReactFlow();

  // Sync layout results into local state, updating group hover state
  useEffect(() => {
    setNodes(layoutNodes.map(node => {
      if (node.type === 'schema-group') {
        const groupId = (node.data as { groupId: string }).groupId;
        return {
          ...node,
          data: { ...node.data, isHovered: groupId === dragHoverGroupId },
        };
      }
      return node;
    }));
  }, [layoutNodes, dragHoverGroupId]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
  }, []);

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Only track drag for schema and group nodes
      if (node.type !== 'schema-node' && node.type !== 'schema-group') return;

      // Compute absolute position
      let absX = node.position.x;
      let absY = node.position.y;
      if (node.parentId) {
        const parent = reactFlow.getNode(node.parentId);
        if (parent) {
          absX += parent.position.x;
          absY += parent.position.y;
        }
      }

      // Check overlap against group container nodes
      const currentNodes = reactFlow.getNodes();
      let hoverGroupId: string | null = null;

      for (const gNode of currentNodes) {
        if (gNode.type !== 'schema-group' || gNode.id === node.id) continue;
        const gx = gNode.position.x;
        const gy = gNode.position.y;
        const gw = gNode.measured?.width ?? (gNode.style?.width as number) ?? 240;
        const gh = gNode.measured?.height ?? (gNode.style?.height as number) ?? 160;

        if (absX >= gx && absX <= gx + gw && absY >= gy && absY <= gy + gh) {
          hoverGroupId = (gNode.data as { groupId: string }).groupId;
          break;
        }
      }

      setDragHoverGroupId(hoverGroupId);
    },
    [reactFlow]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Clear hover state
      setDragHoverGroupId(null);

      // Only handle schema-node and schema-group
      if (node.type !== 'schema-node' && node.type !== 'schema-group') return;

      // Compute absolute position
      let absX = node.position.x;
      let absY = node.position.y;
      if (node.parentId) {
        const parent = reactFlow.getNode(node.parentId);
        if (parent) {
          absX += parent.position.x;
          absY += parent.position.y;
        }
      }

      // Check overlap against group container nodes
      const currentNodes = reactFlow.getNodes();
      let targetGroupId: string | undefined;

      for (const gNode of currentNodes) {
        if (gNode.type !== 'schema-group' || gNode.id === node.id) continue;
        const gx = gNode.position.x;
        const gy = gNode.position.y;
        const gw = gNode.measured?.width ?? (gNode.style?.width as number) ?? 240;
        const gh = gNode.measured?.height ?? (gNode.style?.height as number) ?? 160;

        if (absX >= gx && absX <= gx + gw && absY >= gy && absY <= gy + gh) {
          targetGroupId = (gNode.data as { groupId: string }).groupId;
          break;
        }
      }

      if (node.type === 'schema-node') {
        // Handle schema node drag
        const schema = getSchema(node.id);
        if (!schema) return;

        const currentGroupId = schema.groupId;

        if (targetGroupId && targetGroupId !== currentGroupId) {
          updateSchema(schema.type, { groupId: targetGroupId });
        } else if (!targetGroupId && currentGroupId) {
          updateSchema(schema.type, { groupId: undefined });
        }
      } else if (node.type === 'schema-group') {
        // Handle group drag into another group (nested groups)
        const currentGroup = schemaGroups.find(g => g.id === (node.data as { groupId: string }).groupId);
        if (!currentGroup) return;

        if (targetGroupId && targetGroupId !== currentGroup.parentId) {
          // TODO: Implement updateSchemaGroup in useDocument
          // For now, just log
          console.log('Group drag-to-group not yet implemented:', currentGroup.id, '->', targetGroupId);
        } else if (!targetGroupId && currentGroup.parentId) {
          console.log('Group drag-out not yet implemented:', currentGroup.id);
        }
      }
    },
    [reactFlow, getSchema, updateSchema, schemaGroups]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      const sourceSchema = getSchema(params.source);
      const targetSchema = getSchema(params.target);
      if (sourceSchema && targetSchema) {
        setConnectionModal({
          sourceSchema,
          targetSchema,
          sourceHandle: params.sourceHandle || undefined,
          targetHandle: params.targetHandle || undefined,
        });
      }
    },
    [getSchema]
  );

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    if (node.type === 'schema-node') {
      setContextMenu({ x: event.clientX, y: event.clientY, schemaType: node.id });
    }
  }, []);

  const handleNewSchemaType = useCallback(() => {
    setEditorState({ open: true });
  }, []);

  const handleNewGroup = useCallback(() => {
    const name = prompt('Enter group name:');
    if (name) {
      addSchemaGroup({
        name,
        color: '#6366f1', // Default color
      });
    }
  }, [addSchemaGroup]);

  const handleSave = useCallback(
    (config: {
      sourceSchema: ConstructSchema;
      targetSchema: ConstructSchema;
      fromPortId: string;
      toPortId: string;
      label: string;
      inverse: boolean;
      inverseLabel: string;
    }) => {
      const existingRelated = config.sourceSchema.suggestedRelated || [];
      updateSchema(config.sourceSchema.type, {
        suggestedRelated: [
          ...existingRelated,
          {
            constructType: config.targetSchema.type,
            fromPortId: config.fromPortId,
            toPortId: config.toPortId,
            label: config.label || undefined,
          },
        ],
      });

      if (config.inverse) {
        const targetRelated = config.targetSchema.suggestedRelated || [];
        updateSchema(config.targetSchema.type, {
          suggestedRelated: [
            ...targetRelated,
            {
              constructType: config.sourceSchema.type,
              fromPortId: config.toPortId,
              toPortId: config.fromPortId,
              label: config.inverseLabel || undefined,
            },
          ],
        });
      }

      setConnectionModal(null);
    },
    [updateSchema]
  );

  return (
    <div className="w-full h-full relative">
      <div className="metamap-bg absolute inset-0 pointer-events-none" />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        fitView
        nodesDraggable
        nodesConnectable
        proOptions={{ hideAttribution: true }}
        className="metamap-canvas"
      >
        <Controls>
          <ControlButton onClick={reLayout} title="Re-layout">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </ControlButton>
        </Controls>
      </ReactFlow>
      {connectionModal && (
        <MetamapConnectionModal
          sourceSchema={connectionModal.sourceSchema}
          targetSchema={connectionModal.targetSchema}
          initialSourceHandle={connectionModal.sourceHandle}
          initialTargetHandle={connectionModal.targetHandle}
          onSave={handleSave}
          onCancel={() => setConnectionModal(null)}
        />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.schemaType ? 'node' : 'pane'}
          selectedCount={contextMenu.schemaType ? 1 : 0}
          constructType={contextMenu.schemaType}
          constructOptions={schemas.map(s => ({ constructType: s.type, displayName: s.displayName, color: s.color, groupId: s.groupId }))}
          schemaGroups={schemaGroups}
          onClose={() => setContextMenu(null)}
          onNewConstructSchema={handleNewSchemaType}
          onNewGroup={handleNewGroup}
          onEditSchema={(schemaType) => {
            const schema = getSchema(schemaType);
            if (schema) setEditorState({ open: true, editSchema: schema });
          }}
        />
      )}
      {editorState.open && (
        <ConstructEditor
          editSchema={editorState.editSchema}
          onClose={() => setEditorState({ open: false })}
        />
      )}
    </div>
  );
}

export default function Metamap() {
  return (
    <ReactFlowProvider>
      <MetamapInner />
    </ReactFlowProvider>
  );
}
