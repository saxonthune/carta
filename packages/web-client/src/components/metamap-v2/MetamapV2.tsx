import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Canvas, type CanvasRef, useCanvasContext, useNodeDrag, findContainerAt, ConnectionPreview, useKeyboardShortcuts } from '../../canvas-engine/index.js';
import { useSchemas } from '../../hooks/useSchemas.js';
import { useSchemaGroups } from '../../hooks/useSchemaGroups.js';
import { useSchemaPackages } from '../../hooks/useSchemaPackages.js';
import { useSchemaUndoRedo } from '../../hooks/useSchemaUndoRedo.js';
import { computeMetamapV2Layout, type MetamapV2Node, type MetamapV2Edge } from '../../utils/metamapV2Layout.js';
import { MetamapSchemaNode } from './MetamapSchemaNode.js';
import { MetamapPackageNode } from './MetamapPackageNode.js';
import { MetamapGroupNode } from './MetamapGroupNode.js';
import CanvasToolbar, { ToolbarButton, ToolbarDivider } from '../canvas/CanvasToolbar.js';
import { MagnifyingGlassPlus, MagnifyingGlassMinus, CornersOut, ArrowsClockwise } from '@phosphor-icons/react';
import ConstructEditor from '../ConstructEditor.js';
import type { ConstructSchema } from '@carta/domain';
import { MetamapConnectionModal } from '../metamap/MetamapConnectionModal.js';
import ContextMenuPrimitive, { type MenuItem } from '../ui/ContextMenuPrimitive.js';

export default function MetamapV2() {
  const { schemas, updateSchema, getSchema, removeSchema } = useSchemas();
  const { schemaGroups, addSchemaGroup, removeSchemaGroup } = useSchemaGroups();
  const { schemaPackages } = useSchemaPackages();
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

  // Track schema count to detect additions/removals and force re-layout
  const schemaCountRef = useRef(schemas.length);
  useEffect(() => {
    if (schemas.length !== schemaCountRef.current) {
      schemaCountRef.current = schemas.length;
      initializedRef.current = false; // Force re-layout on next render
    }
  }, [schemas.length]);

  // Initialize local nodes from computed layout
  useEffect(() => {
    if (layoutResult.nodes.length > 0 && !initializedRef.current) {
      setLocalNodes(layoutResult.nodes);
      localNodesRef.current = layoutResult.nodes;
      initializedRef.current = true;
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

  const handleSchemaDoubleClick = useCallback((schemaType: string) => {
    const schema = getSchema(schemaType);
    if (schema) setEditorState({ open: true, editSchema: schema });
  }, [getSchema]);

  // Connection handlers
  const handleConnect = useCallback((connection: { source: string; sourceHandle: string; target: string; targetHandle: string }) => {
    if (connection.source === connection.target) return;
    const source = getSchema(connection.source);
    const target = getSchema(connection.target);
    if (source && target) {
      setConnectionModal({ sourceSchema: source, targetSchema: target });
    }
  }, [getSchema]);

  const isValidConnection = useCallback((connection: { source: string; sourceHandle: string; target: string; targetHandle: string }) => {
    return connection.source !== connection.target;
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
      return [
        {
          key: 'edit-schema',
          label: 'Edit Schema',
          onClick: () => {
            if (schema) setEditorState({ open: true, editSchema: schema });
            setContextMenu(null);
          },
        },
        {
          key: 'divider-1',
          label: '',
          dividerAfter: true,
        },
        {
          key: 'delete-schema',
          label: 'Delete Schema',
          danger: true,
          onClick: () => {
            removeSchema(contextMenu.schemaType!);
            setContextMenu(null);
          },
        },
      ];
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
                  // TODO: implement rename group
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
                  // TODO: implement rename package
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

  // Re-layout handler
  const handleRelayout = useCallback(() => {
    initializedRef.current = false;
    setLocalNodes(layoutResult.nodes);
    localNodesRef.current = layoutResult.nodes;

    // Fit view after re-layout
    setTimeout(() => {
      if (canvasRef.current) {
        const rects = layoutResult.nodes.map(n => ({
          x: getAbsoluteX(n, layoutResult.nodes),
          y: getAbsoluteY(n, layoutResult.nodes),
          width: n.size.width,
          height: n.size.height,
        }));
        canvasRef.current.fitView(rects, 0.15);
      }
    }, 0);
  }, [layoutResult.nodes]);

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
        renderEdges={() => <MetamapEdgeLayer edges={layoutResult.edges} nodes={localNodes} />}
        renderConnectionPreview={(drag, transform) => {
          const sourceNode = localNodes.find(n => n.id === drag.sourceNodeId);
          if (!sourceNode) return null;
          const absX = getAbsoluteX(sourceNode, localNodes);
          const absY = getAbsoluteY(sourceNode, localNodes);
          const sx = absX + sourceNode.size.width / 2;
          const sy = absY + sourceNode.size.height / 2;
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
          edges={layoutResult.edges}
          onSchemaDoubleClick={handleSchemaDoubleClick}
          onContextMenu={setContextMenu}
          updateSchema={updateSchema}
          schemaGroups={schemaGroups}
          modalsOpen={editorState.open || !!connectionModal}
        />
      </Canvas>
      <CanvasToolbar>
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
    </div>
  );
}

interface MetamapV2InnerProps {
  localNodes: MetamapV2Node[];
  setLocalNodes: React.Dispatch<React.SetStateAction<MetamapV2Node[]>>;
  localNodesRef: React.MutableRefObject<MetamapV2Node[]>;
  edges: MetamapV2Edge[];
  onSchemaDoubleClick: (schemaType: string) => void;
  onContextMenu: (menu: { x: number; y: number; schemaType?: string; groupId?: string; packageId?: string }) => void;
  updateSchema: (type: string, updates: { packageId?: string; groupId?: string | undefined }) => void;
  schemaGroups: any[];
  modalsOpen: boolean;
}

function MetamapV2Inner({
  localNodes,
  setLocalNodes,
  localNodesRef,
  edges,
  onSchemaDoubleClick,
  onContextMenu,
  updateSchema,
  schemaGroups,
  modalsOpen,
}: MetamapV2InnerProps) {
  const { transform, ctrlHeld, startConnection } = useCanvasContext();
  const [highlightedContainerId, setHighlightedContainerId] = useState<string | null>(null);

  // Keyboard shortcuts
  const { undo, redo } = useSchemaUndoRedo();
  useKeyboardShortcuts({
    shortcuts: [
      { key: 'z', mod: true, action: undo },
      { key: 'y', mod: true, action: redo },
      { key: 'z', mod: true, shift: true, action: redo },
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

          // Force re-layout after reassignment
          setTimeout(() => {
            window.location.reload(); // Simplest way to force full re-layout
          }, 100);
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
            />
          )}
          {node.type === 'group' && node.data.kind === 'group' && (
            <MetamapGroupNode
              group={node.data.group}
              width={node.size.width}
              height={node.size.height}
              schemaCount={node.data.schemaCount}
              onPointerDown={(e) => handleNodePointerDown(node.id, e)}
            />
          )}
        </div>
      ))}
      {/* Schema nodes rendered on top */}
      {absoluteNodes.filter(n => n.type === 'schema').map(node => (
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
        >
          {node.data.kind === 'schema' && (
            <MetamapSchemaNode
              schema={node.data.schema}
              width={node.size.width}
              height={node.size.height}
              onPointerDown={(e) => handleNodePointerDown(node.id, e)}
              onDoubleClick={() => onSchemaDoubleClick(node.id)}
              onStartConnection={startConnection}
            />
          )}
        </div>
      ))}
    </>
  );
}

// Edge layer component
function MetamapEdgeLayer({ edges, nodes }: { edges: MetamapV2Edge[]; nodes: MetamapV2Node[] }) {
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

        const sx = absX1 + sourceNode.size.width / 2;
        const sy = absY1 + sourceNode.size.height;
        const tx = absX2 + targetNode.size.width / 2;
        const ty = absY2;

        return (
          <g key={edge.id}>
            <line
              x1={sx} y1={sy}
              x2={tx} y2={ty}
              stroke="var(--color-content-subtle)"
              strokeWidth={1.5}
              style={{ pointerEvents: 'none' }}
            />
            {edge.label && (
              <text
                x={(sx + tx) / 2}
                y={(sy + ty) / 2 - 6}
                textAnchor="middle"
                fill="var(--color-content-subtle)"
                fontSize={10}
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
