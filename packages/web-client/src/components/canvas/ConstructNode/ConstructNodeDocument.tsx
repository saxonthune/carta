import { Handle, Position, NodeResizer } from '@xyflow/react';
import { getDisplayName, resolveNodeColor, resolveNodeIcon } from '@carta/domain';
import IndexBasedDropZones from '../IndexBasedDropZones';
import PortDrawer from '../PortDrawer';
import type { ConstructNodeVariantProps } from './shared';

/**
 * Document render style: rectangle with wavy bottom edge, centered display name only.
 * No inline field editing — users open the full-view modal for field editing.
 */
export function ConstructNodeDocument({
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
        minHeight={80}
        lineClassName="!border-accent !border-2"
        handleClassName="!w-2 !h-2 !bg-accent !border-accent"
      />

      {/* Document shape with wavy bottom */}
      <div
        className={`node-drag-handle cursor-move select-none relative overflow-visible ${selected ? 'ring-2 ring-accent/30' : ''}`}
        style={{
          width: '100%',
          minHeight: '80px',
          boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
        }}
      >
        {/* Main body */}
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 25%, var(--color-surface))`,
            border: `2px solid ${color}`,
            borderBottom: 'none',
            borderRadius: '4px 4px 0 0',
            minHeight: '60px',
            padding: '8px',
          }}
        >
          {selected && (
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_0_2px_var(--color-surface)]" />
          )}
          <span className="text-content text-node-base font-medium text-center px-2 truncate max-w-full">
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

        {/* Wavy bottom edge (SVG) */}
        <svg
          className="w-full"
          viewBox="0 0 200 20"
          preserveAspectRatio="none"
          style={{ display: 'block', height: '12px' }}
        >
          <path
            d="M0,0 L0,10 Q50,20 100,10 Q150,0 200,10 L200,0 Z"
            fill={`color-mix(in srgb, ${color} 25%, var(--color-surface))`}
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

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

      {/* Port drawer below document */}
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
