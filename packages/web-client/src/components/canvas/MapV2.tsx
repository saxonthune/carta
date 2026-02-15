import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Canvas, type CanvasRef, useNodeDrag, useNodeResize, useCanvasContext, ConnectionHandle, useKeyboardShortcuts } from '../../canvas-engine/index.js';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useNodes } from '../../hooks/useNodes';
import { useEdges } from '../../hooks/useEdges';
import { useSchemas } from '../../hooks/useSchemas';
import { usePortSchemas } from '../../hooks/usePortSchemas';
import { useMapNodePipeline } from '../../hooks/useMapNodePipeline';
import { useMapEdgePipeline } from '../../hooks/useMapEdgePipeline';
import { useNarrative } from '../../hooks/useNarrative';
import { useOrganizerOperations } from '../../hooks/useOrganizerOperations';
import { useLayoutActions } from '../../hooks/useLayoutActions';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { usePinConstraints } from '../../hooks/usePinConstraints';
import { useNodeLinks } from '../../canvas-engine/useNodeLinks';
import { findContainerAt } from '../../canvas-engine/containment';
import { useMapState } from '../../hooks/useMapState';
import { useFlowTrace } from '../../hooks/useFlowTrace';
import Narrative from './Narrative';
import MapV2Toolbar from './MapV2Toolbar';
import ContextMenu from '../ui/ContextMenu';
import AddConstructMenu from './AddConstructMenu';
import ConstructEditor from '../ConstructEditor';
import ConstructDebugModal from '../modals/ConstructDebugModal';
import { getRectBoundaryPoint, waypointsToPath, computeBezierPath, type Waypoint } from '../../utils/edgeGeometry.js';
import { canConnect, getHandleType, nodeContainedInOrganizer, type ConstructSchema, getFieldsForSummary, resolveNodeIcon, type ConstructNodeData, type DocumentAdapter } from '@carta/domain';
import { stripHandlePrefix } from '../../utils/handlePrefix.js';
import { generateSemanticId } from '../../utils/cartaFile';
import type { LodBand } from './lod/lodPolicy.js';

interface MapV2Props {
  searchText?: string;
}

// Field list component with editing state
function MapV2FieldList({ schema, constructData, adapter, nodeId }: {
  schema: ConstructSchema;
  constructData: ConstructNodeData;
  adapter: DocumentAdapter;
  nodeId: string;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const fields = getFieldsForSummary(schema);

  if (fields.length === 0) return null;

  return (
    <div style={{ padding: '2px 8px 6px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {fields.map(field => {
        const value = constructData.values[field.name] ?? field.default;
        const isMultiline = field.displayHint === 'multiline' || field.displayHint === 'code';

        const commitValue = (newValue: unknown) => {
          adapter.updateNode(nodeId, { values: { ...constructData.values, [field.name]: newValue } });
          setEditingField(null);
        };

        if (editingField === field.name) {
          return (
            <div key={field.name} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 10, color: 'var(--color-content-subtle)' }}>{field.label}</div>
              {field.type === 'boolean' ? (
                <input type="checkbox" checked={!!value} onChange={(e) => commitValue(e.target.checked)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditingField(null); }}
                  autoFocus style={{ width: 16, height: 16, cursor: 'pointer' }} />
              ) : field.type === 'enum' && field.options ? (
                <select
                  style={{ width: '100%', padding: '2px 4px', backgroundColor: 'var(--color-surface)', borderRadius: 4, fontSize: 11, color: 'var(--color-content)', border: '1px solid var(--color-accent)', outline: 'none' }}
                  value={String(value ?? '')}
                  onChange={(e) => commitValue(e.target.value)}
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditingField(null); }}
                  autoFocus
                >
                  <option value="">Select...</option>
                  {field.options.map(opt => <option key={opt.value} value={opt.value}>{opt.value}</option>)}
                </select>
              ) : isMultiline ? (
                <textarea
                  style={{ width: '100%', padding: '2px 4px', backgroundColor: 'var(--color-surface)', borderRadius: 4, fontSize: 11, color: 'var(--color-content)', border: '1px solid var(--color-accent)', outline: 'none', resize: 'vertical', minHeight: 60, fontFamily: 'monospace' }}
                  defaultValue={String(value ?? '')}
                  onBlur={(e) => commitValue(e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditingField(null); }}
                  autoFocus
                />
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  style={{ width: '100%', padding: '2px 4px', backgroundColor: 'var(--color-surface)', borderRadius: 4, fontSize: 11, color: 'var(--color-content)', border: '1px solid var(--color-accent)', outline: 'none' }}
                  defaultValue={String(value ?? '')}
                  onBlur={(e) => commitValue(field.type === 'number' ? Number(e.target.value) : e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLElement).blur(); if (e.key === 'Escape') setEditingField(null); }}
                  autoFocus
                />
              )}
            </div>
          );
        }

        // Read-only field
        const display = value == null || value === '' ? '—' : String(value);
        return (
          <div key={field.name} style={{ cursor: 'pointer', padding: '1px 4px', margin: '0 -4px', borderRadius: 4 }}
            onClick={(e) => { e.stopPropagation(); setEditingField(field.name); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {isMultiline ? (
              <>
                <div style={{ fontSize: 10, color: 'var(--color-content-subtle)' }}>{field.label}:</div>
                <div style={{ fontSize: 11, color: 'var(--color-content)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'pre-wrap' }}>{display}</div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: 'var(--color-content-subtle)', flexShrink: 0 }}>{field.label}:</span>
                <span style={{ fontSize: 11, color: 'var(--color-content)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {field.type === 'boolean' ? (value ? 'Yes' : 'No') : display}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Inner component that uses canvas context
function MapV2Inner({ sortedNodes, getSchema, getPortSchema, onSelectionChange, attachNodeToOrganizer, detachNodeFromOrganizer, toggleOrganizerCollapse, getFollowers, showNarrative, hideNarrative, coveredNodeIds, onNodeContextMenu, onNodeMouseEnter, onNodeMouseLeave, onNodeDoubleClick }: {
  sortedNodes: any[];
  getSchema: (type: string) => any;
  getPortSchema: (type: string) => any;
  onSelectionChange: (ids: string[]) => void;
  attachNodeToOrganizer: (nodeId: string, organizerId: string) => void;
  detachNodeFromOrganizer: (nodeId: string) => void;
  toggleOrganizerCollapse: (organizerId: string) => void;
  getFollowers: (leaderId: string) => string[];
  showNarrative: (state: any) => void;
  hideNarrative: () => void;
  coveredNodeIds: string[];
  onNodeContextMenu: (e: React.MouseEvent, nodeId: string) => void;
  onNodeMouseEnter: (nodeId: string) => void;
  onNodeMouseLeave: () => void;
  onNodeDoubleClick: (nodeId: string) => void;
}) {
  const { adapter } = useDocumentContext();
  const { transform, isSelected, onNodePointerDown: onSelectPointerDown, selectedIds, startConnection, connectionDrag } = useCanvasContext();

  // LOD band tracking based on zoom level
  const [lodBand, setLodBand] = useState<LodBand>('normal');

  useEffect(() => {
    const zoom = transform.k;
    const band: LodBand = zoom < 0.5 ? 'marker' : 'normal';
    setLodBand(band);
  }, [transform.k]);

  // Sync selection changes to outer component
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    if (selectedIds !== selectedIdsRef.current) {
      selectedIdsRef.current = selectedIds;
      onSelectionChange(selectedIds);
    }
  }, [selectedIds, onSelectionChange]);

  // Refs for stable callback access
  const sortedNodesRef = useRef(sortedNodes);
  useEffect(() => { sortedNodesRef.current = sortedNodes; }, [sortedNodes]);

  // Port drawer hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Drag state
  const [dragOffsets, setDragOffsets] = useState<Map<string, { dx: number; dy: number }>>(new Map());
  const dragOriginRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);
  const lastPointerEventRef = useRef<{ clientX: number; clientY: number; ctrlKey: boolean; metaKey: boolean } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Track pointer events during drag for Ctrl+drag hints
  useEffect(() => {
    if (!dragOriginRef.current) return;

    const handlePointerMove = (e: PointerEvent) => {
      lastPointerEventRef.current = { clientX: e.clientX, clientY: e.clientY, ctrlKey: e.ctrlKey, metaKey: e.metaKey };

      // Throttle narrative updates via rAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      const draggedNodeId = dragOriginRef.current?.nodeId;
      if (!draggedNodeId) return;

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const node = sortedNodesRef.current.find(n => n.id === draggedNodeId);
        if (!node || node.type === 'organizer') return;

        const isCtrl = e.ctrlKey || e.metaKey;
        const targetOrganizerId = findContainerAt(e.clientX, e.clientY);

        if (targetOrganizerId && targetOrganizerId !== node.parentId) {
          const targetOrg = sortedNodesRef.current.find(n => n.id === targetOrganizerId);
          const orgData = targetOrg?.data as any;
          const orgName = orgData?.name ?? 'organizer';

          if (isCtrl) {
            showNarrative({ kind: 'hint', text: `Release to add to ${orgName}`, variant: 'attach', position: { x: e.clientX, y: e.clientY } });
          } else {
            showNarrative({ kind: 'hint', text: `Hold Ctrl to add to ${orgName}`, variant: 'neutral', position: { x: e.clientX, y: e.clientY } });
          }
        } else if (targetOrganizerId && targetOrganizerId === node.parentId) {
          const targetOrg = sortedNodesRef.current.find(n => n.id === targetOrganizerId);
          const orgData = targetOrg?.data as any;
          const orgName = orgData?.name ?? 'organizer';

          if (isCtrl) {
            showNarrative({ kind: 'hint', text: `Release to detach from ${orgName}`, variant: 'detach', position: { x: e.clientX, y: e.clientY } });
          }
        } else if (isCtrl && node.parentId && !targetOrganizerId) {
          const parentOrg = sortedNodesRef.current.find(n => n.id === node.parentId);
          const orgData = parentOrg?.data as any;
          const orgName = orgData?.name ?? 'organizer';
          showNarrative({ kind: 'hint', text: `Release to detach from ${orgName}`, variant: 'detach', position: { x: e.clientX, y: e.clientY } });
        } else {
          hideNarrative();
        }
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [sortedNodesRef, showNarrative, hideNarrative]);

  // Resize state
  const [resizeDeltas, setResizeDeltas] = useState<{ dw: number; dh: number } | null>(null);
  const resizeOriginRef = useRef<{ nodeId: string; width: number; height: number } | null>(null);

  // Node drag hook
  const { onPointerDown: onNodePointerDownDrag } = useNodeDrag({
    zoomScale: transform.k,
    callbacks: {
      onDragStart: (nodeId, event) => {
        const node = sortedNodesRef.current.find(n => n.id === nodeId);
        if (node) {
          dragOriginRef.current = { nodeId, x: node.position.x, y: node.position.y };
        }
        lastPointerEventRef.current = { clientX: event.clientX, clientY: event.clientY, ctrlKey: event.ctrlKey, metaKey: event.metaKey };
      },
      onDrag: (nodeId, deltaX, deltaY) => {
        const origin = dragOriginRef.current;
        if (!origin || origin.nodeId !== nodeId) return;

        // If node is selected, move all selected nodes + their wagon followers
        let idsToMove = selectedIds.includes(nodeId) ? [...selectedIds] : [nodeId];
        const allIdsToMove = new Set(idsToMove);
        for (const id of idsToMove) {
          for (const follower of getFollowers(id)) {
            allIdsToMove.add(follower);
          }
        }

        setDragOffsets(prev => {
          const next = new Map(prev);
          for (const id of allIdsToMove) {
            next.set(id, { dx: deltaX, dy: deltaY });
          }
          return next;
        });
      },
      onDragEnd: (nodeId) => {
        const node = sortedNodesRef.current.find(n => n.id === nodeId);
        const lastEvent = lastPointerEventRef.current;

        // Commit position changes first
        const patches: Array<{ id: string; position: { x: number; y: number } }> = [];
        for (const [id, offset] of dragOffsets) {
          const n = sortedNodesRef.current.find(n => n.id === id);
          if (n) {
            patches.push({ id, position: { x: n.position.x + offset.dx, y: n.position.y + offset.dy } });
          }
        }
        if (patches.length > 0) {
          adapter.patchNodes?.(patches, 'drag-commit');
        }

        // Handle Ctrl+drag attach/detach
        if (lastEvent && node && node.type !== 'organizer') {
          const isModifier = lastEvent.ctrlKey || lastEvent.metaKey;
          if (isModifier) {
            const targetOrganizerId = findContainerAt(lastEvent.clientX, lastEvent.clientY);

            if (targetOrganizerId && targetOrganizerId !== node.parentId) {
              attachNodeToOrganizer(nodeId, targetOrganizerId);
            } else if (node.parentId && !targetOrganizerId) {
              detachNodeFromOrganizer(nodeId);
            }
          }
        }

        setDragOffsets(new Map());
        dragOriginRef.current = null;
        lastPointerEventRef.current = null;
        hideNarrative();
      },
    },
  });

  // Node resize hook
  const { resizingNodeId, onResizePointerDown } = useNodeResize({
    zoomScale: transform.k,
    callbacks: {
      onResizeStart: (nodeId) => {
        const node = sortedNodesRef.current.find(n => n.id === nodeId);
        if (node) {
          resizeOriginRef.current = {
            nodeId,
            width: (node.style?.width as number) ?? 300,
            height: (node.style?.height as number) ?? 200,
          };
        }
      },
      onResize: (nodeId, deltaWidth, deltaHeight) => {
        const origin = resizeOriginRef.current;
        if (!origin || origin.nodeId !== nodeId) return;
        setResizeDeltas({ dw: deltaWidth, dh: deltaHeight });
      },
      onResizeEnd: (nodeId) => {
        const origin = resizeOriginRef.current;
        if (!origin) return;
        const newWidth = Math.max(100, origin.width + (resizeDeltas?.dw ?? 0));
        const newHeight = Math.max(60, origin.height + (resizeDeltas?.dh ?? 0));
        adapter.patchNodes?.([{ id: nodeId, style: { width: newWidth, height: newHeight } }]);
        resizeOriginRef.current = null;
        setResizeDeltas(null);
      },
    },
  });

  // Source port type for connection validation during drag
  const sourcePortType = useMemo(() => {
    if (!connectionDrag) return null;
    const sourceNode = sortedNodes.find(n => n.id === connectionDrag.sourceNodeId);
    if (!sourceNode || sourceNode.type !== 'construct') return null;
    const sourceData = sourceNode.data as Record<string, unknown>;
    const sourceSchema = getSchema((sourceData as any).constructType);
    if (!sourceSchema) return null;
    const sourcePort = sourceSchema.ports?.find((p: any) => p.id === connectionDrag.sourceHandle);
    return sourcePort?.portType ?? null;
  }, [connectionDrag, sortedNodes, getSchema]);

  // Node rendering — now with LOD support, inline editing, sequence badges, and dimmed nodes
  const nodeElements = sortedNodes
    .filter(n => !n.hidden)
    .map(n => {
      const isOrganizer = n.type === 'organizer';
      const data = n.data as Record<string, unknown>;
      const color = (data.color as string) ?? (isOrganizer ? '#7c3aed' : '#6b7280');
      const label = (data.label as string) ?? (data.semanticId as string) ?? n.id;
      let width = (n.style?.width as number) ?? (isOrganizer ? 300 : 200);
      let height = (n.style?.height as number) ?? (isOrganizer ? 200 : 80);

      // Apply resize deltas if this node is being resized
      if (resizingNodeId === n.id && resizeDeltas) {
        width = Math.max(100, width + resizeDeltas.dw);
        height = Math.max(60, height + resizeDeltas.dh);
      }

      // Compute absolute position (children have relative positions)
      let absX = n.position.x;
      let absY = n.position.y;
      if (n.parentId) {
        const parent = sortedNodes.find(p => p.id === n.parentId);
        if (parent) {
          absX += parent.position.x;
          absY += parent.position.y;
        }
      }

      // Apply drag offset if this node is being dragged
      const offset = dragOffsets.get(n.id);
      if (offset) {
        absX += offset.dx;
        absY += offset.dy;
      }

      const selected = isSelected(n.id);
      const schema = !isOrganizer ? getSchema((data as any).constructType) : null;
      const isCovered = coveredNodeIds.includes(n.id);
      const constructData = data as ConstructNodeData;
      const dimmed = (data as any).dimmed;
      const sequenceBadge = (data as any).sequenceBadge;

      // Marker variant rendering (LOD)
      if (!isOrganizer && lodBand === 'marker' && schema && constructData) {
        const icon = resolveNodeIcon(schema, constructData);
        return (
          <div
            key={n.id}
            data-node-id={n.id}
            onPointerDown={(e) => {
              onSelectPointerDown(n.id, e);
              onNodePointerDownDrag(n.id, e);
            }}
            onPointerEnter={() => {
              setHoveredNodeId(n.id);
              onNodeMouseEnter(n.id);
            }}
            onPointerLeave={() => {
              setHoveredNodeId(null);
              onNodeMouseLeave();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onNodeContextMenu(e, n.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onNodeDoubleClick(n.id);
            }}
            style={{
              position: 'absolute',
              left: absX,
              top: absY,
              display: 'flex', alignItems: 'center', gap: 4,
              backgroundColor: 'var(--color-surface)',
              borderLeft: `2px solid ${color}`,
              borderRadius: 4, padding: '2px 8px',
              boxShadow: 'var(--node-shadow)',
              height: 24, minWidth: 180, maxWidth: 500,
              overflow: 'hidden',
              cursor: 'grab',
              outline: selected ? '2px solid var(--color-accent, #3b82f6)' : 'none',
              outlineOffset: '2px',
              opacity: dimmed ? 0.2 : 1,
              pointerEvents: dimmed ? 'none' : 'auto',
              transition: 'opacity 150ms ease',
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
            {icon && <span style={{ fontSize: 12 }}>{icon}</span>}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-content)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {schema.displayName}: {label}
            </span>
          </div>
        );
      }

      // Full node rendering
      return (
        <div
          key={n.id}
          data-node-id={n.id}
          {...(isOrganizer ? { 'data-drop-target': 'true', 'data-container-id': n.id } : {})}
          onPointerDown={(e) => {
            onSelectPointerDown(n.id, e);
            onNodePointerDownDrag(n.id, e);
          }}
          onPointerEnter={() => {
            setHoveredNodeId(n.id);
            onNodeMouseEnter(n.id);
          }}
          onPointerLeave={() => {
            setHoveredNodeId(null);
            onNodeMouseLeave();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            onNodeContextMenu(e, n.id);
          }}
          onDoubleClick={(e) => {
            if (isOrganizer) {
              e.stopPropagation();
              toggleOrganizerCollapse(n.id);
            } else {
              e.stopPropagation();
              onNodeDoubleClick(n.id);
            }
          }}
          style={{
            position: 'absolute',
            left: absX,
            top: absY,
            width,
            height: isOrganizer ? height : 'auto',
            minHeight: isOrganizer ? 0 : height,
            backgroundColor: isOrganizer ? 'transparent' : 'var(--color-surface)',
            border: isOrganizer ? `2px dashed ${color}` : `2px solid ${color}`,
            borderRadius: isOrganizer ? 8 : 6,
            display: 'flex',
            flexDirection: 'column',
            color: isOrganizer ? color : 'var(--color-content)',
            fontSize: 12,
            fontWeight: 500,
            overflow: isOrganizer ? 'hidden' : 'visible',
            cursor: 'grab',
            outline: selected ? '2px solid var(--color-accent, #3b82f6)' : 'none',
            outlineOffset: '2px',
            opacity: dimmed ? 0.2 : (isOrganizer ? 0.6 : 1),
            pointerEvents: dimmed ? 'none' : 'auto',
            transition: 'opacity 150ms ease',
          }}
        >
          {/* Sequence badge */}
          {sequenceBadge != null && !isOrganizer && lodBand !== 'marker' && (
            <div style={{
              position: 'absolute', top: -8, left: -8, zIndex: 10,
              width: 20, height: 20, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 600, lineHeight: 1, pointerEvents: 'none',
              backgroundColor: 'var(--color-surface-alt)',
              color: 'var(--color-content)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              border: '1px solid var(--color-border)',
            }}>
              {sequenceBadge}
            </div>
          )}

          {isOrganizer ? (
            // Organizer label
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
            }}>
              {label}
            </div>
          ) : schema ? (
            // Construct node with schema badge and fields
            <>
              {/* Header with schema badge and label */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                borderBottom: `1px solid ${color}40`,
              }}>
                <div style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  backgroundColor: `${color}20`,
                  color: color,
                  fontSize: 9,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {schema.displayName}
                </div>
                <div style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </div>
              </div>
              {/* Fields with inline editing */}
              <MapV2FieldList schema={schema} constructData={constructData} adapter={adapter} nodeId={n.id} />
            </>
          ) : (
            // Construct without schema (fallback)
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              padding: '0 8px',
            }}>
              {label}
            </div>
          )}

          {/* Covered node warning badge */}
          {isCovered && (
            <div style={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              border: '2px solid var(--color-canvas, white)',
            }}>
              ⚠
            </div>
          )}
          {isOrganizer && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 12,
                height: 12,
                cursor: 'se-resize',
                backgroundColor: color,
                opacity: 0.5,
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onResizePointerDown(n.id, { horizontal: 'right', vertical: 'bottom' }, e);
              }}
            />
          )}
          {/* Port drawer - collapsed state (dots strip) */}
          {!isOrganizer && schema?.ports && schema.ports.length > 0 && !connectionDrag && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              backgroundColor: 'var(--color-surface-alt, rgba(0,0,0,0.1))',
              borderRadius: '0 0 6px 6px',
            }}>
              {schema.ports.map((port: any) => {
                const portSchema = getPortSchema(port.portType);
                return (
                  <div key={port.id} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    backgroundColor: portSchema?.color ?? '#94a3b8',
                  }} />
                );
              })}
            </div>
          )}
          {/* Port drawer - expanded state on hover */}
          {hoveredNodeId === n.id && !isOrganizer && schema?.ports && schema.ports.length > 0 && !connectionDrag && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
              backgroundColor: 'var(--color-surface-elevated, white)',
              border: '1px solid var(--color-border, #e5e7eb)',
              borderRadius: '0 0 8px 8px',
              padding: '6px 8px',
              display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
            }}
            onPointerEnter={() => setHoveredNodeId(n.id)}
            onPointerLeave={() => setHoveredNodeId(null)}
            >
              {schema.ports.map((port: any) => {
                const portSchema = getPortSchema(port.portType);
                const portColor = portSchema?.color ?? '#94a3b8';
                return (
                  <div key={port.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <ConnectionHandle
                      type="source"
                      id={port.id}
                      nodeId={n.id}
                      onStartConnection={startConnection}
                      style={{
                        width: 16, height: 16, borderRadius: '50%',
                        backgroundColor: portColor, border: '2px solid white',
                        cursor: 'crosshair',
                      }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--color-content-muted, #6b7280)' }}>
                      {port.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {/* Drop zones during connection drag */}
          {connectionDrag && connectionDrag.sourceNodeId !== n.id && !isOrganizer && schema?.ports && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              borderRadius: 6, overflow: 'hidden', zIndex: 25,
            }}>
              {schema.ports.map((port: any) => {
                const portSchema = getPortSchema(port.portType);
                const isValid = sourcePortType ? canConnect(sourcePortType, port.portType) : false;
                const portColor = portSchema?.color ?? '#94a3b8';
                return (
                  <ConnectionHandle
                    key={port.id}
                    type="target"
                    id={port.id}
                    nodeId={n.id}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isValid ? portColor + '40' : 'rgba(128,128,128,0.15)',
                      border: isValid ? `2px solid ${portColor}` : '2px dotted rgba(128,128,128,0.4)',
                      pointerEvents: isValid ? 'auto' : 'none',
                      fontSize: 11, fontWeight: 600,
                      color: isValid ? portColor : 'rgba(128,128,128,0.6)',
                    }}
                  >
                    {port.label}
                  </ConnectionHandle>
                );
              })}
            </div>
          )}
        </div>
      );
    });

  return (
    <>
      {nodeElements}
    </>
  );
}

export default function MapV2({ searchText }: MapV2Props) {
  const { nodes, setNodes, getNextNodeId } = useNodes();
  const { edges, setEdges } = useEdges();
  const { schemas, getSchema } = useSchemas();
  const { getPortSchema } = usePortSchemas();
  const { narrative, showNarrative, hideNarrative } = useNarrative();
  const { adapter, ydoc } = useDocumentContext();
  const { toggleOrganizerCollapse } = useOrganizerOperations();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const { constraints: pinConstraints } = usePinConstraints();

  // Track selected IDs for edge pipeline
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // Selection mode state
  const [selectionModeActive, setSelectionModeActive] = useState(false);

  // MapState for context menus and modals
  const {
    contextMenu,
    addMenu,
    editorState,
    debugNodeId,
    setAddMenu,
    setEditorState,
    setDebugNodeId,
    onPaneContextMenu,
    onNodeContextMenu,
    closeContextMenu,
  } = useMapState();

  // Clipboard state (inlined from useClipboard)
  const [clipboard, setClipboard] = useState<any[]>([]);

  // Node pipeline (needs same inputs as Map.tsx)
  // For interaction, pass stub/no-op values for modal-only params:
  const nodeActions = useMemo(() => ({
    onRename: () => {},
    onValuesChange: () => {},
    onInstanceColorChange: () => {},
    onToggleCollapse: () => {},
    onSpreadChildren: () => {},
    onFlowLayoutChildren: () => {},
    onGridLayoutChildren: () => {},
    onFitToChildren: () => {},
    onUpdateOrganizerColor: () => {},
    onRenameOrganizer: () => {},
    onRecursiveLayout: () => {},
    onToggleLayoutPin: () => {},
  }), []);

  // Flow trace (Alt+hover)
  const { traceResult, isTraceActive, onNodeMouseEnter, onNodeMouseLeave } = useFlowTrace(edges);

  const { sortedNodes, edgeRemap } = useMapNodePipeline({
    nodes,
    edges,
    renamingNodeId: null,
    renamingOrganizerId: null,
    isTraceActive,
    traceResult,
    nodeActions,
    orgRenameStart: () => {},
    orgRenameStop: () => {},
    searchText,
    getSchema,
  });

  const { displayEdges } = useMapEdgePipeline({
    edges,
    sortedNodes,
    edgeRemap,
    selectedNodeIds,
    schemas,
    getSchema,
    getPortSchema,
    isTraceActive,
    traceResult,
    nodes,
  });

  // ReactFlow shim for useLayoutActions
  const reactFlowShim = useMemo(() => ({
    getNodes: () => sortedNodes,
    setNodes: (updater: any) => setNodes(updater),
    getEdges: () => displayEdges,
    getIntersectingNodes: () => [], // Not used by attach/detach
  }), [sortedNodes, displayEdges, setNodes]);

  // Layout actions
  const {
    attachNodeToOrganizer,
    detachNodeFromOrganizer,
    spreadAll,
    compactAll,
    flowLayout,
    alignNodes,
    distributeNodes,
    routeEdges,
    clearRoutes,
    applyPinLayout,
  } = useLayoutActions({
    reactFlow: reactFlowShim as any,
    setNodesLocal: setNodes,
    adapter,
    selectedNodeIds,
    ydoc,
  });

  // Wagon links for leader/follower drag
  const wagonLinks = useMemo(() => {
    return sortedNodes
      .filter(n => n.type === 'organizer' && n.parentId && (n.data as any).attachedToSemanticId)
      .map(n => ({
        id: `wagon-${n.id}`,
        leader: n.parentId!, // the construct
        follower: n.id,      // the wagon organizer
      }));
  }, [sortedNodes]);

  const { getFollowers } = useNodeLinks({ links: wagonLinks });

  // Covered nodes detection (inline, no hook dependency on ReactFlow)
  const coveredNodeIds = useMemo(() => {
    const visibleOrganizers = sortedNodes.filter(n => n.type === 'organizer' && !n.hidden);
    if (visibleOrganizers.length === 0) return [];
    const covered: string[] = [];
    for (const node of sortedNodes) {
      if (node.type === 'organizer' || node.hidden || node.parentId) continue;
      const nodeW = node.measured?.width ?? node.width ?? 200;
      const nodeH = node.measured?.height ?? node.height ?? 100;
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
  }, [sortedNodes]);

  // Clipboard operations (inlined from useClipboard to avoid RF dependency)
  const copyNodes = useCallback((ids?: string[]) => {
    const idsToCopy = ids || selectedNodeIds;
    if (idsToCopy.length === 0) return;
    const toCopy = sortedNodes.filter(n => idsToCopy.includes(n.id));
    setClipboard(JSON.parse(JSON.stringify(toCopy)));
  }, [sortedNodes, selectedNodeIds]);

  const pasteNodes = useCallback((x?: number, y?: number) => {
    if (clipboard.length === 0) return;
    const minX = Math.min(...clipboard.map(n => n.position.x));
    const minY = Math.min(...clipboard.map(n => n.position.y));

    let basePosition = { x: minX + 50, y: minY + 50 };
    if (x !== undefined && y !== undefined) {
      const canvasPos = canvasRef.current?.screenToCanvas(x, y);
      if (canvasPos) {
        basePosition = canvasPos;
      }
    }

    const newNodes = clipboard.map(clipNode => ({
      ...clipNode,
      id: getNextNodeId(),
      position: { x: basePosition.x + (clipNode.position.x - minX), y: basePosition.y + (clipNode.position.y - minY) },
      selected: true,
      data: { ...clipNode.data, semanticId: generateSemanticId(clipNode.data.constructType) },
    }));

    setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), ...newNodes]);
  }, [clipboard, setNodes, getNextNodeId]);

  // Graph operations (inlined from useGraphOperations to avoid RF dependency)
  const addConstruct = useCallback((schema: ConstructSchema, x: number, y: number) => {
    const canvasPos = canvasRef.current?.screenToCanvas(x, y);
    if (!canvasPos) return;

    const id = getNextNodeId();
    const values: any = {};
    if (Array.isArray(schema.fields)) {
      schema.fields.forEach((field) => {
        if (field.default !== undefined) {
          values[field.name] = field.default;
        }
      });
    }

    const semanticId = generateSemanticId(schema.type);
    const newNode: any = {
      id,
      type: 'construct',
      position: canvasPos,
      data: {
        constructType: schema.type,
        semanticId,
        values,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, getNextNodeId]);

  const addNode = useCallback((x?: number, y?: number) => {
    if (x !== undefined && y !== undefined) {
      setAddMenu({ x, y });
    } else {
      setAddMenu({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  }, [setAddMenu]);

  const deleteNode = useCallback((nodeIdToDelete: string) => {
    setNodes((nds) => {
      const idsToDelete = new Set([nodeIdToDelete]);
      const findDescendants = (parentId: string, depth = 0) => {
        if (depth > 20) return;
        for (const n of nds) {
          if (n.parentId === parentId && !idsToDelete.has(n.id)) {
            idsToDelete.add(n.id);
            findDescendants(n.id, depth + 1);
          }
        }
      };
      findDescendants(nodeIdToDelete);
      return nds.filter((n) => !idsToDelete.has(n.id));
    });
    setEdges((eds) => eds.filter((e) => !nodeIdToDelete || (e.source !== nodeIdToDelete && e.target !== nodeIdToDelete)));
  }, [setNodes, setEdges]);

  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    setNodes((nds) => {
      const idsToDelete = new Set(selectedNodeIds);
      for (const id of selectedNodeIds) {
        const findDescendants = (parentId: string, depth = 0) => {
          if (depth > 20) return;
          for (const n of nds) {
            if (n.parentId === parentId && !idsToDelete.has(n.id)) {
              idsToDelete.add(n.id);
              findDescendants(n.id, depth + 1);
            }
          }
        };
        findDescendants(id);
      }
      return nds.filter((n) => !idsToDelete.has(n.id));
    });
    setEdges((eds) => eds.filter((e) => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)));
    setSelectedNodeIds([]);
  }, [selectedNodeIds, setNodes, setEdges]);

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [setEdges]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      { key: 'z', mod: true, action: undo },
      { key: 'y', mod: true, action: redo },
      { key: 'z', mod: true, shift: true, action: redo },
      { key: 'c', mod: true, action: () => copyNodes() },
      { key: 'v', mod: true, action: () => pasteNodes() },
      { key: 'a', mod: true, action: () => {
        const selectableIds = sortedNodes.filter(n => !n.hidden && n.type !== 'organizer').map(n => n.id);
        setSelectedNodeIds(selectableIds);
      }},
      { key: ['Delete', 'Backspace'], action: deleteSelectedNodes },
      { key: 'v', action: () => setSelectionModeActive(prev => !prev) },
    ],
  });

  // Canvas ref + fit view on mount
  const canvasRef = useRef<CanvasRef>(null);

  // Fit view handler
  const handleFitView = useCallback(() => {
    const rects = sortedNodes
      .filter(n => !n.hidden && !n.parentId) // top-level only
      .map(n => ({
        x: n.position.x,
        y: n.position.y,
        width: (n.style?.width as number) ?? (n.type === 'organizer' ? 300 : 200),
        height: (n.style?.height as number) ?? (n.type === 'organizer' ? 200 : 80),
      }));
    canvasRef.current?.fitView(rects, 0.1);
  }, [sortedNodes]);

  // Fit view after first render
  const fitDone = useRef(false);
  useEffect(() => {
    if (sortedNodes.length > 0 && !fitDone.current && canvasRef.current) {
      handleFitView();
      fitDone.current = true;
    }
  }, [sortedNodes, handleFitView]);

  // Helper to compute absolute positions for box select
  const getAbsolutePosition = useCallback((n: any) => {
    let absX = n.position.x;
    let absY = n.position.y;
    if (n.parentId) {
      const parent = sortedNodes.find(p => p.id === n.parentId);
      if (parent) {
        absX += parent.position.x;
        absY += parent.position.y;
      }
    }
    return { x: absX, y: absY };
  }, [sortedNodes]);

  // Connection validation
  const handleValidateConnection = useCallback((conn: {
    source: string; sourceHandle: string;
    target: string; targetHandle: string;
  }) => {
    if (conn.source === conn.target) return false;
    if (!conn.sourceHandle || !conn.targetHandle) return false;

    const cleanSourceHandle = stripHandlePrefix(conn.sourceHandle);
    const cleanTargetHandle = stripHandlePrefix(conn.targetHandle);

    const sourceNode = nodes.find(n => n.id === conn.source);
    const targetNode = nodes.find(n => n.id === conn.target);
    if (!sourceNode || !targetNode) return false;
    if (sourceNode.type !== 'construct' || targetNode.type !== 'construct') return true;

    const sourceData = sourceNode.data as Record<string, unknown>;
    const targetData = targetNode.data as Record<string, unknown>;
    const sourceSchema = getSchema((sourceData as any).constructType);
    const targetSchema = getSchema((targetData as any).constructType);
    if (!sourceSchema || !targetSchema) return false;

    const sourcePort = sourceSchema.ports?.find((p: any) => p.id === cleanSourceHandle);
    const targetPort = targetSchema.ports?.find((p: any) => p.id === cleanTargetHandle);
    if (!sourcePort || !targetPort) return false;

    return canConnect(sourcePort.portType, targetPort.portType);
  }, [nodes, getSchema]);

  // Connection creation
  const handleConnect = useCallback((conn: {
    source: string; sourceHandle: string;
    target: string; targetHandle: string;
  }) => {
    const cleanSourceHandle = stripHandlePrefix(conn.sourceHandle);
    const cleanTargetHandle = stripHandlePrefix(conn.targetHandle);

    const sourceNode = nodes.find(n => n.id === conn.source);
    const targetNode = nodes.find(n => n.id === conn.target);
    if (!sourceNode || !targetNode) return;
    if (sourceNode.type !== 'construct' || targetNode.type !== 'construct') return;

    const sourceData = sourceNode.data as Record<string, unknown>;
    const targetData = targetNode.data as Record<string, unknown>;
    const sourceSchema = getSchema((sourceData as any).constructType);
    const targetSchema = getSchema((targetData as any).constructType);
    if (!sourceSchema || !targetSchema) return;

    const sourcePort = sourceSchema.ports?.find((p: any) => p.id === cleanSourceHandle);
    const targetPort = targetSchema.ports?.find((p: any) => p.id === cleanTargetHandle);
    if (!sourcePort || !targetPort) return;

    // Normalize direction: ensure source has 'source' handle type
    const sourceHandleType = getHandleType(sourcePort.portType);
    const targetHandleType = getHandleType(targetPort.portType);
    const needsFlip = sourceHandleType === 'target' && targetHandleType === 'source';

    const normalized = needsFlip
      ? { source: conn.target, sourceHandle: cleanTargetHandle, target: conn.source, targetHandle: cleanSourceHandle }
      : { source: conn.source, sourceHandle: cleanSourceHandle, target: conn.target, targetHandle: cleanTargetHandle };

    // Add edge via setEdges
    setEdges((eds) => {
      const newEdge = {
        id: `e-${normalized.source}-${normalized.sourceHandle}-${normalized.target}-${normalized.targetHandle}`,
        source: normalized.source,
        sourceHandle: normalized.sourceHandle,
        target: normalized.target,
        targetHandle: normalized.targetHandle,
      };
      // Check for duplicate
      const exists = eds.some(e =>
        e.source === newEdge.source &&
        e.sourceHandle === newEdge.sourceHandle &&
        e.target === newEdge.target &&
        e.targetHandle === newEdge.targetHandle
      );
      if (exists) return eds;
      return [...eds, newEdge];
    });
  }, [nodes, getSchema, setEdges]);

  // Node double-click handler
  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    const node = sortedNodes.find(n => n.id === nodeId);
    if (!node || node.type === 'organizer') return;
    const schema = getSchema((node.data as any).constructType);
    if (schema) {
      setEditorState({ open: true, editSchema: schema });
    }
  }, [sortedNodes, getSchema, setEditorState]);

  // Node context menu handler
  const handleNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    onNodeContextMenu(e, { id: nodeId } as any);
  }, [onNodeContextMenu]);

  // Edge click handler
  const handleEdgeClick = useCallback((edge: any, event: React.MouseEvent) => {
    // Select source + target nodes
    setSelectedNodeIds([edge.source, edge.target]);

    // Build narrative endpoint data
    const sourceNode = sortedNodes.find(n => n.id === edge.source);
    const targetNode = sortedNodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const sourceData = sourceNode.data as Record<string, unknown>;
    const targetData = targetNode.data as Record<string, unknown>;
    const sourceName = (sourceData.label as string) ?? (sourceData.semanticId as string) ?? edge.source;
    const targetName = (targetData.label as string) ?? (targetData.semanticId as string) ?? edge.target;

    // Get port colors
    const sourceSchema = getSchema((sourceData as any).constructType);
    const targetSchema = getSchema((targetData as any).constructType);
    const sourcePort = sourceSchema?.ports?.find((p: any) => p.id === edge.sourceHandle);
    const targetPort = targetSchema?.ports?.find((p: any) => p.id === edge.targetHandle);
    const sourcePortSchema = sourcePort ? getPortSchema(sourcePort.portType) : null;
    const targetPortSchema = targetPort ? getPortSchema(targetPort.portType) : null;

    showNarrative({
      kind: 'edge',
      from: {
        name: sourceName,
        schemaType: sourceSchema?.displayName ?? '',
        portLabel: edge.sourceHandle ?? '',
        portColor: sourcePortSchema?.color ?? '#94a3b8',
      },
      to: {
        name: targetName,
        schemaType: targetSchema?.displayName ?? '',
        portLabel: edge.targetHandle ?? '',
        portColor: targetPortSchema?.color ?? '#94a3b8',
      },
      position: { x: event.clientX, y: event.clientY },
      anchor: 'above',
    });
  }, [sortedNodes, getSchema, getPortSchema, showNarrative]);

  // Edge rendering — bezier paths with dynamic anchors
  const renderEdges = useCallback(() => {
    // Build node rect lookup
    const nodeRects = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const n of sortedNodes) {
      if (n.hidden) continue;
      const w = (n.style?.width as number) ?? (n.type === 'organizer' ? 300 : 200);
      const h = (n.style?.height as number) ?? (n.type === 'organizer' ? 200 : 80);
      let x = n.position.x;
      let y = n.position.y;
      if (n.parentId) {
        const parent = sortedNodes.find(p => p.id === n.parentId);
        if (parent) { x += parent.position.x; y += parent.position.y; }
      }
      nodeRects.set(n.id, { x, y, width: w, height: h });
    }

    return displayEdges.filter(e => !e.hidden).map(e => {
      const srcRect = nodeRects.get(e.source);
      const tgtRect = nodeRects.get(e.target);
      if (!srcRect || !tgtRect) return null;

      const srcCenter = { x: srcRect.x + srcRect.width / 2, y: srcRect.y + srcRect.height / 2 };
      const tgtCenter = { x: tgtRect.x + tgtRect.width / 2, y: tgtRect.y + tgtRect.height / 2 };

      const srcBoundary = getRectBoundaryPoint(srcRect, tgtCenter);
      const tgtBoundary = getRectBoundaryPoint(tgtRect, srcCenter);

      const dataRecord = e.data as Record<string, unknown> | undefined;
      const waypoints = dataRecord?.waypoints as Waypoint[] | undefined;
      const polarity = dataRecord?.polarity as string | undefined;
      const dimmed = dataRecord?.dimmed as boolean | undefined;
      const bundleCount = (dataRecord?.bundleCount as number) ?? 1;
      const isBundled = bundleCount > 1;
      const showArrow = polarity !== 'bidirectional';

      let edgePath: string;
      let labelX: number;
      let labelY: number;

      if (waypoints && waypoints.length >= 2) {
        edgePath = waypointsToPath(waypoints);
        const mid = Math.floor(waypoints.length / 2);
        labelX = waypoints[mid].x;
        labelY = waypoints[mid].y;
      } else {
        const result = computeBezierPath(
          srcBoundary.x, srcBoundary.y, srcBoundary.side,
          tgtBoundary.x, tgtBoundary.y, tgtBoundary.side,
        );
        edgePath = result.path;
        labelX = result.labelX;
        labelY = result.labelY;
      }

      const color = (e.style?.stroke as string) ?? 'var(--edge-default-color, #94a3b8)';
      const strokeWidth = isBundled ? Math.min(1.5 + (bundleCount - 1) * 1, 6) : 1.5;
      const opacity = dimmed ? 0.15 : 0.8;

      return (
        <g key={e.id}>
          {/* Wider invisible path for click targeting */}
          <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20}
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onClick={(ev) => handleEdgeClick(e, ev)} />
          <path d={edgePath} fill="none" stroke={color} strokeWidth={strokeWidth}
            opacity={opacity}
            markerEnd={showArrow ? 'url(#carta-arrow-end)' : undefined}
            style={{ pointerEvents: 'none' }} />
          {isBundled && !dimmed && (
            <g transform={`translate(${labelX}, ${labelY})`}>
              <circle r={10} fill="var(--color-surface, white)" stroke={color} strokeWidth={1.5} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}
                fill="var(--color-content-muted, #6b7280)" style={{ pointerEvents: 'none' }}>
                {bundleCount}
              </text>
            </g>
          )}
        </g>
      );
    });
  }, [sortedNodes, displayEdges, handleEdgeClick]);

  // Connection preview rendering
  const renderConnectionPreview = useCallback((drag: any, transform: any) => {
    const sourceNode = sortedNodes.find(n => n.id === drag.sourceNodeId);
    if (!sourceNode) return null;
    const { x: absX, y: absY } = getAbsolutePosition(sourceNode);
    const w = (sourceNode.style?.width as number) ?? 200;
    const h = (sourceNode.style?.height as number) ?? 80;

    const sx = absX + w / 2;
    const sy = absY + h;
    const canvasPos = canvasRef.current?.screenToCanvas(drag.currentX, drag.currentY);
    if (!canvasPos) return null;

    return (
      <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
        <line x1={sx} y1={sy} x2={canvasPos.x} y2={canvasPos.y}
          stroke="var(--color-accent, #3b82f6)" strokeWidth={2} strokeDasharray="4 4"
          style={{ pointerEvents: 'none' }} />
      </g>
    );
  }, [sortedNodes, getAbsolutePosition, canvasRef]);

  return (
    <div
      style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-canvas)', position: 'relative' }}
      onContextMenu={(e) => {
        // Only fire pane context menu if clicking on the background (not on nodes/edges)
        const target = e.target as HTMLElement;
        if (target.closest('[data-node-id]') || target.closest('path')) return;
        onPaneContextMenu(e);
      }}
    >
      {/* SVG arrow marker definition */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <marker id="carta-arrow-end" viewBox="0 0 10 10" refX="10" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--edge-default-color, #94a3b8)" />
          </marker>
        </defs>
      </svg>
      <Canvas
        ref={canvasRef}
        viewportOptions={{ minZoom: 0.05, maxZoom: 3 }}
        renderEdges={renderEdges}
        renderConnectionPreview={renderConnectionPreview}
        connectionDrag={{
          onConnect: handleConnect,
          isValidConnection: handleValidateConnection,
        }}
        patternId="mapv2-grid"
        boxSelect={{
          getNodeRects: () => sortedNodes.filter(n => !n.hidden && n.type !== 'organizer').map(n => {
            const { x, y } = getAbsolutePosition(n);
            return {
              id: n.id,
              x,
              y,
              width: (n.style?.width as number) ?? 200,
              height: (n.style?.height as number) ?? 80,
            };
          }),
        }}
        onBackgroundPointerDown={() => {
          canvasRef.current?.clearSelection();
          setSelectedNodeIds([]);
        }}
      >
        <MapV2Inner
          sortedNodes={sortedNodes}
          getSchema={getSchema}
          getPortSchema={getPortSchema}
          onSelectionChange={setSelectedNodeIds}
          attachNodeToOrganizer={attachNodeToOrganizer}
          detachNodeFromOrganizer={detachNodeFromOrganizer}
          toggleOrganizerCollapse={toggleOrganizerCollapse}
          getFollowers={getFollowers}
          showNarrative={showNarrative}
          hideNarrative={hideNarrative}
          coveredNodeIds={coveredNodeIds}
          onNodeContextMenu={handleNodeContextMenu}
          onNodeMouseEnter={(nodeId) => onNodeMouseEnter({} as any, { id: nodeId } as any)}
          onNodeMouseLeave={() => onNodeMouseLeave({} as any, {} as any)}
          onNodeDoubleClick={handleNodeDoubleClick}
        />
      </Canvas>
      <MapV2Toolbar
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onFitView={handleFitView}
        onSpreadAll={spreadAll}
        onCompactAll={compactAll}
        onFlowLayout={flowLayout}
        onAlignNodes={alignNodes}
        onDistributeNodes={distributeNodes}
        onRouteEdges={routeEdges}
        onClearRoutes={clearRoutes}
        onApplyPinLayout={applyPinLayout}
        selectionModeActive={selectionModeActive}
        onToggleSelectionMode={() => setSelectionModeActive(prev => !prev)}
        hasSelection={selectedNodeIds.length > 0}
        hasPinConstraints={pinConstraints.length > 0}
      />
      <Narrative narrative={narrative} onDismiss={hideNarrative} />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          nodeId={contextMenu.nodeId}
          edgeId={contextMenu.edgeId}
          selectedCount={selectedNodeIds.length}
          onAddNode={addNode}
          onAddConstruct={(constructType, x, y) => {
            const schema = getSchema(constructType);
            if (schema) addConstruct(schema, x, y);
          }}
          onDeleteNode={deleteNode}
          onDeleteSelected={deleteSelectedNodes}
          onDeleteEdge={deleteEdge}
          onCopyNodes={copyNodes}
          onPasteNodes={pasteNodes}
          canPaste={clipboard.length > 0}
          onClose={closeContextMenu}
          onNewConstructSchema={() => setEditorState({ open: true })}
          onEditSchema={(schemaType) => {
            const schema = getSchema(schemaType);
            if (schema) setEditorState({ open: true, editSchema: schema });
          }}
          constructType={(() => {
            if (!contextMenu.nodeId) return undefined;
            const node = nodes.find(n => n.id === contextMenu.nodeId);
            return node?.type === 'construct' ? (node.data as any).constructType : undefined;
          })()}
          nodeIsConstruct={(() => {
            if (!contextMenu.nodeId) return false;
            const node = nodes.find(n => n.id === contextMenu.nodeId);
            return node?.type === 'construct';
          })()}
          nodeInOrganizer={(() => {
            if (!contextMenu.nodeId) return false;
            const node = nodes.find(n => n.id === contextMenu.nodeId);
            if (!node?.parentId) return false;
            const parent = nodes.find(n => n.id === node.parentId);
            return parent?.type === 'organizer';
          })()}
          nodeIsOrganizer={(() => {
            if (!contextMenu.nodeId) return false;
            const node = nodes.find(n => n.id === contextMenu.nodeId);
            return node?.type === 'organizer';
          })()}
          onDebugInfo={(nodeId) => { setDebugNodeId(nodeId); closeContextMenu(); }}
        />
      )}

      {/* Add Construct Menu */}
      {addMenu && (
        <AddConstructMenu
          x={addMenu.x}
          y={addMenu.y}
          onAdd={addConstruct}
          onClose={() => setAddMenu(null)}
        />
      )}

      {/* Construct Editor (Schema Editor) */}
      {editorState.open && (
        <ConstructEditor
          editSchema={editorState.editSchema}
          onClose={() => setEditorState({ open: false })}
        />
      )}

      {/* Debug Modal */}
      {debugNodeId && (() => {
        const node = nodes.find(n => n.id === debugNodeId);
        if (!node || node.type === 'organizer') return null;
        const data = node.data as any;
        const schema = schemas.find(s => s.type === data.constructType);
        return (
          <ConstructDebugModal
            node={node}
            schema={schema}
            onClose={() => setDebugNodeId(null)}
          />
        );
      })()}
    </div>
  );
}
