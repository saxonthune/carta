import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Canvas, type CanvasRef, useCanvasContext, useNodeDrag, findContainerAt, ConnectionPreview, useKeyboardShortcuts, CrossGrid } from '../../canvas-engine/index.js';
import { useSchemas } from '../../hooks/useSchemas.js';
import { useSchemaGroups } from '../../hooks/useSchemaGroups.js';
import { useSchemaPackages } from '../../hooks/useSchemaPackages.js';
import { useSchemaUndoRedo } from '../../hooks/useSchemaUndoRedo.js';
import { useNarrative } from '../../hooks/useNarrative.js';
import { usePages } from '../../hooks/usePages.js';
import { computeMetamapV2Layout, type MetamapV2Node, type MetamapV2Edge } from '../../utils/metamapV2Layout.js';
import { MetamapSchemaNode } from './MetamapSchemaNode.js';
import { MetamapPackageNode } from './MetamapPackageNode.js';
import { MetamapGroupNode } from './MetamapGroupNode.js';
import CanvasToolbar, { ToolbarButton, ToolbarDivider } from '../canvas/CanvasToolbar.js';
import { MagnifyingGlassPlus, MagnifyingGlassMinus, CornersOut, ArrowsClockwise, MagnifyingGlass, X, Trash, FolderMinus, ArrowUUpLeft, ArrowUUpRight } from '@phosphor-icons/react';
import ConstructEditor from '../ConstructEditor.js';
import type { ConstructSchema, SuggestedRelatedConstruct } from '@carta/domain';
import { portRegistry } from '@carta/domain';
import { MetamapConnectionModal } from '../metamap/MetamapConnectionModal.js';
import EdgeDetailPopover from '../metamap/EdgeDetailPopover.js';
import Narrative from '../canvas/Narrative.js';
import ContextMenuPrimitive, { type MenuItem } from '../ui/ContextMenuPrimitive.js';
import { DeleteEmptySchemasModal, DeleteEmptyGroupsModal } from '../modals/index.js';

const SCHEMA_COLORS = [
  '#7c7fca', '#8a7cb8', '#9488b8', '#b87c8a',
  '#c49a4c', '#c4a94e', '#5ba88e', '#5a9e9e',
  '#6a8fc0', '#6b7280', '#8a7060', '#4a5568',
];

export default function MetamapV2() {
  const { schemas, updateSchema, getSchema, removeSchema } = useSchemas();
  const { schemaGroups, addSchemaGroup, removeSchemaGroup, updateSchemaGroup } = useSchemaGroups();
  const { schemaPackages, updateSchemaPackage } = useSchemaPackages();
  const { undo, redo, canUndo, canRedo } = useSchemaUndoRedo();
  const canvasRef = useRef<CanvasRef>(null);

  // Compute layout from Yjs data
  const layoutResult = useMemo(
    () => computeMetamapV2Layout(schemas, schemaGroups, schemaPackages),
    [schemas, schemaGroups, schemaPackages]
  );

  // Local position state (not persisted to Yjs)
  const [localNodes, setLocalNodes] = useState<MetamapV2Node[]>([]);
  const localNodesRef = useRef<MetamapV2Node[]>([]);
  const initializedRef = useRef(false);
  const pendingRelayoutRef = useRef(false);

  // Initialize local nodes from computed layout.
  // Re-runs when layoutResult changes. On first mount or after a pending relayout,
  // replaces local state with the freshly computed layout.
  useEffect(() => {
    if (layoutResult.nodes.length > 0 && (!initializedRef.current || pendingRelayoutRef.current)) {
      setLocalNodes(layoutResult.nodes);
      localNodesRef.current = layoutResult.nodes;
      initializedRef.current = true;
      pendingRelayoutRef.current = false;
    }
  }, [layoutResult.nodes]);

  // Sync localNodesRef with localNodes state
  useEffect(() => {
    localNodesRef.current = localNodes;
  }, [localNodes]);

  // Fit view on mount
  const fitViewDoneRef = useRef(false);
  useEffect(() => {
    if (localNodes.length > 0 && !fitViewDoneRef.current && canvasRef.current) {
      const rects = localNodes.map(n => ({
        x: getAbsoluteX(n, localNodes),
        y: getAbsoluteY(n, localNodes),
        width: n.size.width,
        height: n.size.height,
      }));
      canvasRef.current.fitView(rects, 0.15);
      fitViewDoneRef.current = true;
    }
  }, [localNodes]);

  // Schema editor state
  const [editorState, setEditorState] = useState<{ open: boolean; editSchema?: ConstructSchema }>({ open: false });

  // Connection modal state
  const [connectionModal, setConnectionModal] = useState<{
    sourceSchema: ConstructSchema;
    targetSchema: ConstructSchema;
  } | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    schemaType?: string;
    groupId?: string;
    packageId?: string;
  } | null>(null);

  // Narrative tooltip state
  const { narrative, showNarrative, hideNarrative } = useNarrative();

  // Edge popover state
  const [edgePopover, setEdgePopover] = useState<{
    sourceSchema: ConstructSchema;
    targetSchema: ConstructSchema;
    relationship: SuggestedRelatedConstruct;
    relationshipIndex: number;
    position: { x: number; y: number };
  } | null>(null);

  // Schema expand/collapse state
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());

  // Schema rename state
  const [renamingSchemaId, setRenamingSchemaId] = useState<string | null>(null);

  // Filter state
  const [filterText, setFilterText] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);

  // Delete empty state
  const [showDeleteEmpty, setShowDeleteEmpty] = useState(false);
  const [showDeleteEmptyGroups, setShowDeleteEmptyGroups] = useState(false);

  // Compute empty schemas and groups
  const { pages } = usePages();
  const emptySchemas = useMemo(() => {
    const usedTypes = new Set<string>();
    for (const page of pages) {
      for (const node of (page.nodes as Array<{ data?: { constructType?: string } }>)) {
        if (node.data?.constructType) usedTypes.add(node.data.constructType);
      }
    }
    return schemas.filter(s => !usedTypes.has(s.type));
  }, [schemas, pages]);

  const emptyGroups = useMemo(() => {
    const groupsWithSchemas = new Set<string>();
    for (const schema of schemas) {
      if (schema.groupId) groupsWithSchemas.add(schema.groupId);
    }
    return schemaGroups.filter(g => !groupsWithSchemas.has(g.id));
  }, [schemas, schemaGroups]);

  // Filter matching logic
  const matchingSchemaTypes = useMemo(() => {
    if (!filterText.trim()) return null;
    const q = filterText.toLowerCase();
    return new Set(
      schemas.filter(s =>
        s.displayName.toLowerCase().includes(q) || s.type.toLowerCase().includes(q)
      ).map(s => s.type)
    );
  }, [filterText, schemas]);

  const dimmedSchemaTypes = useMemo(() => {
    if (!matchingSchemaTypes) return new Set<string>();
    return new Set(schemas.filter(s => !matchingSchemaTypes.has(s.type)).map(s => s.type));
  }, [matchingSchemaTypes, schemas]);

  const containersWithMatches = useMemo(() => {
    const result = new Set<string>();
    if (!matchingSchemaTypes) return result;
    for (const s of schemas) {
      if (matchingSchemaTypes.has(s.type)) {
        if (s.packageId) result.add(`package:${s.packageId}`);
        if (s.groupId) result.add(`group:${s.groupId}`);
      }
    }
    return result;
  }, [matchingSchemaTypes, schemas]);

  const handleSchemaDoubleClick = useCallback((schemaType: string) => {
    setExpandedSchemas(prev => {
      const next = new Set(prev);
      if (next.has(schemaType)) {
        next.delete(schemaType);
      } else {
        next.add(schemaType);
      }
      return next;
    });
  }, []);

  const handleDeleteEmptySchemas = useCallback(() => {
    for (const schema of emptySchemas) removeSchema(schema.type);
    setShowDeleteEmpty(false);
  }, [emptySchemas, removeSchema]);

  const handleDeleteEmptyGroups = useCallback(() => {
    for (const group of emptyGroups) removeSchemaGroup(group.id);
    setShowDeleteEmptyGroups(false);
  }, [emptyGroups, removeSchemaGroup]);

  // Edge interaction handlers
  const handleEdgeClick = useCallback((edge: MetamapV2Edge, event: React.MouseEvent) => {
    const sourceSchema = getSchema(edge.sourceType);
    const targetSchema = getSchema(edge.target);
    if (!sourceSchema || !targetSchema) return;

    const fromPort = sourceSchema.ports?.find(p => p.id === edge.fromPortId);
    const toPort = targetSchema.ports?.find(p => p.id === edge.toPortId);
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

  const handleEdgeDoubleClick = useCallback((edge: MetamapV2Edge, event: React.MouseEvent) => {
    const sourceSchema = getSchema(edge.sourceType);
    const targetSchema = getSchema(edge.target);
    if (!sourceSchema || !targetSchema) return;

    const relationship = sourceSchema.suggestedRelated?.[edge.relIndex];
    if (!relationship) return;

    hideNarrative();
    setEdgePopover({
      sourceSchema,
      targetSchema,
      relationship,
      relationshipIndex: edge.relIndex,
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

  // Connection handlers
  const handleConnect = useCallback((connection: { source: string; sourceHandle: string; target: string; targetHandle: string }) => {
    const source = getSchema(connection.source);
    const target = getSchema(connection.target);
    if (source && target) {
      setConnectionModal({ sourceSchema: source, targetSchema: target });
    }
  }, [getSchema]);

  const isValidConnection = useCallback((_connection: { source: string; sourceHandle: string; target: string; targetHandle: string }) => {
    // Allow self-referential connections
    return true;
  }, []);

  const handleSaveConnection = useCallback((config: {
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
  }, [updateSchema]);

  // Re-layout handler — marks a pending relayout so the next layoutResult
  // change (or current one) resets local positions to the computed layout.
  // For the toolbar "re-layout" button, we also immediately apply since
  // layoutResult is already current.
  const handleRelayout = useCallback(() => {
    pendingRelayoutRef.current = true;
    // If called from toolbar (no Yjs mutation pending), apply immediately
    setLocalNodes(layoutResult.nodes);
    localNodesRef.current = layoutResult.nodes;
  }, [layoutResult.nodes]);

  // Context menu items
  const contextMenuItems = useMemo((): MenuItem[] => {
    if (!contextMenu) return [];

    // Background menu
    if (!contextMenu.schemaType && !contextMenu.groupId && !contextMenu.packageId) {
      return [
        {
          key: 'new-schema',
          label: 'New Construct Schema',
          onClick: () => {
            setEditorState({ open: true });
            setContextMenu(null);
          },
        },
        {
          key: 'new-group',
          label: 'New Group',
          renderContent: (
            <input
              autoFocus
              className="w-full px-2 py-1 text-sm bg-surface border border-border rounded"
              placeholder="Group name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                  addSchemaGroup({ name: (e.target as HTMLInputElement).value.trim(), color: '#6366f1' });
                  setContextMenu(null);
                  handleRelayout();
                }
                if (e.key === 'Escape') setContextMenu(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ),
        },
      ];
    }

    // Schema node menu
    if (contextMenu.schemaType) {
      const schema = getSchema(contextMenu.schemaType);
      const items: MenuItem[] = [
        {
          key: 'edit-schema',
          label: 'Edit Schema',
          onClick: () => {
            if (schema) setEditorState({ open: true, editSchema: schema });
            setContextMenu(null);
          },
        },
        {
          key: 'change-color',
          label: 'Change Color',
          renderContent: (
            <div className="flex flex-wrap gap-1 px-1 py-0.5">
              {SCHEMA_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`w-5 h-5 rounded border-2 cursor-pointer transition-all hover:scale-110 ${
                    schema?.color === color ? 'border-white shadow-[0_0_0_2px_var(--color-accent)]' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    updateSchema(contextMenu.schemaType!, { color });
                    setContextMenu(null);
                  }}
                />
              ))}
            </div>
          ),
        },
      ];

      // Move to Group submenu
      const availableGroups = schemaGroups.filter(g => g.id !== schema?.groupId);
      if (availableGroups.length > 0) {
        items.push({
          key: 'move-to-group',
          label: 'Move to Group',
          children: availableGroups.map(g => ({
            key: `move-to-${g.id}`,
            label: g.name,
            color: g.color,
            onClick: () => {
              updateSchema(contextMenu.schemaType!, { groupId: g.id });
              setContextMenu(null);
              handleRelayout();
            },
          })),
        });
      }

      // Remove from Group
      if (schema?.groupId) {
        items.push({
          key: 'remove-from-group',
          label: 'Remove from Group',
          onClick: () => {
            updateSchema(contextMenu.schemaType!, { groupId: undefined });
            setContextMenu(null);
            handleRelayout();
          },
        });
      }

      // Move to Package submenu
      const availablePackages = schemaPackages.filter(p => p.id !== schema?.packageId);
      if (availablePackages.length > 0) {
        items.push({
          key: 'move-to-package',
          label: 'Move to Package',
          children: availablePackages.map(p => ({
            key: `move-to-pkg-${p.id}`,
            label: p.name,
            onClick: () => {
              updateSchema(contextMenu.schemaType!, { packageId: p.id, groupId: undefined });
              setContextMenu(null);
              handleRelayout();
            },
          })),
        });
      }

      items.push({
        key: 'divider-1',
        label: '',
        dividerAfter: true,
      });
      items.push({
        key: 'delete-schema',
        label: 'Delete Schema',
        danger: true,
        onClick: () => {
          removeSchema(contextMenu.schemaType!);
          setContextMenu(null);
        },
      });

      return items;
    }

    // Group node menu
    if (contextMenu.groupId) {
      return [
        {
          key: 'rename-group',
          label: 'Rename Group',
          renderContent: (
            <input
              autoFocus
              className="w-full px-2 py-1 text-sm bg-surface border border-border rounded"
              placeholder="New name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                  updateSchemaGroup(contextMenu.groupId!, { name: (e.target as HTMLInputElement).value.trim() });
                  setContextMenu(null);
                  handleRelayout();
                }
                if (e.key === 'Escape') setContextMenu(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ),
        },
        {
          key: 'divider-1',
          label: '',
          dividerAfter: true,
        },
        {
          key: 'delete-group',
          label: 'Delete Group',
          danger: true,
          onClick: () => {
            // Ungroup all schemas in this group first
            const groupSchemas = schemas.filter(s => s.groupId === contextMenu.groupId);
            groupSchemas.forEach(s => {
              updateSchema(s.type, { groupId: undefined });
            });
            removeSchemaGroup(contextMenu.groupId!);
            setContextMenu(null);
          },
        },
      ];
    }

    // Package node menu
    if (contextMenu.packageId) {
      return [
        {
          key: 'rename-package',
          label: 'Rename Package',
          renderContent: (
            <input
              autoFocus
              className="w-full px-2 py-1 text-sm bg-surface border border-border rounded"
              placeholder="New name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                  updateSchemaPackage(contextMenu.packageId!, { name: (e.target as HTMLInputElement).value.trim() });
                  setContextMenu(null);
                  handleRelayout();
                }
                if (e.key === 'Escape') setContextMenu(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ),
        },
      ];
    }

    return [];
  }, [contextMenu, getSchema, removeSchema, addSchemaGroup, removeSchemaGroup, schemas, updateSchema, handleRelayout]);

  // Fit view handler
  const handleFitView = useCallback(() => {
    if (canvasRef.current && localNodes.length > 0) {
      const rects = localNodes.map(n => ({
        x: getAbsoluteX(n, localNodes),
        y: getAbsoluteY(n, localNodes),
        width: n.size.width,
        height: n.size.height,
      }));
      canvasRef.current.fitView(rects, 0.15);
    }
  }, [localNodes]);

  return (
    <div
      className="w-full h-full relative"
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <Canvas
        ref={canvasRef}
        viewportOptions={{ minZoom: 0.1, maxZoom: 2 }}
        connectionDrag={{ onConnect: handleConnect, isValidConnection }}
        onBackgroundPointerDown={() => setContextMenu(null)}
        renderBackground={(transform, patternId) => (
          <CrossGrid transform={transform} patternId={patternId || 'metamap-cross-grid'} />
        )}
        renderEdges={() => (
          <MetamapEdgeLayer
            edges={layoutResult.edges}
            nodes={localNodes}
            onEdgeClick={handleEdgeClick}
            onEdgeDoubleClick={handleEdgeDoubleClick}
          />
        )}
        renderConnectionPreview={(drag, transform) => {
          const sourceNode = localNodes.find(n => n.id === drag.sourceNodeId);
          if (!sourceNode) return null;
          const absX = getAbsoluteX(sourceNode, localNodes);
          const absY = getAbsoluteY(sourceNode, localNodes);

          // Get port Y offset if dragging from a specific port
          const sourcePortOffset = drag.sourceHandle && drag.sourceHandle !== 'new-port' && sourceNode.portOffsets
            ? sourceNode.portOffsets.get(drag.sourceHandle)
            : undefined;

          const sourceYOffset = sourcePortOffset !== undefined ? sourcePortOffset : sourceNode.size.height / 2;

          // Anchor from right edge of node at port position
          const DOT_OFFSET = 6;
          const sx = absX + sourceNode.size.width + DOT_OFFSET;
          const sy = absY + sourceYOffset;

          // Convert cursor screen coords to canvas coords
          const canvasX = (drag.currentX - transform.x) / transform.k;
          const canvasY = (drag.currentY - transform.y) / transform.k;
          return (
            <ConnectionPreview
              d={`M ${sx},${sy} L ${canvasX},${canvasY}`}
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeDasharray="6 3"
            />
          );
        }}
        className="w-full h-full"
      >
        <MetamapV2Inner
          localNodes={localNodes}
          setLocalNodes={setLocalNodes}
          localNodesRef={localNodesRef}
          onSchemaDoubleClick={handleSchemaDoubleClick}
          onContextMenu={setContextMenu}
          updateSchema={updateSchema}
          schemaGroups={schemaGroups}
          modalsOpen={editorState.open || !!connectionModal}
          expandedSchemas={expandedSchemas}
          renamingSchemaId={renamingSchemaId}
          setRenamingSchemaId={setRenamingSchemaId}
          onRelayout={handleRelayout}
          dimmedSchemaTypes={dimmedSchemaTypes}
          matchingSchemaTypes={matchingSchemaTypes}
          containersWithMatches={containersWithMatches}
          onOpenFilter={() => setFilterVisible(true)}
          undo={undo}
          redo={redo}
        />
      </Canvas>
      {filterVisible && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-surface rounded-lg px-3 py-2"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)' }}
        >
          <MagnifyingGlass weight="bold" size={16} className="text-content-subtle shrink-0" />
          <input
            autoFocus
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                setFilterText('');
                setFilterVisible(false);
              }
            }}
            placeholder="Filter schemas..."
            className="bg-transparent border-none outline-none text-content text-sm w-48 placeholder:text-content-subtle"
          />
          {filterText.trim() && matchingSchemaTypes && (
            <span className="text-[10px] font-medium text-content-subtle bg-surface-alt px-1.5 py-0.5 rounded shrink-0">
              {matchingSchemaTypes.size} match{matchingSchemaTypes.size !== 1 ? 'es' : ''}
            </span>
          )}
          <button
            onClick={() => { setFilterText(''); setFilterVisible(false); }}
            className="text-content-subtle hover:text-content p-0.5 shrink-0 cursor-pointer"
          >
            <X weight="bold" size={16} />
          </button>
        </div>
      )}
      <CanvasToolbar>
        <div className={canUndo ? '' : 'opacity-30 pointer-events-none'}>
          <ToolbarButton onClick={undo} tooltip="Undo (Ctrl+Z)">
            <ArrowUUpLeft size={16} />
          </ToolbarButton>
        </div>
        <div className={canRedo ? '' : 'opacity-30 pointer-events-none'}>
          <ToolbarButton onClick={redo} tooltip="Redo (Ctrl+Y)">
            <ArrowUUpRight size={16} />
          </ToolbarButton>
        </div>
        <ToolbarDivider />
        <ToolbarButton onClick={() => canvasRef.current?.zoomIn()} tooltip="Zoom in">
          <MagnifyingGlassPlus size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => canvasRef.current?.zoomOut()} tooltip="Zoom out">
          <MagnifyingGlassMinus size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={handleFitView} tooltip="Fit view">
          <CornersOut size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={handleRelayout} tooltip="Re-layout">
          <ArrowsClockwise size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={() => setFilterVisible(v => !v)} tooltip="Filter schemas (Ctrl+F)">
          <MagnifyingGlass size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <div className={emptySchemas.length === 0 ? 'opacity-30 pointer-events-none' : ''}>
          <ToolbarButton onClick={() => setShowDeleteEmpty(true)} tooltip="Delete empty schemas">
            <Trash size={16} />
          </ToolbarButton>
        </div>
        <div className={emptyGroups.length === 0 ? 'opacity-30 pointer-events-none' : ''}>
          <ToolbarButton onClick={() => setShowDeleteEmptyGroups(true)} tooltip="Delete empty groups">
            <FolderMinus size={16} />
          </ToolbarButton>
        </div>
      </CanvasToolbar>
      {editorState.open && (
        <ConstructEditor
          editSchema={editorState.editSchema}
          onClose={() => setEditorState({ open: false })}
        />
      )}
      {connectionModal && (
        <MetamapConnectionModal
          sourceSchema={connectionModal.sourceSchema}
          targetSchema={connectionModal.targetSchema}
          onSave={handleSaveConnection}
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
      <Narrative narrative={narrative} onDismiss={hideNarrative} />
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
      <DeleteEmptySchemasModal
        isOpen={showDeleteEmpty}
        onClose={() => setShowDeleteEmpty(false)}
        emptySchemas={emptySchemas}
        onDelete={handleDeleteEmptySchemas}
      />
      <DeleteEmptyGroupsModal
        isOpen={showDeleteEmptyGroups}
        onClose={() => setShowDeleteEmptyGroups(false)}
        emptyGroups={emptyGroups}
        onDelete={handleDeleteEmptyGroups}
      />
    </div>
  );
}

interface MetamapV2InnerProps {
  localNodes: MetamapV2Node[];
  setLocalNodes: React.Dispatch<React.SetStateAction<MetamapV2Node[]>>;
  localNodesRef: React.MutableRefObject<MetamapV2Node[]>;
  onSchemaDoubleClick: (schemaType: string) => void;
  onContextMenu: (menu: { x: number; y: number; schemaType?: string; groupId?: string; packageId?: string }) => void;
  updateSchema: (type: string, updates: any) => void;
  schemaGroups: any[];
  modalsOpen: boolean;
  expandedSchemas: Set<string>;
  renamingSchemaId: string | null;
  setRenamingSchemaId: (id: string | null) => void;
  onRelayout: () => void;
  dimmedSchemaTypes: Set<string>;
  matchingSchemaTypes: Set<string> | null;
  containersWithMatches: Set<string>;
  onOpenFilter: () => void;
  undo: () => void;
  redo: () => void;
}

function MetamapV2Inner({
  localNodes,
  setLocalNodes,
  localNodesRef,
  onSchemaDoubleClick,
  onContextMenu,
  updateSchema,
  schemaGroups,
  modalsOpen,
  expandedSchemas,
  renamingSchemaId,
  setRenamingSchemaId,
  onRelayout,
  dimmedSchemaTypes,
  matchingSchemaTypes,
  containersWithMatches,
  onOpenFilter,
  undo,
  redo,
}: MetamapV2InnerProps) {
  const { transform, ctrlHeld, startConnection, connectionDrag } = useCanvasContext();
  const [highlightedContainerId, setHighlightedContainerId] = useState<string | null>(null);
  const [hoveredSchemaId, setHoveredSchemaId] = useState<string | null>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      { key: 'z', mod: true, action: undo },
      { key: 'y', mod: true, action: redo },
      { key: 'z', mod: true, shift: true, action: redo },
      { key: 'f', mod: true, action: onOpenFilter },
    ],
    disabled: modalsOpen,
  });

  // Drag origin tracking
  const dragOriginRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);
  const dragNodeTypeRef = useRef<'schema' | 'package' | 'group' | null>(null);
  const ctrlDragStartRef = useRef(false);

  const { onPointerDown: handleNodePointerDown } = useNodeDrag({
    zoomScale: transform.k,
    callbacks: {
      onDragStart: (nodeId) => {
        const node = localNodesRef.current.find(n => n.id === nodeId);
        if (node) {
          dragOriginRef.current = { nodeId, x: node.position.x, y: node.position.y };
          dragNodeTypeRef.current = node.type as 'schema' | 'package' | 'group';
          ctrlDragStartRef.current = ctrlHeld;
        }
      },
      onDrag: (nodeId, deltaX, deltaY) => {
        const origin = dragOriginRef.current;
        if (!origin || origin.nodeId !== nodeId) return;

        // Update node position
        setLocalNodes(prev => prev.map(n => {
          if (n.id === nodeId) {
            return { ...n, position: { x: origin.x + deltaX, y: origin.y + deltaY } };
          }
          return n;
        }));

        // If Ctrl+drag on a schema node, check for container hit
        if (ctrlDragStartRef.current && dragNodeTypeRef.current === 'schema') {
          const node = localNodesRef.current.find(n => n.id === nodeId);
          if (node) {
            const absX = getAbsoluteX(node, localNodesRef.current);
            const absY = getAbsoluteY(node, localNodesRef.current);
            const midX = absX + node.size.width / 2;
            const midY = absY + node.size.height / 2;

            // Convert canvas coords to screen coords
            const screenX = midX * transform.k + transform.x;
            const screenY = midY * transform.k + transform.y;

            const containerId = findContainerAt(screenX, screenY);
            setHighlightedContainerId(containerId);
          }
        }
      },
      onDragEnd: (nodeId) => {
        // If Ctrl+drag on schema, update Yjs
        if (ctrlDragStartRef.current && dragNodeTypeRef.current === 'schema') {
          const containerId = highlightedContainerId;
          const schemaType = nodeId; // Node ID is the schema type

          if (containerId && containerId.startsWith('package:')) {
            const packageId = containerId.slice('package:'.length);
            updateSchema(schemaType, { packageId, groupId: undefined });
          } else if (containerId && containerId.startsWith('group:')) {
            const groupId = containerId.slice('group:'.length);
            const group = schemaGroups.find((g: any) => g.id === groupId);
            updateSchema(schemaType, { groupId, packageId: group?.packageId });
          } else if (!containerId) {
            // Dropped on background — remove from package/group
            updateSchema(schemaType, { packageId: undefined, groupId: undefined });
          }

          // Force re-layout after reassignment — the Yjs mutation will trigger
          // a re-render with new schemas, recomputing layoutResult, and the
          // useEffect will re-initialize localNodes since pendingRelayoutRef is set.
          onRelayout();
        }

        dragOriginRef.current = null;
        dragNodeTypeRef.current = null;
        ctrlDragStartRef.current = false;
        setHighlightedContainerId(null);
      },
    },
  });

  // Compute absolute positions for rendering
  const absoluteNodes = useMemo(() => {
    return localNodes.map(node => ({
      ...node,
      absolutePosition: {
        x: getAbsoluteX(node, localNodes),
        y: getAbsoluteY(node, localNodes),
      },
    }));
  }, [localNodes]);

  return (
    <>
      {/* Container nodes (packages + groups) rendered first */}
      {absoluteNodes.filter(n => n.type === 'package' || n.type === 'group').map(node => (
        <div
          key={node.id}
          style={{
            position: 'absolute',
            left: node.absolutePosition.x,
            top: node.absolutePosition.y,
            outline: highlightedContainerId === node.id ? '2px solid #10b981' : undefined,
            outlineOffset: highlightedContainerId === node.id ? '2px' : undefined,
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (node.type === 'package' && node.data.kind === 'package') {
              onContextMenu({ x: e.clientX, y: e.clientY, packageId: node.data.pkg.id });
            } else if (node.type === 'group' && node.data.kind === 'group') {
              onContextMenu({ x: e.clientX, y: e.clientY, groupId: node.data.group.id });
            }
          }}
        >
          {node.type === 'package' && node.data.kind === 'package' && (
            <MetamapPackageNode
              pkg={node.data.pkg}
              width={node.size.width}
              height={node.size.height}
              schemaCount={node.data.schemaCount}
              onPointerDown={(e) => handleNodePointerDown(node.id, e)}
              isDimmed={matchingSchemaTypes !== null && !containersWithMatches.has(`package:${node.data.pkg.id}`)}
            />
          )}
          {node.type === 'group' && node.data.kind === 'group' && (
            <MetamapGroupNode
              group={node.data.group}
              width={node.size.width}
              height={node.size.height}
              schemaCount={node.data.schemaCount}
              onPointerDown={(e) => handleNodePointerDown(node.id, e)}
              isDimmed={matchingSchemaTypes !== null && !containersWithMatches.has(`group:${node.data.group.id}`)}
            />
          )}
        </div>
      ))}
      {/* Schema nodes rendered on top */}
      {absoluteNodes.filter(n => n.type === 'schema').map(node => {
        const isConnectionDragActive = !!connectionDrag;
        const isTargetDuringDrag = isConnectionDragActive && hoveredSchemaId === node.id;

        return (
          <div
            key={node.id}
            style={{
              position: 'absolute',
              left: node.absolutePosition.x,
              top: node.absolutePosition.y,
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onContextMenu({ x: e.clientX, y: e.clientY, schemaType: node.id });
            }}
            onPointerEnter={() => {
              if (isConnectionDragActive) {
                setHoveredSchemaId(node.id);
              }
            }}
            onPointerLeave={() => {
              if (isConnectionDragActive) {
                setHoveredSchemaId(null);
              }
            }}
          >
            {node.data.kind === 'schema' && (
              <MetamapSchemaNode
                schema={node.data.schema}
                width={node.size.width}
                height={node.size.height}
                onPointerDown={(e) => handleNodePointerDown(node.id, e)}
                onDoubleClick={() => onSchemaDoubleClick(node.id)}
                onStartConnection={startConnection}
                isExpanded={expandedSchemas.has(node.id)}
                isRenaming={renamingSchemaId === node.id}
                onStartRenaming={() => setRenamingSchemaId(node.id)}
                onStopRenaming={() => setRenamingSchemaId(null)}
                onCommitRename={(newName) => {
                  updateSchema(node.id, { displayName: newName });
                  setRenamingSchemaId(null);
                }}
                isDimmed={dimmedSchemaTypes.has(node.id)}
                isHighlighted={matchingSchemaTypes ? matchingSchemaTypes.has(node.id) : false}
                isDrawerForced={isTargetDuringDrag}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// Edge layer component
const DOT_OFFSET = 6; // Must match MetamapSchemaNode DOT_OFFSET

function MetamapEdgeLayer({
  edges,
  nodes,
  onEdgeClick,
  onEdgeDoubleClick,
}: {
  edges: MetamapV2Edge[];
  nodes: MetamapV2Node[];
  onEdgeClick?: (edge: MetamapV2Edge, event: React.MouseEvent) => void;
  onEdgeDoubleClick?: (edge: MetamapV2Edge, event: React.MouseEvent) => void;
}) {
  return (
    <>
      {edges.map(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        if (!sourceNode || !targetNode) return null;

        const absX1 = getAbsoluteX(sourceNode, nodes);
        const absY1 = getAbsoluteY(sourceNode, nodes);
        const absX2 = getAbsoluteX(targetNode, nodes);
        const absY2 = getAbsoluteY(targetNode, nodes);

        // Get port Y offsets from node portOffsets
        const sourcePortOffset = edge.fromPortId && sourceNode.portOffsets
          ? sourceNode.portOffsets.get(edge.fromPortId)
          : undefined;
        const targetPortOffset = edge.toPortId && targetNode.portOffsets
          ? targetNode.portOffsets.get(edge.toPortId)
          : undefined;

        // Default to vertical center if port not found
        const sourceYOffset = sourcePortOffset !== undefined ? sourcePortOffset : sourceNode.size.height / 2;
        const targetYOffset = targetPortOffset !== undefined ? targetPortOffset : targetNode.size.height / 2;

        // Anchor points on right edge of nodes
        const sx = absX1 + sourceNode.size.width + DOT_OFFSET;
        const sy = absY1 + sourceYOffset;
        const tx = absX2 + targetNode.size.width + DOT_OFFSET;
        const ty = absY2 + targetYOffset;

        // Self-referential edge (loop)
        const isSelfRef = edge.source === edge.target;
        let pathD: string;

        if (isSelfRef) {
          const loopSize = 30;
          pathD = `M ${sx},${sy} C ${sx + loopSize},${sy - loopSize} ${sx + loopSize},${sy + loopSize} ${sx},${sy}`;
        } else {
          // Bezier curve
          const dx = Math.abs(tx - sx);
          const cpOffset = Math.max(40, dx * 0.4);
          pathD = `M ${sx},${sy} C ${sx + cpOffset},${sy} ${tx - cpOffset},${ty} ${tx},${ty}`;
        }

        return (
          <g key={edge.id}>
            {/* Invisible hit area */}
            <path
              d={pathD}
              stroke="transparent"
              strokeWidth={10}
              fill="none"
              style={{ cursor: 'pointer' }}
              onClick={(e) => onEdgeClick?.(edge, e)}
              onDoubleClick={(e) => onEdgeDoubleClick?.(edge, e)}
            />
            {/* Visible path */}
            <path
              d={pathD}
              stroke="var(--color-content-subtle)"
              strokeWidth={1.5}
              fill="none"
              style={{ pointerEvents: 'none' }}
            />
            {edge.label && !isSelfRef && (
              <text
                x={(sx + tx) / 2}
                y={(sy + ty) / 2 - 6}
                textAnchor="middle"
                fill="var(--color-content-subtle)"
                fontSize={10}
                style={{ pointerEvents: 'none' }}
              >
                {edge.label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// Helper: resolve absolute X by walking parent chain
function getAbsoluteX(node: MetamapV2Node, allNodes: MetamapV2Node[]): number {
  let x = node.position.x;
  let current = node;
  while (current.parentId) {
    const parent = allNodes.find(n => n.id === current.parentId);
    if (!parent) break;
    x += parent.position.x;
    current = parent;
  }
  return x;
}

function getAbsoluteY(node: MetamapV2Node, allNodes: MetamapV2Node[]): number {
  let y = node.position.y;
  let current = node;
  while (current.parentId) {
    const parent = allNodes.find(n => n.id === current.parentId);
    if (!parent) break;
    y += parent.position.y;
    current = parent;
  }
  return y;
}
