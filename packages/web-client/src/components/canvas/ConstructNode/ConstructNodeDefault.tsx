import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { getDisplayName, getFieldsForSummary, resolveNodeColor, resolveNodeIcon } from '@carta/domain';
import PortDrawer from '../PortDrawer';
import IndexBasedDropZones from '../IndexBasedDropZones';
import { formatValue } from './shared';
import type { ConstructNodeVariantProps } from './shared';

export function ConstructNodeDefault({
  data,
  selected,
  schema,
  ports,
  isConnectionTarget,
  isDragActive,
  sourcePortType,
  lodTransitionStyle,
}: ConstructNodeVariantProps) {
  const [editingField, setEditingField] = useState<string | null>(null);

  const color = resolveNodeColor(schema, data);

  const bgStyle: React.CSSProperties = color !== schema.color
    ? { backgroundColor: color }
    : {};

  const visibleFields = getFieldsForSummary(schema);

  return (
    <div
      className={`bg-surface rounded-lg text-node-base text-content overflow-visible relative flex flex-col transition-shadow duration-150 min-w-[180px] ${selected ? 'ring-2 ring-accent/30' : ''}`}
      style={{
        ...bgStyle,
        ...lodTransitionStyle,
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
        borderLeft: `2px solid color-mix(in srgb, ${color} 70%, var(--color-surface-alt))`,
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

      <div
        className="node-drag-handle flex items-center justify-between gap-1.5 px-2 py-1 cursor-move select-none bg-surface-alt w-full shrink-0 rounded-t-lg"
      >
        <span className="text-node-xs text-content-muted">{schema.displayName}</span>
        {(() => {
          const icon = resolveNodeIcon(schema, data);
          return icon ? (
            <span className="text-node-base font-bold text-content leading-none" title="Type marker">
              {icon}
            </span>
          ) : null;
        })()}
      </div>

      {/* Unified body: summary shows pill+minimal fields, details shows all fields */}
      <div className="px-2 py-2 bg-surface flex flex-col gap-2">
        {/* Display name row */}
        <div className="text-node-lg font-semibold text-content">
          {getDisplayName(data, schema)}
        </div>

        {/* Fields — click-to-edit two-column grid */}
        {visibleFields.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {visibleFields.map((field) => {
              const isMultiline = field.displayHint === 'multiline' || field.displayHint === 'code';
              const isEditing = editingField === field.name;
              const value = data.values[field.name] ?? field.default;

              const commitValue = (newValue: unknown) => {
                data.onValuesChange?.({ ...data.values, [field.name]: newValue });
                setEditingField(null);
              };

              const cancelEdit = () => setEditingField(null);

              const handleKeyDown = (e: React.KeyboardEvent) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                  cancelEdit();
                }
                if (e.key === 'Enter' && !isMultiline) {
                  (e.target as HTMLElement).blur();
                }
              };

              // Multiline and code fields span full width
              const cellClass = isMultiline ? 'col-span-2' : '';

              if (isEditing) {
                return (
                  <div key={field.name} className={cellClass}>
                    <div className="text-content-subtle text-node-xs">{field.label}</div>
                    {field.type === 'boolean' ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <input
                          type="checkbox"
                          checked={!!value}
                          onChange={(e) => commitValue(e.target.checked)}
                          onKeyDown={handleKeyDown}
                          className="w-4 h-4 cursor-pointer"
                          autoFocus
                        />
                      </div>
                    ) : field.type === 'enum' && field.options ? (
                      <select
                        className="w-full px-1.5 py-0.5 bg-surface rounded text-node-sm text-content border border-accent/40 outline-none"
                        value={String(value ?? '')}
                        onChange={(e) => commitValue(e.target.value)}
                        onBlur={() => cancelEdit()}
                        onKeyDown={handleKeyDown}
                        autoFocus
                      >
                        <option value="">Select...</option>
                        {field.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.value}</option>
                        ))}
                      </select>
                    ) : isMultiline ? (
                      <textarea
                        className="w-full px-1.5 py-0.5 bg-surface rounded text-node-sm text-content border border-accent/40 outline-none resize-y min-h-[60px] font-mono text-xs"
                        defaultValue={String(value ?? '')}
                        onBlur={(e) => commitValue(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        placeholder={field.placeholder}
                        autoFocus
                      />
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        className="w-full px-1.5 py-0.5 bg-surface rounded text-node-sm text-content border border-accent/40 outline-none"
                        defaultValue={String(value ?? '')}
                        onBlur={(e) => commitValue(field.type === 'number' ? Number(e.target.value) : e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={field.placeholder}
                        autoFocus
                      />
                    )}
                  </div>
                );
              }

              // Read-only state
              return (
                <div
                  key={field.name}
                  className={`cursor-pointer hover:bg-surface-alt rounded px-1 -mx-1 ${cellClass}`}
                  onClick={(e) => { e.stopPropagation(); setEditingField(field.name); }}
                >
                  <div className="text-content-subtle text-node-xs">{field.label}</div>
                  {isMultiline ? (
                    <div className="text-content text-node-sm line-clamp-3 whitespace-pre-wrap">{formatValue(value)}</div>
                  ) : field.type === 'boolean' ? (
                    <div className="text-content text-node-sm">{value ? 'Yes' : 'No'}</div>
                  ) : (
                    <div className="text-content text-node-sm truncate">{formatValue(value)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Anchor handles — target handles enlarged during drag for detection */}
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

      {/* Port Drawer at bottom */}
      <PortDrawer ports={ports} />
    </div>
  );
}
