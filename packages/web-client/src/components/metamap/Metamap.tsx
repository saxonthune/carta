import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlowProvider,
  ReactFlow,
  type Node,
  type Edge,
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
import EdgeDetailPopover from './EdgeDetailPopover';
import ConstructEditor from '../ConstructEditor';
import ContextMenu from '../ui/ContextMenu';
import { useSchemas } from '../../hooks/useSchemas';
import { useSchemaGroups } from '../../hooks/useSchemaGroups';
import { useMetamapLayout } from '../../hooks/useMetamapLayout';
import { ZoomDebug } from '../ui/ZoomDebug';
import type { ConstructSchema, SuggestedRelatedConstruct } from '@carta/domain';

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

interface MetamapInnerProps {
  filterText: string;
}

function MetamapInner({ filterText }: MetamapInnerProps) {
  const { schemas, getSchema, updateSchema } = useSchemas();
  const { schemaGroups, updateSchemaGroup, addSchemaGroup } = useSchemaGroups();
  const [connectionModal, setConnectionModal] = useState<ConnectionModalState | null>(null);
  const [editorState, setEditorState] = useState<{ open: boolean; editSchema?: ConstructSchema }>({ open: false });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; schemaType?: string } | null>(null);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [edgePopover, setEdgePopover] = useState<{
    sourceSchema: ConstructSchema;
    targetSchema: ConstructSchema;
    relationship: SuggestedRelatedConstruct;
    relationshipIndex: number;
    position: { x: number; y: number };
  } | null>(null);
  const { nodes: layoutNodes, edges, reLayout: triggerReLayout } = useMetamapLayout(schemas, schemaGroups, expandedSchemas, expandedGroups);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [dragHoverGroupId, setDragHoverGroupId] = useState<string | null>(null);
  const reactFlow = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute matching schemas for filter (memoized to prevent infinite loops)
  const matchingSchemaTypes = useMemo(() => {
    if (!filterText.trim()) return null;
    const q = filterText.toLowerCase();
    return new Set(
      schemas
        .filter(s => s.displayName.toLowerCase().includes(q) || s.type.toLowerCase().includes(q))
        .map(s => s.type)
    );
  }, [filterText, schemas]);

  // Compute which groups contain matching schemas (for auto-expand and dimming)
  const groupsWithMatches = useMemo(() => {
    const result = new Set<string>();
    if (!matchingSchemaTypes) return result;

    for (const s of schemas) {
      if (matchingSchemaTypes.has(s.type) && s.groupId) {
        // Walk up the group tree and mark all ancestors
        let gid: string | undefined = s.groupId;
        while (gid) {
          result.add(gid);
          const group = schemaGroups.find(g => g.id === gid);
          gid = group?.parentId;
        }
      }
    }
    return result;
  }, [matchingSchemaTypes, schemas, schemaGroups]);

  // Compute dimmed sets (memoized to prevent infinite loops)
  const dimmedSchemaTypes = useMemo(() => {
    if (!matchingSchemaTypes) return new Set<string>();
    return new Set(schemas.filter(s => !matchingSchemaTypes.has(s.type)).map(s => s.type));
  }, [matchingSchemaTypes, schemas]);

  const dimmedGroupIds = useMemo(() => {
    if (!matchingSchemaTypes) return new Set<string>();
    return new Set(schemaGroups.filter(g => !groupsWithMatches.has(g.id)).map(g => g.id));
  }, [matchingSchemaTypes, schemaGroups, groupsWithMatches]);

  // Auto-expand groups that contain matching schemas when filter is active
  const prevFilterRef = useRef<string>('');
  useEffect(() => {
    if (filterText.trim() && filterText !== prevFilterRef.current && groupsWithMatches.size > 0) {
      setExpandedGroups(prev => {
        const next = new Set(prev);
        for (const gid of groupsWithMatches) {
          next.add(gid);
        }
        return next;
      });
    }
    prevFilterRef.current = filterText;
  }, [filterText, groupsWithMatches]);

  // Sync layout results into local state, updating group hover state + dimming
  useEffect(() => {
    setNodes(layoutNodes.map(node => {
      if (node.type === 'schema-group') {
        const groupId = (node.data as { groupId: string }).groupId;
        return {
          ...node,
          data: {
            ...node.data,
            isHovered: groupId === dragHoverGroupId,
            isDimmed: dimmedGroupIds.has(groupId),
          },
        };
      }
      if (node.type === 'schema-node') {
        return {
          ...node,
          data: {
            ...node.data,
            isDimmed: dimmedSchemaTypes.has(node.id),
          },
        };
      }
      return node;
    }));
  }, [layoutNodes, dragHoverGroupId, dimmedSchemaTypes, dimmedGroupIds]);

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

        if (targetGroupId && targetGroupId !== currentGroup.parentId && targetGroupId !== currentGroup.id) {
          updateSchemaGroup(currentGroup.id, { parentId: targetGroupId });
        } else if (!targetGroupId && currentGroup.parentId) {
          updateSchemaGroup(currentGroup.id, { parentId: undefined });
        }
      }
    },
    [reactFlow, getSchema, updateSchema, updateSchemaGroup, schemaGroups]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Click on collapsed group → expand it
    if (node.type === 'schema-group') {
      const groupId = (node.data as { groupId: string }).groupId;
      const isGroupExpanded = expandedGroups.has(groupId);
      if (!isGroupExpanded) {
        setExpandedGroups(prev => {
          const next = new Set(prev);
          next.add(groupId);
          return next;
        });
        // Fit view after a tick so layout recalculates
        setTimeout(() => reactFlow.fitView({ duration: 300 }), 50);
      }
    }
  }, [expandedGroups, reactFlow]);

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'schema-node') {
      setExpandedSchemas(prev => {
        const next = new Set(prev);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        return next;
      });
    } else if (node.type === 'schema-group') {
      // Double-click on expanded group → collapse it
      const groupId = (node.data as { groupId: string }).groupId;
      if (expandedGroups.has(groupId)) {
        setExpandedGroups(prev => {
          const next = new Set(prev);
          next.delete(groupId);
          return next;
        });
        setTimeout(() => reactFlow.fitView({ duration: 300 }), 50);
      }
    }
  }, [expandedGroups, reactFlow]);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    const data = edge.data as { sourceType: string; targetType: string; relIndex: number } | undefined;
    if (!data) return;

    const sourceSchema = getSchema(data.sourceType);
    const targetSchema = getSchema(data.targetType);
    if (!sourceSchema || !targetSchema) return;

    const relationship = sourceSchema.suggestedRelated?.[data.relIndex];
    if (!relationship) return;

    setEdgePopover({
      sourceSchema,
      targetSchema,
      relationship,
      relationshipIndex: data.relIndex,
      position: { x: event.clientX, y: event.clientY },
    });
  }, [getSchema]);

  const handleEdgeUpdate = useCallback((relIndex: number, updates: Partial<SuggestedRelatedConstruct>) => {
    if (!edgePopover) return;
    const schema = edgePopover.sourceSchema;
    const related = [...(schema.suggestedRelated || [])];
    related[relIndex] = { ...related[relIndex], ...updates };
    updateSchema(schema.type, { suggestedRelated: related });
    setEdgePopover(null);
  }, [edgePopover, updateSchema]);

  const handleEdgeDelete = useCallback((relIndex: number) => {
    if (!edgePopover) return;
    const schema = edgePopover.sourceSchema;
    const related = [...(schema.suggestedRelated || [])];
    related.splice(relIndex, 1);
    updateSchema(schema.type, { suggestedRelated: related });
    setEdgePopover(null);
  }, [edgePopover, updateSchema]);

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

  const reLayout = useCallback(() => {
    // Reset expanded groups on re-layout
    setExpandedGroups(new Set());
    triggerReLayout();
  }, [triggerReLayout]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <div className="metamap-bg absolute inset-0 pointer-events-none" />
      <ZoomDebug position="top-left" />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
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
      {edgePopover && (
        <EdgeDetailPopover
          sourceSchema={edgePopover.sourceSchema}
          targetSchema={edgePopover.targetSchema}
          relationship={edgePopover.relationship}
          relationshipIndex={edgePopover.relationshipIndex}
          position={edgePopover.position}
          onUpdate={handleEdgeUpdate}
          onDelete={handleEdgeDelete}
          onClose={() => setEdgePopover(null)}
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

interface MetamapProps {
  filterText: string;
  onFilterTextChange: (text: string) => void;
}

export default function Metamap({ filterText }: MetamapProps) {
  return (
    <ReactFlowProvider>
      <MetamapInner filterText={filterText} />
    </ReactFlowProvider>
  );
}
