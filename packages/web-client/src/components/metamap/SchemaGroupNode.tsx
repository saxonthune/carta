import { memo } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';

export interface SchemaGroupNodeData {
  groupId: string;
  label: string;
  color: string;
  description?: string;
  isHovered?: boolean;
  isExpanded?: boolean;
  isDimmed?: boolean;
  schemaCount?: number;
  depth?: number;
  parentGroupName?: string;
  [key: string]: unknown;
}

type SchemaGroupNodeProps = NodeProps & {
  data: SchemaGroupNodeData;
};

function SchemaGroupNode({ data, selected }: SchemaGroupNodeProps) {
  const { label, color, isHovered, isExpanded = true, isDimmed, schemaCount = 0, depth = 0, parentGroupName } = data;

  // Collapsed chip rendering
  if (!isExpanded) {
    return (
      <div
        className="transition-all duration-200 cursor-pointer"
        style={{
          opacity: isDimmed ? 0.2 : 1,
          pointerEvents: isDimmed ? 'none' : 'auto',
        }}
      >
        {/* Hidden handle for edge connections to collapsed groups */}
        <Handle
          id="group-connect"
          type="source"
          position={Position.Right}
          className="!w-0 !h-0 !border-0 !bg-transparent !min-w-0 !min-h-0"
          style={{ right: 0, top: '50%' }}
        />
        <Handle
          id="group-connect"
          type="target"
          position={Position.Left}
          className="!w-0 !h-0 !border-0 !bg-transparent !min-w-0 !min-h-0"
          style={{ left: 0, top: '50%' }}
        />
        <div
          className="node-drag-handle flex items-center gap-2 px-3 py-2 rounded-full select-none"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} ${isHovered ? 25 : 12}%, var(--color-canvas))`,
            border: `1px solid color-mix(in srgb, ${color} ${isHovered ? 50 : 30}%, var(--color-canvas))`,
            boxShadow: isHovered
              ? `0 0 0 3px ${color}40, 0 0 16px ${color}25`
              : selected
                ? `0 0 0 2px ${color}30`
                : '0 1px 3px rgba(0,0,0,0.08)',
            minWidth: 140,
          }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-node-xs font-medium text-content truncate text-halo">{label}</span>
          <span
            className="text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: `color-mix(in srgb, ${color} 20%, var(--color-canvas))`,
              color: `color-mix(in srgb, ${color} 80%, var(--color-content))`,
            }}
          >
            {schemaCount}
          </span>
        </div>
      </div>
    );
  }

  // Expanded rendering (current full layout)
  const bgMix = isHovered ? 20 : 10 + depth * 4;
  const borderMix = isHovered ? 40 : 25 + depth * 8;

  return (
    <div
      style={{
        opacity: isDimmed ? 0.2 : 1,
        pointerEvents: isDimmed ? 'none' : 'auto',
      }}
      className="transition-opacity duration-200"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        lineStyle={{ borderColor: `${color}40` }}
        handleStyle={{ backgroundColor: color, width: 8, height: 8, borderRadius: 4 }}
      />
      <div
        className="relative min-w-[200px] min-h-[120px] h-full rounded-xl transition-all duration-200"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} ${bgMix}%, var(--color-canvas))`,
          border: `1px solid color-mix(in srgb, ${color} ${borderMix}%, var(--color-canvas))`,
          boxShadow: isHovered
            ? `0 0 0 3px ${color}40, 0 0 16px ${color}25`
            : '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div
          className="node-drag-handle flex items-center gap-2 px-3 py-2 rounded-t-xl cursor-grab"
          style={{ backgroundColor: `${color}15` }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-node-xs font-medium text-content text-halo">{label}</span>
            {parentGroupName && (
              <span className="text-[9px] text-content-subtle leading-tight">{parentGroupName}</span>
            )}
          </div>
          {/* Collapse chevron hint */}
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-content-subtle opacity-40 shrink-0"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default memo(SchemaGroupNode);
