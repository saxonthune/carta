import { memo, useCallback } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import type { VirtualParentNodeData } from '../constructs/types';

type VirtualParentNodeProps = NodeProps & {
  data: VirtualParentNodeData & {
    childCount?: number;
    onToggleCollapse?: () => void;
  };
};

function VirtualParentNode({ data, selected }: VirtualParentNodeProps) {
  const {
    label,
    color,
    collapseState,
    childCount = 0,
    onToggleCollapse,
  } = data;

  const handleToggle = useCallback(() => {
    onToggleCollapse?.();
  }, [onToggleCollapse]);

  const isCollapsed = collapseState === 'collapsed';

  if (isCollapsed) {
    // Collapsed: small pill showing label + child count
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer select-none"
        style={{
          backgroundColor: `${color}15`,
          border: `2px dashed ${color}60`,
        }}
        onClick={handleToggle}
      >
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-medium text-content">{label}</span>
        {childCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded-full text-content-muted">
            {childCount}
          </span>
        )}
        {/* Handle for connection to actual parent */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2 !h-2 !border-0 !-top-1"
          style={{ backgroundColor: color }}
        />
      </div>
    );
  }

  // Expanded or no-edges state: container with dashed border
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        lineStyle={{ borderColor: `${color}40` }}
        handleStyle={{ backgroundColor: color, width: 8, height: 8, borderRadius: 4 }}
      />
      <div
        className="relative min-w-[200px] min-h-[120px] h-full rounded-xl"
        style={{
          backgroundColor: `${color}08`,
          border: `2px dashed ${color}40`,
        }}
      >
        {/* Header */}
        <div
          className="node-drag-handle flex items-center justify-between px-3 py-2 rounded-t-xl cursor-grab"
          style={{ backgroundColor: `${color}15` }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs font-medium text-content">{label}</span>
            {childCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded-full text-content-muted">
                {childCount}
              </span>
            )}
          </div>
          <button
            className="w-5 h-5 flex items-center justify-center rounded text-content-muted hover:text-content transition-colors"
            onClick={handleToggle}
            title={collapseState === 'expanded' ? 'Hide edges' : collapseState === 'no-edges' ? 'Collapse' : 'Expand'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapseState === 'expanded' ? (
                <path d="M18 15l-6-6-6 6" />
              ) : (
                <path d="M6 9l6 6 6-6" />
              )}
            </svg>
          </button>
        </div>

        {/* Handle for connection to actual parent */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !border-2 !border-white !-top-1.5"
          style={{ backgroundColor: color }}
        />
      </div>
    </>
  );
}

export default memo(VirtualParentNode);
