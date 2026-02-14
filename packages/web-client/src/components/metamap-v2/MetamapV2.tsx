import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Canvas, type CanvasRef, useCanvasContext, useNodeDrag, findContainerAt } from '../../canvas-engine/index.js';
import { useSchemas } from '../../hooks/useSchemas.js';
import { useSchemaGroups } from '../../hooks/useSchemaGroups.js';
import { useSchemaPackages } from '../../hooks/useSchemaPackages.js';
import { computeMetamapV2Layout, type MetamapV2Node, type MetamapV2Edge } from '../../utils/metamapV2Layout.js';
import { MetamapSchemaNode } from './MetamapSchemaNode.js';
import { MetamapPackageNode } from './MetamapPackageNode.js';
import { MetamapGroupNode } from './MetamapGroupNode.js';
import CanvasToolbar, { ToolbarButton, ToolbarDivider } from '../canvas/CanvasToolbar.js';
import { MagnifyingGlassPlus, MagnifyingGlassMinus, CornersOut, ArrowsClockwise } from '@phosphor-icons/react';
import ConstructEditor from '../ConstructEditor.js';
import type { ConstructSchema } from '@carta/domain';

export default function MetamapV2() {
  const { schemas, updateSchema, getSchema } = useSchemas();
  const { schemaGroups } = useSchemaGroups();
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

  const handleSchemaDoubleClick = useCallback((schemaType: string) => {
    const schema = getSchema(schemaType);
    if (schema) setEditorState({ open: true, editSchema: schema });
  }, [getSchema]);

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
    <div className="w-full h-full relative">
      <Canvas
        ref={canvasRef}
        viewportOptions={{ minZoom: 0.1, maxZoom: 2 }}
        renderEdges={() => null}
        className="w-full h-full"
      >
        <MetamapV2Inner
          localNodes={localNodes}
          setLocalNodes={setLocalNodes}
          localNodesRef={localNodesRef}
          edges={layoutResult.edges}
          onSchemaDoubleClick={handleSchemaDoubleClick}
          updateSchema={updateSchema}
          schemaGroups={schemaGroups}
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
    </div>
  );
}

interface MetamapV2InnerProps {
  localNodes: MetamapV2Node[];
  setLocalNodes: React.Dispatch<React.SetStateAction<MetamapV2Node[]>>;
  localNodesRef: React.MutableRefObject<MetamapV2Node[]>;
  edges: MetamapV2Edge[];
  onSchemaDoubleClick: (schemaType: string) => void;
  updateSchema: (type: string, updates: { packageId?: string; groupId?: string | undefined }) => void;
  schemaGroups: any[];
}

function MetamapV2Inner({
  localNodes,
  setLocalNodes,
  localNodesRef,
  edges,
  onSchemaDoubleClick,
  updateSchema,
  schemaGroups,
}: MetamapV2InnerProps) {
  const { transform, ctrlHeld } = useCanvasContext();
  const [highlightedContainerId, setHighlightedContainerId] = useState<string | null>(null);

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

  // Render edges
  const edgeElements = useMemo(() => {
    return edges.map(edge => {
      const sourceNode = absoluteNodes.find(n => n.id === edge.source);
      const targetNode = absoluteNodes.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return null;

      const sx = sourceNode.absolutePosition.x + sourceNode.size.width / 2;
      const sy = sourceNode.absolutePosition.y + sourceNode.size.height;
      const tx = targetNode.absolutePosition.x + targetNode.size.width / 2;
      const ty = targetNode.absolutePosition.y;

      return (
        <g key={edge.id}>
          <line
            x1={sx} y1={sy}
            x2={tx} y2={ty}
            stroke="var(--color-content-subtle)"
            strokeWidth={1.5}
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
    });
  }, [edges, absoluteNodes]);

  return (
    <>
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {edgeElements}
      </svg>
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
        >
          {node.data.kind === 'schema' && (
            <MetamapSchemaNode
              schema={node.data.schema}
              width={node.size.width}
              height={node.size.height}
              onPointerDown={(e) => handleNodePointerDown(node.id, e)}
              onDoubleClick={() => onSchemaDoubleClick(node.id)}
            />
          )}
        </div>
      ))}
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
