import { memo, useCallback } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { EyeIcon, EyeOffIcon } from '../ui/icons';
import type { VisualGroupNodeData as BaseVisualGroupNodeData } from '@carta/domain';

/**
 * Extended data interface with callbacks added by Map.tsx
 */
export interface VisualGroupNodeData extends BaseVisualGroupNodeData {
  childCount: number;
  isDropTarget?: boolean;
  isHovered?: boolean;
  isDimmed?: boolean;
  onToggleCollapse: () => void;
}

type VisualGroupNodeProps = NodeProps & {
  data: VisualGroupNodeData;
};

/**
 * Visual grouping node using React Flow's native parentId system.
 * Groups are regular nodes with type='visual-group'.
 * Children use parentId for relative positioning and group movement.
 */
function VisualGroupNode({ data, selected }: VisualGroupNodeProps) {
  const {
    name,
    color = '#6b7280',
    collapsed,
    childCount,
    isDropTarget,
    isHovered,
    isDimmed,
    onToggleCollapse,
  } = data;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleCollapse();
    },
    [onToggleCollapse]
  );

  // Increased base color mix for better visibility
  const bgMix = isHovered || isDropTarget ? 25 : 18;
  const borderMix = isHovered || isDropTarget ? 45 : 35;

  // Collapsed chip rendering (180x44 pill)
  if (collapsed) {
    return (
      <div
        className="transition-all duration-200 cursor-pointer"
        style={{
          opacity: isDimmed ? 0.2 : 1,
          pointerEvents: isDimmed ? 'none' : 'auto',
        }}
      >
        {/* Hidden handles for edge connections to collapsed groups */}
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
          className="node-drag-handle flex items-center gap-2 px-3 py-2 rounded-lg select-none"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} ${isHovered || isDropTarget ? 25 : 12}%, var(--color-canvas))`,
            border: `1px solid color-mix(in srgb, ${color} ${isHovered || isDropTarget ? 50 : 30}%, var(--color-canvas))`,
            boxShadow: isDropTarget
              ? `0 0 0 3px ${color}60, 0 0 20px ${color}35`
              : isHovered
                ? `0 0 0 3px ${color}40, 0 0 16px ${color}25`
                : selected
                  ? `0 0 0 2px ${color}30`
                  : '0 1px 3px rgba(0,0,0,0.08)',
            minWidth: 140,
            height: 44,
          }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-node-xs font-medium text-content truncate text-halo flex-1">
            {name}
          </span>
          {childCount > 0 && (
            <span
              className="text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `color-mix(in srgb, ${color} 20%, var(--color-canvas))`,
                color: `color-mix(in srgb, ${color} 80%, var(--color-content))`,
              }}
            >
              {childCount}
            </span>
          )}
          {/* Eyeball toggle button */}
          <button
            className="w-5 h-5 flex items-center justify-center rounded text-content-muted hover:text-content transition-colors shrink-0"
            onClick={handleToggle}
            title="Expand group"
          >
            <EyeOffIcon size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Expanded rendering - container with rounded border, resizable
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
        handleStyle={{
          backgroundColor: color,
          width: 8,
          height: 8,
          borderRadius: 4,
        }}
      />
      <div
        className="relative min-w-[200px] min-h-[120px] h-full rounded-xl transition-all duration-200"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} ${bgMix}%, var(--color-canvas))`,
          border: `1px solid color-mix(in srgb, ${color} ${borderMix}%, var(--color-canvas))`,
          boxShadow: isDropTarget
            ? `0 0 0 3px ${color}60, 0 0 20px ${color}35`
            : isHovered
              ? `0 0 0 3px ${color}40, 0 0 16px ${color}25`
              : '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Header */}
        <div
          className="node-drag-handle flex items-center gap-2 px-3 py-2 rounded-t-xl cursor-grab"
          style={{ backgroundColor: `${color}15` }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-node-xs font-medium text-content text-halo">
              {name}
            </span>
          </div>
          {childCount > 0 && (
            <span
              className="text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `color-mix(in srgb, ${color} 20%, var(--color-canvas))`,
                color: `color-mix(in srgb, ${color} 80%, var(--color-content))`,
              }}
            >
              {childCount}
            </span>
          )}
          {/* Eyeball toggle button */}
          <button
            className="w-5 h-5 flex items-center justify-center rounded text-content-muted hover:text-content transition-colors shrink-0"
            onClick={handleToggle}
            title="Collapse group"
          >
            <EyeIcon size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(VisualGroupNode);
