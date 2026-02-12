import { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  type Connection,
  type Node as RFNode,
  type Edge as RFEdge,
} from '@xyflow/react';
import { resolvePinConstraints } from '@carta/domain';
import type { PinLayoutNode, PinDirection, OrganizerNodeData } from '@carta/domain';
import { useNodes, usePinConstraints } from '../../hooks';
import LayoutOrganizerNode from './LayoutOrganizerNode';
import ContextMenuPrimitive from '../ui/ContextMenuPrimitive';

interface LayoutViewProps {
  onClose: () => void;
}

const layoutNodeTypes = {
  'layout-organizer': LayoutOrganizerNode,
};

function LayoutViewInner({ onClose }: LayoutViewProps) {
  const { nodes: allNodes } = useNodes();
  const { constraints, addConstraint, removeConstraint } = usePinConstraints();

  // Local state for layout view nodes/edges (independent from real canvas)
  const [localNodes, setLocalNodes] = useState<RFNode[]>([]);
  const [localEdges, setLocalEdges] = useState<RFEdge[]>([]);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);

  // Initialize layout nodes from real canvas organizers
  useEffect(() => {
    // Find top-level organizers (no parentId)
    const topLevelOrganizers = allNodes.filter(
      (n): n is RFNode<OrganizerNodeData> => n.type === 'organizer' && !n.parentId
    );

    const layoutNodes: RFNode[] = topLevelOrganizers.map((orgNode) => ({
      id: orgNode.id,
      type: 'layout-organizer',
      position: orgNode.position,
      data: {
        name: orgNode.data.name,
        color: orgNode.data.color,
      },
      style: {
        width: orgNode.measured?.width ?? orgNode.width ?? 400,
        height: orgNode.measured?.height ?? orgNode.height ?? 300,
      },
    }));

    setLocalNodes(layoutNodes);
  }, [allNodes]);

  // Update edges whenever constraints change
  useEffect(() => {
    const edges: RFEdge[] = constraints.map((c) => ({
      id: c.id,
      source: c.sourceOrganizerId,
      sourceHandle: c.direction,
      target: c.targetOrganizerId,
      targetHandle: 'body',
      type: 'default',
      label: c.direction,
      animated: false,
    }));
    setLocalEdges(edges);
  }, [constraints]);

  // Handle new connection from dragging handle to organizer body
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !connection.sourceHandle) return;
      if (connection.source === connection.target) return; // no self-loops
      const direction = connection.sourceHandle as PinDirection;
      addConstraint(connection.source, connection.target, direction);
    },
    [addConstraint]
  );

  // Validate connection to prevent self-loops
  const isValidConnection = useCallback((connection: Connection | RFEdge) => {
    if (connection.source === connection.target) return false;
    return true;
  }, []);

  // Edge context menu handling
  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: RFEdge) => {
    event.preventDefault();
    setEdgeContextMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
  }, []);

  const handleDeleteConstraint = useCallback(() => {
    if (edgeContextMenu) {
      removeConstraint(edgeContextMenu.edgeId);
      setEdgeContextMenu(null);
    }
  }, [edgeContextMenu, removeConstraint]);

  // Test Layout: resolve constraints and update local positions
  const handleTestLayout = useCallback(() => {
    const layoutNodes: PinLayoutNode[] = localNodes.map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      width: (n.style?.width as number) ?? 400,
      height: (n.style?.height as number) ?? 300,
    }));

    const result = resolvePinConstraints(layoutNodes, constraints);

    // Update local node positions
    setLocalNodes((prev) =>
      prev.map((n) => {
        const pos = result.positions.get(n.id);
        return pos ? { ...n, position: { x: pos.x, y: pos.y } } : n;
      })
    );
  }, [localNodes, constraints]);

  return (
    <div className="w-full h-full relative">
      {/* Header bar */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span className="text-sm font-medium text-content">Layout View</span>
        <div className="flex gap-2">
          <button
            onClick={handleTestLayout}
            className="px-3 py-1.5 text-sm rounded bg-surface-depth-1 hover:bg-surface-depth-2 text-content border border-border transition-colors"
          >
            Test Layout
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-surface-depth-1 hover:bg-surface-depth-2 text-content border border-border transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* ReactFlow canvas */}
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        nodeTypes={layoutNodeTypes}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
        onEdgeContextMenu={onEdgeContextMenu}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
      </ReactFlow>

      {/* Edge context menu */}
      {edgeContextMenu && (
        <ContextMenuPrimitive
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          items={[
            {
              key: 'delete',
              label: 'Delete Constraint',
              danger: true,
              onClick: handleDeleteConstraint,
            },
          ]}
          onClose={() => setEdgeContextMenu(null)}
        />
      )}
    </div>
  );
}

// Wrap in ReactFlowProvider since this is a separate ReactFlow instance
export default function LayoutView(props: LayoutViewProps) {
  return (
    <ReactFlowProvider>
      <LayoutViewInner {...props} />
    </ReactFlowProvider>
  );
}
