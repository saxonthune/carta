import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlowProvider,
  ReactFlow,
  Background,
  BackgroundVariant,
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
import OrganizerNode from '../canvas/OrganizerNode';
import type { OrganizerNodeData } from '../canvas/OrganizerNode';
import DynamicAnchorEdge from '../canvas/DynamicAnchorEdge';
import Narrative from '../canvas/Narrative';
import MetamapConnectionModal from './MetamapConnectionModal';
import EdgeDetailPopover from './EdgeDetailPopover';
import ConstructEditor from '../ConstructEditor';
import ContextMenuPrimitive, { type MenuItem } from '../ui/ContextMenuPrimitive';
import { useSchemas } from '../../hooks/useSchemas';
import { useSchemaGroups } from '../../hooks/useSchemaGroups';
import { useMetamapLayout } from '../../hooks/useMetamapLayout';
import { usePresentation } from '../../hooks/usePresentation';
import { useEdgeBundling } from '../../hooks/useEdgeBundling';
import { useNarrative } from '../../hooks/useNarrative';
import { useSchemaUndoRedo } from '../../hooks/useSchemaUndoRedo';
import { ZoomDebug } from '../ui/ZoomDebug';
import type { MetamapLayoutDirection } from '../../utils/metamapLayout';
import type { ConstructSchema, SuggestedRelatedConstruct } from '@carta/domain';
import { portRegistry, nodeContainedInOrganizer } from '@carta/domain';

const nodeTypes = {
  'schema-node': SchemaNode,
  'organizer': OrganizerNode,
};

const edgeTypes = {
  bundled: DynamicAnchorEdge,
};

const defaultEdgeOptions = {
  type: 'bundled' as const,
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
  const { schemas, getSchema, updateSchema, removeSchema } = useSchemas();
  const { schemaGroups, updateSchemaGroup, addSchemaGroup, removeSchemaGroup } = useSchemaGroups();
  const [connectionModal, setConnectionModal] = useState<ConnectionModalState | null>(null);
  const [editorState, setEditorState] = useState<{ open: boolean; editSchema?: ConstructSchema }>({ open: false });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; schemaType?: string; groupId?: string } | null>(null);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [layoutDirection, setLayoutDirection] = useState<MetamapLayoutDirection>('TB');
  const [edgePopover, setEdgePopover] = useState<{
    sourceSchema: ConstructSchema;
    targetSchema: ConstructSchema;
    relationship: SuggestedRelatedConstruct;
    relationshipIndex: number;
    position: { x: number; y: number };
  } | null>(null);
  const { nodes: layoutNodes, edges: layoutEdges, reLayout: triggerReLayout } = useMetamapLayout(schemas, schemaGroups, expandedSchemas, expandedGroups, layoutDirection);

  // Pipe through presentation layer for collapse hiding and edge remapping
  const { processedNodes, edgeRemap } = usePresentation(layoutNodes, layoutEdges);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [dragHoverGroupId, setDragHoverGroupId] = useState<string | null>(null);
  const reactFlow = useReactFlow();
  const { getViewport, setViewport } = reactFlow;
  const containerRef = useRef<HTMLDivElement>(null);

  // Narrative tooltip for edge hover
  const { narrative, showNarrative, hideNarrative } = useNarrative();

  // Undo/redo for schema changes
  const { undo, redo, canUndo, canRedo } = useSchemaUndoRedo();

  // Custom zoom with smaller step (1.15x instead of default 1.2x)
  const customZoomIn = useCallback(() => {
    const { x, y, zoom } = getViewport();
    setViewport({ x, y, zoom: Math.min(zoom * 1.15, 2) }, { duration: 200 });
  }, [getViewport, setViewport]);

  const customZoomOut = useCallback(() => {
    const { x, y, zoom } = getViewport();
    setViewport({ x, y, zoom: Math.max(zoom / 1.15, 0.15) }, { duration: 200 });
  }, [getViewport, setViewport]);

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

  // Sync presentation-processed nodes into local state, updating hover/dimming
  useEffect(() => {
    setNodes(processedNodes.map(node => {
      if (node.type === 'organizer') {
        const groupId = (node.data as OrganizerNodeData).groupId;
        return {
          ...node,
          data: {
            ...node.data,
            isHovered: groupId === dragHoverGroupId,
            isDimmed: groupId ? dimmedGroupIds.has(groupId) : false,
          },
        };
      }
      if (node.type === 'schema-node') {
        return {
          ...node,
          data: {
            ...node.data,
            isDimmed: dimmedSchemaTypes.has(node.id),
            isHighlighted: matchingSchemaTypes ? matchingSchemaTypes.has(node.id) : false,
          },
        };
      }
      return node;
    }) as Node[]);
  }, [processedNodes, dragHoverGroupId, dimmedSchemaTypes, dimmedGroupIds, matchingSchemaTypes]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
  }, []);

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Only track drag for schema and organizer nodes
      if (node.type !== 'schema-node' && node.type !== 'organizer') return;

      const intersecting = reactFlow.getIntersectingNodes(node);
      const hoverOrganizer = intersecting.find(n => n.type === 'organizer' && n.id !== node.id);
      const hoverGroupId = hoverOrganizer
        ? (hoverOrganizer.data as OrganizerNodeData).groupId ?? null
        : null;

      setDragHoverGroupId(hoverGroupId);
    },
    [reactFlow]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Clear hover state
      setDragHoverGroupId(null);

      // Only handle schema-node and organizer
      if (node.type !== 'schema-node' && node.type !== 'organizer') return;

      const intersecting = reactFlow.getIntersectingNodes(node);
      const targetOrganizer = intersecting.find(n => n.type === 'organizer' && n.id !== node.id);
      const targetGroupId = targetOrganizer
        ? (targetOrganizer.data as OrganizerNodeData).groupId
        : undefined;

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
      } else if (node.type === 'organizer') {
        // Handle group drag into another group (nested groups)
        const currentGroup = schemaGroups.find(g => g.id === (node.data as OrganizerNodeData).groupId);
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
    if (node.type === 'organizer') {
      const groupId = (node.data as OrganizerNodeData).groupId;
      if (groupId && !expandedGroups.has(groupId)) {
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
    } else if (node.type === 'organizer') {
      // Double-click on expanded group → collapse it
      const groupId = (node.data as OrganizerNodeData).groupId;
      if (groupId && expandedGroups.has(groupId)) {
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
    const data = edge.data as { sourceType: string; targetType: string; relIndex: number; fromPortId?: string; toPortId?: string } | undefined;
    if (!data) return;

    const sourceSchema = getSchema(data.sourceType);
    const targetSchema = getSchema(data.targetType);
    if (!sourceSchema || !targetSchema) return;

    // Show narrative tooltip on primary click
    const fromPort = sourceSchema.ports?.find(p => p.id === data.fromPortId);
    const toPort = targetSchema.ports?.find(p => p.id === data.toPortId);
    const fromPortSchema = fromPort ? portRegistry.get(fromPort.portType) : undefined;
    const toPortSchema = toPort ? portRegistry.get(toPort.portType) : undefined;

    showNarrative({
      kind: 'edge',
      from: {
        name: sourceSchema.displayName,
        schemaType: sourceSchema.type,
        portLabel: fromPort?.label || 'default',
        portColor: fromPortSchema?.color || '#6b7280',
      },
      to: {
        name: targetSchema.displayName,
        schemaType: targetSchema.type,
        portLabel: toPort?.label || 'default',
        portColor: toPortSchema?.color || '#6b7280',
      },
      position: { x: event.clientX, y: event.clientY },
      anchor: 'above',
    });
  }, [getSchema, showNarrative]);

  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    const data = edge.data as { sourceType: string; targetType: string; relIndex: number } | undefined;
    if (!data) return;

    const sourceSchema = getSchema(data.sourceType);
    const targetSchema = getSchema(data.targetType);
    if (!sourceSchema || !targetSchema) return;

    const relationship = sourceSchema.suggestedRelated?.[data.relIndex];
    if (!relationship) return;

    hideNarrative();
    setEdgePopover({
      sourceSchema,
      targetSchema,
      relationship,
      relationshipIndex: data.relIndex,
      position: { x: event.clientX, y: event.clientY },
    });
  }, [getSchema, hideNarrative]);

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
    } else if (node.type === 'organizer') {
      const groupId = (node.data as OrganizerNodeData).groupId;
      if (groupId) {
        setContextMenu({ x: event.clientX, y: event.clientY, groupId });
      }
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

  const handleDeleteSchema = useCallback((schemaType: string) => {
    removeSchema(schemaType);
    setContextMenu(null);
  }, [removeSchema]);

  const handleDeleteGroup = useCallback((groupId: string) => {
    // Ungroup all schemas in this group first
    for (const s of schemas) {
      if (s.groupId === groupId) {
        updateSchema(s.type, { groupId: undefined });
      }
    }
    removeSchemaGroup(groupId);
    setContextMenu(null);
  }, [schemas, updateSchema, removeSchemaGroup]);

  const handleRemoveFromGroup = useCallback((schemaType: string) => {
    updateSchema(schemaType, { groupId: undefined });
    setContextMenu(null);
  }, [updateSchema]);

  const handleMoveToGroup = useCallback((schemaType: string, groupId: string) => {
    updateSchema(schemaType, { groupId });
    setContextMenu(null);
  }, [updateSchema]);

  const handleCreateRelationship = useCallback((schemaType: string) => {
    const schema = getSchema(schemaType);
    if (!schema) return;
    // Open connection modal with just source pre-filled
    // User picks target via the modal
    setContextMenu(null);
    // Select the schema node so users can drag a connection from it
    reactFlow.setNodes(nds => nds.map(n => ({
      ...n,
      selected: n.id === schemaType,
    })));
  }, [getSchema, reactFlow]);

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

  // Apply edge remapping for collapsed organizers (presentation layer provides the remap)
  const remappedEdges = useMemo(() => {
    let result = layoutEdges as Edge[];

    if (edgeRemap.size > 0) {
      const seenEdgeKeys = new Set<string>();
      result = result.map(edge => {
        const remappedSource = edgeRemap.get(edge.source);
        const remappedTarget = edgeRemap.get(edge.target);

        if (remappedSource || remappedTarget) {
          const newSource = remappedSource || edge.source;
          const newTarget = remappedTarget || edge.target;

          // Skip self-loops to same organizer
          if (newSource === newTarget) return null;

          // Dedupe edges that now have the same endpoints
          const dedupeKey = `${newSource}-${newTarget}`;
          if (seenEdgeKeys.has(dedupeKey)) return null;
          seenEdgeKeys.add(dedupeKey);

          return {
            ...edge,
            id: `${edge.id}-remapped`,
            source: newSource,
            target: newTarget,
            sourceHandle: remappedSource ? 'group-connect' : edge.sourceHandle,
            targetHandle: remappedTarget ? 'group-connect' : edge.targetHandle,
          };
        }
        return edge;
      }).filter((e): e is Edge => e !== null);
    }

    // Remove edges whose source or target is hidden
    const visibleNodeIds = new Set(
      nodes.filter(n => !n.hidden).map(n => n.id)
    );
    return result.filter(edge =>
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [layoutEdges, edgeRemap, nodes]);

  // Build node type map for edge bundling
  const nodeTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      map.set(n.id, n.type || '');
    }
    return map;
  }, [nodes]);

  // Apply edge bundling + dynamic anchor edge type
  const { displayEdges } = useEdgeBundling(remappedEdges, nodeTypeMap);

  // Keyboard shortcuts for metamap
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      // Undo: Ctrl+Z
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo();
        return;
      }
      // Delete selected schema: Delete/Backspace
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selected = reactFlow.getNodes().filter(n => n.selected && n.type === 'schema-node');
        for (const node of selected) {
          const schema = getSchema(node.id);
          if (schema) {
            updateSchema(schema.type, { _deleted: true } as Partial<ConstructSchema>);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, reactFlow, getSchema, updateSchema]);

  // Detect non-parented schema nodes visually covered by organizers
  const coveredNodeIds = useMemo(() => {
    const visibleOrganizers = nodes.filter(n => n.type === 'organizer' && !n.hidden);
    if (visibleOrganizers.length === 0) return [];

    const covered: string[] = [];
    for (const node of nodes) {
      if (node.type === 'organizer' || node.hidden || node.parentId) continue;
      const nodeW = node.measured?.width ?? node.width ?? 240;
      const nodeH = node.measured?.height ?? node.height ?? 80;
      for (const org of visibleOrganizers) {
        const orgW = (org.style?.width as number) ?? org.width ?? 200;
        const orgH = (org.style?.height as number) ?? org.height ?? 200;
        if (nodeContainedInOrganizer(
          node.position, { width: nodeW, height: nodeH },
          org.position, { width: orgW, height: orgH }
        )) {
          covered.push(node.id);
          break;
        }
      }
    }
    return covered;
  }, [nodes]);

  const rescueCoveredNodes = useCallback(() => {
    const visibleOrganizers = nodes.filter(n => n.type === 'organizer' && !n.hidden);
    const margin = 20;

    setNodes(nds => nds.map(n => {
      if (!coveredNodeIds.includes(n.id)) return n;

      const nodeW = n.measured?.width ?? n.width ?? 240;
      const nodeH = n.measured?.height ?? n.height ?? 80;

      const coveringOrg = visibleOrganizers.find(org => {
        const orgW = (org.style?.width as number) ?? org.width ?? 200;
        const orgH = (org.style?.height as number) ?? org.height ?? 200;
        return nodeContainedInOrganizer(
          n.position, { width: nodeW, height: nodeH },
          org.position, { width: orgW, height: orgH }
        );
      });
      if (!coveringOrg) return n;

      const orgW = (coveringOrg.style?.width as number) ?? coveringOrg.width ?? 200;
      const orgH = (coveringOrg.style?.height as number) ?? coveringOrg.height ?? 200;

      const cx = n.position.x + nodeW / 2;
      const cy = n.position.y + nodeH / 2;
      const distLeft = cx - coveringOrg.position.x;
      const distRight = (coveringOrg.position.x + orgW) - cx;
      const distTop = cy - coveringOrg.position.y;
      const distBottom = (coveringOrg.position.y + orgH) - cy;
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);

      let newPos = { ...n.position };
      if (minDist === distLeft) {
        newPos = { x: coveringOrg.position.x - nodeW - margin, y: n.position.y };
      } else if (minDist === distRight) {
        newPos = { x: coveringOrg.position.x + orgW + margin, y: n.position.y };
      } else if (minDist === distTop) {
        newPos = { x: n.position.x, y: coveringOrg.position.y - nodeH - margin };
      } else {
        newPos = { x: n.position.x, y: coveringOrg.position.y + orgH + margin };
      }

      return { ...n, position: newPos };
    }));
  }, [nodes, coveredNodeIds]);

  const toggleLayoutDirection = useCallback(() => {
    setLayoutDirection(d => d === 'TB' ? 'LR' : 'TB');
  }, []);

  const reLayout = useCallback(() => {
    // Reset expanded groups on re-layout
    setExpandedGroups(new Set());
    triggerReLayout();
  }, [triggerReLayout]);

  // Build context menu items based on context
  const contextMenuItems = useMemo((): MenuItem[] => {
    if (!contextMenu) return [];

    if (contextMenu.schemaType) {
      // Schema node context menu
      const schema = getSchema(contextMenu.schemaType);
      const items: MenuItem[] = [];

      if (schema) {
        items.push({
          key: 'edit-schema',
          label: 'Edit Schema',
          onClick: () => {
            setEditorState({ open: true, editSchema: schema });
            setContextMenu(null);
          },
        });

        items.push({
          key: 'create-relationship',
          label: 'Create Relationship',
          onClick: () => handleCreateRelationship(contextMenu.schemaType!),
        });

        // Group operations
        if (schema.groupId) {
          items.push({
            key: 'remove-from-group',
            label: 'Remove from Group',
            onClick: () => handleRemoveFromGroup(contextMenu.schemaType!),
          });
        }

        const availableGroups = schemaGroups.filter(g => g.id !== schema.groupId);
        if (availableGroups.length > 0) {
          items.push({
            key: 'move-to-group',
            label: 'Move to Group',
            children: availableGroups.map(g => ({
              key: `move-to-${g.id}`,
              label: g.name,
              color: g.color,
              onClick: () => handleMoveToGroup(contextMenu.schemaType!, g.id),
            })),
          });
        }

        // Divider before delete
        if (items.length > 0) items[items.length - 1].dividerAfter = true;

        items.push({
          key: 'delete-schema',
          label: 'Delete Schema',
          danger: true,
          onClick: () => handleDeleteSchema(contextMenu.schemaType!),
        });
      }

      return items;
    }

    if (contextMenu.groupId) {
      // Group node context menu
      const group = schemaGroups.find(g => g.id === contextMenu.groupId);
      const items: MenuItem[] = [];

      if (group) {
        const isExpanded = expandedGroups.has(group.id);
        items.push({
          key: 'toggle-collapse',
          label: isExpanded ? 'Collapse Group' : 'Expand Group',
          onClick: () => {
            setExpandedGroups(prev => {
              const next = new Set(prev);
              if (isExpanded) next.delete(group.id);
              else next.add(group.id);
              return next;
            });
            setContextMenu(null);
          },
        });

        items.push({
          key: 'edit-group',
          label: 'Rename Group',
          onClick: () => {
            const name = prompt('Enter new group name:', group.name);
            if (name) updateSchemaGroup(group.id, { name });
            setContextMenu(null);
          },
        });

        if (items.length > 0) items[items.length - 1].dividerAfter = true;

        items.push({
          key: 'delete-group',
          label: 'Delete Group',
          danger: true,
          onClick: () => handleDeleteGroup(contextMenu.groupId!),
        });
      }

      return items;
    }

    // Pane context menu
    const items: MenuItem[] = [];

    items.push({
      key: 'new-schema',
      label: 'New Construct Schema',
      onClick: () => {
        handleNewSchemaType();
        setContextMenu(null);
      },
    });

    items.push({
      key: 'new-group',
      label: 'New Group',
      onClick: () => {
        handleNewGroup();
        setContextMenu(null);
      },
    });

    // Edit schema submenu
    if (schemas.length > 0) {
      if (items.length > 0) items[items.length - 1].dividerAfter = true;
      items.push({
        key: 'edit-schema',
        label: 'Edit Schema',
        children: schemas.map(s => ({
          key: `edit-${s.type}`,
          label: s.displayName,
          color: s.color,
          onClick: () => {
            setEditorState({ open: true, editSchema: s });
            setContextMenu(null);
          },
        })),
      });
    }

    return items;
  }, [contextMenu, getSchema, schemas, schemaGroups, expandedGroups, handleCreateRelationship, handleRemoveFromGroup, handleMoveToGroup, handleDeleteSchema, handleDeleteGroup, handleNewSchemaType, handleNewGroup, updateSchemaGroup]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <div className="metamap-bg absolute inset-0 pointer-events-none" />
      <ZoomDebug position="top-left" />
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        fitView
        nodesDraggable
        nodesConnectable
        proOptions={{ hideAttribution: true }}
        className="metamap-canvas"
      >
        <Controls position="top-left" showZoom={false}>
          <ControlButton onClick={undo} title="Undo (Ctrl+Z)" className={canUndo ? '' : 'opacity-30 pointer-events-none'}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </ControlButton>
          <ControlButton onClick={redo} title="Redo (Ctrl+Y)" className={canRedo ? '' : 'opacity-30 pointer-events-none'}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
            </svg>
          </ControlButton>
          <ControlButton onClick={reLayout} title="Re-layout">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </ControlButton>
          <ControlButton onClick={toggleLayoutDirection} title={`Layout: ${layoutDirection === 'TB' ? 'Top-Bottom' : 'Left-Right'} (click to toggle)`}>
            {layoutDirection === 'TB' ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="3" x2="12" y2="21" />
                <polyline points="8 17 12 21 16 17" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <polyline points="17 8 21 12 17 16" />
              </svg>
            )}
          </ControlButton>
        </Controls>

        {/* Custom zoom controls with finer granularity */}
        <div className="absolute top-[14px] left-[52px] flex flex-col gap-[2px]">
          <button
            onClick={customZoomIn}
            className="w-[32px] h-[32px] bg-white border border-[#e2e8f0] rounded cursor-pointer flex items-center justify-center hover:bg-[#f8fafc] transition-colors shadow-sm"
            title="Zoom In"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            onClick={customZoomOut}
            className="w-[32px] h-[32px] bg-white border border-[#e2e8f0] rounded cursor-pointer flex items-center justify-center hover:bg-[#f8fafc] transition-colors shadow-sm"
            title="Zoom Out"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* Covered nodes warning badge */}
        {coveredNodeIds.length > 0 && (
          <div className="absolute top-[14px] left-[92px]">
            <button
              onClick={rescueCoveredNodes}
              className="h-[32px] px-3 bg-amber-100 border border-amber-300 rounded cursor-pointer flex items-center gap-1.5 hover:bg-amber-200 transition-colors shadow-sm text-amber-800 text-xs font-medium"
              title={`${coveredNodeIds.length} node${coveredNodeIds.length > 1 ? 's' : ''} covered by organizers — click to rescue`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {coveredNodeIds.length} covered
            </button>
          </div>
        )}

        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
      <Narrative narrative={narrative} onDismiss={hideNarrative} />
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
        <ContextMenuPrimitive
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
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
