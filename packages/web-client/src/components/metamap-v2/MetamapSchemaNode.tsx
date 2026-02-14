import { memo } from 'react';
import type { ConstructSchema } from '@carta/domain';
import { portRegistry } from '@carta/domain';
import { ConnectionHandle } from '../../canvas-engine/index.js';
import { Plus } from '@phosphor-icons/react';

interface MetamapSchemaNodeProps {
  schema: ConstructSchema;
  width: number;
  height: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  onStartConnection?: (nodeId: string, handleId: string, event: React.PointerEvent) => void;
  isExpanded?: boolean;
}

export const MetamapSchemaNode = memo(function MetamapSchemaNode({
  schema,
  width,
  height,
  onPointerDown,
  onDoubleClick,
  onStartConnection,
  isExpanded,
}: MetamapSchemaNodeProps) {
  const ports = schema.ports || [];
  return (
    <div
      data-no-pan="true"
      data-connection-target="true"
      data-node-id={schema.type}
      data-handle-id="meta-connect"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className="bg-surface rounded-lg text-node-base text-content cursor-grab active:cursor-grabbing relative"
      style={{
        width,
        minHeight: height,
        height: isExpanded ? 'auto' : height,
        border: '1px solid var(--color-border-subtle)',
        borderLeft: `3px solid color-mix(in srgb, ${schema.color} 70%, var(--color-surface-alt))`,
        boxShadow: 'var(--node-shadow)',
      }}
    >
      <ConnectionHandle
        type="source"
        id="meta-connect"
        nodeId={schema.type}
        onStartConnection={onStartConnection}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-border-subtle shadow-sm flex items-center justify-center cursor-crosshair hover:border-accent hover:shadow-md transition-all z-10"
      >
        <Plus size={10} weight="bold" className="text-content-muted" />
      </ConnectionHandle>
      {/* Header */}
      <div className="px-3 py-2 bg-surface-alt rounded-t-lg">
        <div className="font-semibold text-node-lg text-content text-halo truncate">
          {schema.displayName}
        </div>
        <div className="text-node-xs text-content-muted text-halo">{schema.type}</div>
      </div>
      {/* Summary (collapsed state) */}
      {!isExpanded && (
        <div className="px-3 py-2">
          <span className="text-node-xs text-content-subtle">
            {schema.fields.length} field{schema.fields.length !== 1 ? 's' : ''}
            {' · '}
            {ports.length} port{ports.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      {/* Expanded detail */}
      {isExpanded && (
        <>
          {/* Fields */}
          {schema.fields.length > 0 && (
            <div className="px-3 py-2 border-t border-border-subtle">
              <div className="text-node-xs text-content-subtle uppercase tracking-wide mb-1">Fields</div>
              {schema.fields.map((field) => (
                <div key={field.name} className="flex gap-2 text-node-xs py-0.5">
                  <span className="text-content">{field.name}</span>
                  <span className="text-content-muted">{field.type}</span>
                </div>
              ))}
            </div>
          )}
          {/* Ports */}
          {ports.length > 0 && (
            <div className="px-3 py-2 border-t border-border-subtle">
              <div className="text-node-xs text-content-subtle uppercase tracking-wide mb-1">Ports</div>
              {ports.map((port) => {
                const portSchema = portRegistry.get(port.portType);
                return (
                  <div key={port.id} className="flex gap-2 items-center text-node-xs py-0.5">
                    <span className="text-content">{port.label}</span>
                    <span className="text-content-subtle">({port.portType})</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
});
