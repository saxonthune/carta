import { Handle, Position, NodeResizer } from '@xyflow/react';
import { getDisplayName, resolveNodeColor, resolveNodeIcon } from '@carta/domain';
import IndexBasedDropZones from '../IndexBasedDropZones';
import PortDrawer from '../PortDrawer';
import type { ConstructNodeVariantProps } from './shared';

/**
 * Circle render style: circular shape with centered display name only.
 * No inline field editing — users open the full-view modal for field editing.
 */
export function ConstructNodeCircle({
  data,
  selected,
  schema,
  ports,
  isConnectionTarget,
  isDragActive,
  sourcePortType,
  lodTransitionStyle,
}: ConstructNodeVariantProps) {
  const color = resolveNodeColor(schema, data);
  const displayName = getDisplayName(data, schema);

  return (
    <div className="relative flex flex-col items-center" style={lodTransitionStyle}>
      {/* NodeResizer for user resizing — maintain aspect ratio */}
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={80}
        keepAspectRatio={true}
        lineClassName="!border-accent !border-2"
        handleClassName="!w-2 !h-2 !bg-accent !border-accent"
      />

      {/* Circle shape */}
      <div
        className={`node-drag-handle rounded-full flex items-center justify-center cursor-move select-none overflow-hidden ${selected ? 'ring-2 ring-accent/30' : ''}`}
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          backgroundColor: `color-mix(in srgb, ${color} 25%, var(--color-surface))`,
          border: `2px solid ${color}`,
          boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
        }}
      >
        {/* Selection indicator */}
        {selected && (
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_0_2px_var(--color-surface)]" />
        )}

        {/* Connection drop zones */}
        {isConnectionTarget && (
          <IndexBasedDropZones ports={ports} sourcePortType={sourcePortType} />
        )}

        {/* Centered display name */}
        <span className="text-content text-node-base font-medium text-center px-2 truncate max-w-full">
          {displayName}
        </span>
        {(() => {
          const icon = resolveNodeIcon(schema, data);
          return icon ? (
            <span className="text-content text-[1.5em] font-bold leading-none" title="Type marker">
              {icon}
            </span>
          ) : null;
        })()}
      </div>

      {/* Anchor handles (invisible) */}
      {ports.map((port) => (
        <span key={`anchor-${port.id}`}>
          <Handle
            id={port.id}
            type="source"
            position={Position.Bottom}
            className="!absolute !opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-none !p-0"
            style={{ bottom: 14, left: '50%', pointerEvents: 'none' }}
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

      {/* Port drawer below circle */}
      <PortDrawer
        ports={ports}
        colorPickerPolicy={schema.colorMode === 'enum' ? 'defaultOnly' : schema.backgroundColorPolicy}
        baseColor={schema.color}
        instanceColor={data.instanceColor}
        onColorChange={data.onInstanceColorChange}
      />
    </div>
  );
}
