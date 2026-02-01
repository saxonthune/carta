import { memo, Fragment } from 'react';
import { Handle, Position } from '@xyflow/react';
import { portRegistry } from '@carta/domain';
import type { ConstructSchema, PortPosition } from '@carta/domain';

export interface SchemaNodeData {
  schema: ConstructSchema;
  isExpanded?: boolean;
  isDimmed?: boolean;
  [key: string]: unknown;
}

interface SchemaNodeProps {
  data: SchemaNodeData;
  selected?: boolean;
}

const positionMap: Record<PortPosition, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

const SchemaNode = memo(({ data, selected }: SchemaNodeProps) => {
  const { schema, isExpanded, isDimmed } = data;
  const ports = schema.ports || [];

  return (
    <div
      className={`bg-surface rounded-lg min-w-[240px] text-node-base text-content relative transition-opacity duration-200 ${
        selected ? 'ring-2 ring-accent/30' : ''
      }`}
      style={{
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
        borderLeft: `2px solid color-mix(in srgb, ${schema.color} 70%, var(--color-surface-alt))`,
        opacity: isDimmed ? 0.2 : 1,
        pointerEvents: isDimmed ? 'none' : 'auto',
      }}
    >
      {/* New connection handle in top-right corner with plus icon */}
      <div className="absolute top-2 right-2 z-10 group/connect">
        <Handle
          id="meta-connect"
          type="source"
          position={Position.Right}
          className="meta-port-connect"
        />
        <Handle
          id="meta-connect"
          type="target"
          position={Position.Right}
          className="meta-port-connect"
        />
        <div className="meta-port-plus">
          <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" strokeWidth="2.5" fill="none">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <div className="meta-port-tooltip">Create connection</div>
      </div>

      {/* Port handles at their configured positions */}
      {ports.map((port) => {
        const position = positionMap[port.position];
        const isVertical = port.position === 'left' || port.position === 'right';
        const offsetStyle = isVertical
          ? { top: `${port.offset}%` }
          : { left: `${port.offset}%` };

        // Get port color from registry
        const portSchema = portRegistry.get(port.portType);
        const portColor = portSchema?.color || '#6b7280';

        return (
          <Fragment key={port.id}>
            <Handle
              id={port.id}
              type="source"
              position={position}
              className="meta-port-diamond"
              style={{ ...offsetStyle, backgroundColor: portColor, borderColor: portColor }}
              data-port-color={portColor}
            />
            <Handle
              id={port.id}
              type="target"
              position={position}
              className="meta-port-diamond"
              style={{ ...offsetStyle, backgroundColor: portColor, borderColor: portColor }}
              data-port-color={portColor}
            />
          </Fragment>
        );
      })}

      {/* Header */}
      <div className="px-3 py-2 bg-surface-alt rounded-t-lg">
        <div className="font-semibold text-node-lg text-content text-halo">{schema.displayName}</div>
        <div className="text-node-xs text-content-muted text-halo">{schema.type}</div>
      </div>

      {/* Compact summary (default) */}
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
              {ports.map((port) => (
                <div key={port.id} className="flex gap-2 items-center text-node-xs py-0.5">
                  <span className="text-content">{port.label}</span>
                  <span className="text-content-subtle">({port.portType})</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
});

SchemaNode.displayName = 'SchemaNode';

export default SchemaNode;
