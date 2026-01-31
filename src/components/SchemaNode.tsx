import { memo, Fragment } from 'react';
import { Handle, Position } from '@xyflow/react';
import { portRegistry } from '@carta/domain';
import type { ConstructSchema, PortPosition } from '@carta/domain';

interface SchemaNodeProps {
  data: { schema: ConstructSchema };
  selected?: boolean;
}

const positionMap: Record<PortPosition, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

const SchemaNode = memo(({ data, selected }: SchemaNodeProps) => {
  const { schema } = data;
  const ports = schema.ports || [];

  return (
    <div
      className={`schema-node bg-surface rounded-lg min-w-[260px] text-sm text-content relative ${
        selected ? 'border-accent shadow-[0_0_0_2px_var(--color-accent)]' : ''
      }`}
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

      {/* Color accent bar on the left */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg"
        style={{ backgroundColor: schema.color }}
      />

      {/* Header */}
      <div className="px-4 pl-5 py-2 border-b border-border-subtle">
        <div className="font-semibold text-content">{schema.displayName}</div>
        <div className="text-xs text-content-muted">{schema.type}</div>
      </div>

      {/* Fields */}
      {schema.fields.length > 0 && (
        <div className="px-4 pl-5 py-2 border-b border-border-subtle">
          <div className="text-xs text-content-subtle uppercase tracking-wide mb-1">Fields</div>
          {schema.fields.map((field) => (
            <div key={field.name} className="flex gap-2 text-xs py-0.5">
              <span className="text-content">{field.name}</span>
              <span className="text-content-muted">{field.type}</span>
            </div>
          ))}
        </div>
      )}

      {/* Ports */}
      {ports.length > 0 && (
        <div className="px-4 pl-5 py-2">
          <div className="text-xs text-content-subtle uppercase tracking-wide mb-1">Ports</div>
          {ports.map((port) => (
            <div key={port.id} className="flex gap-2 items-center text-xs py-0.5">
              <span className="text-content">{port.label}</span>
              <span className="text-content-subtle">({port.portType})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

SchemaNode.displayName = 'SchemaNode';

export default SchemaNode;
