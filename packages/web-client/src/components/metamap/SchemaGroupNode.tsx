import { memo } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';

export interface SchemaGroupNodeData {
  groupId: string;
  label: string;
  color: string;
  description?: string;
  isHovered?: boolean;
  [key: string]: unknown;
}

type SchemaGroupNodeProps = NodeProps & {
  data: SchemaGroupNodeData;
};

function SchemaGroupNode({ data, selected }: SchemaGroupNodeProps) {
  const { label, color, isHovered } = data;

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
        className="relative min-w-[200px] min-h-[120px] h-full rounded-xl transition-all duration-200"
        style={{
          backgroundColor: isHovered ? `${color}20` : `${color}08`,
          border: isHovered ? `2px solid ${color}60` : `1px solid ${color}25`,
          boxShadow: isHovered ? `0 0 0 4px ${color}15` : '0 1px 3px rgba(0,0,0,0.04)',
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
          <span className="text-node-xs font-medium text-content">{label}</span>
        </div>
      </div>
    </>
  );
}

export default memo(SchemaGroupNode);
