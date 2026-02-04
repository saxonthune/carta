import { Handle, Position } from '@xyflow/react';
import { getDisplayName } from '@carta/domain';
import IndexBasedDropZones from '../IndexBasedDropZones';
import type { ConstructNodeVariantProps } from './shared';

export function ConstructNodePill({
  data,
  selected,
  schema,
  ports,
  isConnectionTarget,
  isDragActive,
  sourcePortType,
  lodTransitionStyle,
}: ConstructNodeVariantProps) {
  const color = data.instanceColor || schema.color;
  const displayValue = getDisplayName(data, schema);
  const fullText = `${schema.displayName}: ${displayValue}`;

  return (
    <div
      className={`node-drag-handle rounded-lg font-semibold px-5 py-3 truncate cursor-move select-none whitespace-nowrap text-content flex items-center gap-3 ${selected ? 'ring-2 ring-accent/40' : ''}`}
      style={{
        ...lodTransitionStyle,
        backgroundColor: `color-mix(in srgb, ${color} 25%, var(--color-surface))`,
        minWidth: 180,
        maxWidth: 500,
        fontSize: '24px',
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
      }}
      title={fullText}
    >
      <span
        className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">
        <span className="opacity-50">{schema.displayName}:</span> {displayValue}
      </span>

      {/* Connection drop zones overlay (pill mode) */}
      {isConnectionTarget && (
        <IndexBasedDropZones ports={ports} sourcePortType={sourcePortType} />
      )}

      {/* Anchor handles for persistent edges — target handles enlarged during drag for detection */}
      {ports.map((port) => (
        <span key={port.id}>
          <Handle
            id={port.id}
            type="source"
            position={Position.Bottom}
            className="!absolute !opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-none !p-0"
            style={{ bottom: 0, left: '50%', pointerEvents: 'none' }}
          />
          <Handle
            id={port.id}
            type="target"
            position={Position.Top}
            className={isDragActive
              ? '!absolute !opacity-0 !border-none !p-0'
              : '!absolute !opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-none !p-0'}
            style={isDragActive
              ? { top: 0, left: '50%', width: 20, height: 20, minWidth: 20, minHeight: 20, pointerEvents: 'auto' }
              : { top: 0, left: '50%', pointerEvents: 'none' }}
          />
        </span>
      ))}
    </div>
  );
}
