import { useEffect, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { resolveNodeColor } from '@carta/domain';
import IndexBasedDropZones from '../IndexBasedDropZones';
import PortDrawer from '../PortDrawer';
import type { ConstructNodeVariantProps } from './shared';

/**
 * Simple render mode: minimal chrome, direct content editing, no view modes.
 *
 * Design principles:
 * - Single mode only (no summary/details toggle)
 * - Direct inline editing always
 * - Port drawer on hover (for easy connections)
 * - No header bar, no controls
 * - Feels like index cards or sticky notes
 * - Color change via port drawer dropper icon
 *
 * This is a fundamentally different interaction model from default/card variants.
 * It doesn't extend or simplify them—it's a separate primitive that shares only
 * the data model (ConstructNodeData) and connection infrastructure.
 */
export function ConstructNodeSimple({
  data,
  selected,
  schema,
  ports,
  isConnectionTarget,
  isDragActive,
  sourcePortType,
  lodTransitionStyle,
}: ConstructNodeVariantProps) {
  const resolvedColor = resolveNodeColor(schema, data);
  const backgroundColor = resolvedColor !== schema.color
    ? resolvedColor
    : `color-mix(in srgb, ${schema.color} 30%, var(--color-surface))`;
  const contentField = schema.fields?.find(f => f.name === 'content');
  const contentValue = String(data.values?.content ?? contentField?.default ?? '');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on creation (when content is empty)
  useEffect(() => {
    if (!contentValue && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [contentValue]);

  return (
    <div
      className={`rounded-lg overflow-visible relative flex flex-col min-w-[200px] min-h-[100px] ${selected ? 'ring-2 ring-accent/30' : ''}`}
      style={{
        backgroundColor,
        ...lodTransitionStyle,
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
      }}
    >
      {/* Selection indicator */}
      {selected && (
        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_0_2px_var(--color-surface)]" />
      )}

      {/* Connection drop zones overlay */}
      {isConnectionTarget && (
        <IndexBasedDropZones ports={ports} sourcePortType={sourcePortType} />
      )}

      {/* Content field - direct editable, no labels, no chrome */}
      <div className="node-drag-handle flex-1 flex flex-col cursor-move select-none p-3">
        <textarea
          ref={textareaRef}
          value={contentValue}
          onChange={(e) => data.onValuesChange?.({ ...data.values, content: e.target.value })}
          className="w-full h-full bg-transparent text-content text-halo resize-none border-none outline-none text-node-base placeholder-content-subtle/50"
          placeholder="Type here..."
          onClick={(e) => {
            // Allow text selection without triggering node drag
            e.stopPropagation();
          }}
        />
      </div>

      {/* Anchor handles — invisible connection points */}
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

      {/* Port Drawer at bottom */}
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
