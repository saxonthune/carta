import { useRef, useEffect, useMemo } from 'react';
import { Canvas, type CanvasRef } from '../../canvas-engine/index.js';
import { useSchemas } from '../../hooks/useSchemas.js';
import { useSchemaGroups } from '../../hooks/useSchemaGroups.js';
import { useSchemaPackages } from '../../hooks/useSchemaPackages.js';
import { computeMetamapV2Layout, type MetamapV2Node } from '../../utils/metamapV2Layout.js';
import { MetamapSchemaNode } from './MetamapSchemaNode.js';
import { MetamapPackageNode } from './MetamapPackageNode.js';
import { MetamapGroupNode } from './MetamapGroupNode.js';

export default function MetamapV2() {
  const { schemas } = useSchemas();
  const { schemaGroups } = useSchemaGroups();
  const { schemaPackages } = useSchemaPackages();
  const canvasRef = useRef<CanvasRef>(null);

  const { nodes, edges } = useMemo(
    () => computeMetamapV2Layout(schemas, schemaGroups, schemaPackages),
    [schemas, schemaGroups, schemaPackages]
  );

  // Fit view on mount
  const fitViewDoneRef = useRef(false);
  useEffect(() => {
    if (nodes.length > 0 && !fitViewDoneRef.current && canvasRef.current) {
      canvasRef.current.fitView(
        nodes.map(n => ({ x: n.position.x, y: n.position.y, width: n.size.width, height: n.size.height })),
        0.15
      );
      fitViewDoneRef.current = true;
    }
  }, [nodes]);

  // Render edges as simple lines
  const renderEdges = useMemo(() => {
    return () => (
      <>
        {edges.map(edge => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          // Use absolute positions (resolve parent offsets)
          const sx = getAbsoluteX(sourceNode, nodes) + sourceNode.size.width / 2;
          const sy = getAbsoluteY(sourceNode, nodes) + sourceNode.size.height;
          const tx = getAbsoluteX(targetNode, nodes) + targetNode.size.width / 2;
          const ty = getAbsoluteY(targetNode, nodes);

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
        })}
      </>
    );
  }, [edges, nodes]);

  return (
    <Canvas
      ref={canvasRef}
      viewportOptions={{ minZoom: 0.1, maxZoom: 2 }}
      renderEdges={renderEdges}
      className="w-full h-full"
    >
      {/* Container nodes (packages + groups) rendered first */}
      {nodes.filter(n => n.type === 'package' || n.type === 'group').map(node => (
        <div
          key={node.id}
          style={{
            position: 'absolute',
            left: node.position.x,
            top: node.position.y,
          }}
        >
          {node.type === 'package' && node.data.kind === 'package' && (
            <MetamapPackageNode
              pkg={node.data.pkg}
              width={node.size.width}
              height={node.size.height}
              schemaCount={node.data.schemaCount}
            />
          )}
          {node.type === 'group' && node.data.kind === 'group' && (
            <MetamapGroupNode
              group={node.data.group}
              width={node.size.width}
              height={node.size.height}
              schemaCount={node.data.schemaCount}
            />
          )}
        </div>
      ))}
      {/* Schema nodes rendered on top */}
      {nodes.filter(n => n.type === 'schema').map(node => (
        <div
          key={node.id}
          style={{
            position: 'absolute',
            left: node.position.x,
            top: node.position.y,
          }}
        >
          {node.data.kind === 'schema' && (
            <MetamapSchemaNode
              schema={node.data.schema}
              width={node.size.width}
              height={node.size.height}
            />
          )}
        </div>
      ))}
    </Canvas>
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
