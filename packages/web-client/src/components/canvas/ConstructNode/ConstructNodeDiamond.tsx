import { Handle, Position, NodeResizer } from '@xyflow/react';
import { getDisplayName, resolveNodeColor, resolveNodeIcon } from '@carta/domain';
import IndexBasedDropZones from '../IndexBasedDropZones';
import PortDrawer from '../PortDrawer';
import type { ConstructNodeVariantProps } from './shared';

/**
 * Diamond render style: rotated square shape with centered display name only.
 * No inline field editing — users open the full-view modal for field editing.
 */
export function ConstructNodeDiamond({
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
      <NodeResizer
        isVisible={selected}
        minWidth={100}
        minHeight={100}
        keepAspectRatio={true}
        lineClassName="!border-accent !border-2"
        handleClassName="!w-2 !h-2 !bg-accent !border-accent"
      />

      {/* Diamond shape: square container with rotated inner */}
      <div
        className="node-drag-handle cursor-move select-none relative"
        style={{ width: '100%', minWidth: 100, aspectRatio: '1 / 1' }}
      >
        {/* Rotated square */}
        <div
          className={`absolute inset-0 flex items-center justify-center ${selected ? 'ring-2 ring-accent/30' : ''}`}
          style={{
            transform: 'rotate(45deg)',
            backgroundColor: `color-mix(in srgb, ${color} 25%, var(--color-surface))`,
            border: `2px solid ${color}`,
            borderRadius: '4px',
            boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
          }}
        />

        {/* Content overlay (NOT rotated) — centered on top of diamond */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {selected && (
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_0_2px_var(--color-surface)] pointer-events-none" />
          )}
          <span className="text-content text-node-base font-medium text-center px-2 truncate max-w-[70%]">
            {displayName}
          </span>
          {(() => {
            const icon = resolveNodeIcon(schema, data);
            return icon ? (
              <span className="text-content text-[1.2em] font-bold leading-none" title="Type marker">
                {icon}
              </span>
            ) : null;
          })()}
        </div>

        {/* Connection drop zones */}
        {isConnectionTarget && (
          <IndexBasedDropZones ports={ports} sourcePortType={sourcePortType} />
        )}
      </div>

      {/* Anchor handles */}
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

      {/* Port drawer below diamond */}
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
