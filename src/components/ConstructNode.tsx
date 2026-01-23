import { memo, useState } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { registry } from '../constructs/registry';
import { getPortsForSchema, getHandleType, getPortColor } from '../constructs/ports';
import { getDisplayName } from '../utils/displayUtils';
import type { ConstructNodeData, PortConfig, PortPosition } from '../constructs/types';

interface ConstructNodeComponentProps {
  data: ConstructNodeData;
  selected?: boolean;
}

// Map port position to React Flow Position
const positionMap: Record<PortPosition, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

// Calculate handle style for offset positioning
function getHandlePositionStyle(position: PortPosition, offset: number): React.CSSProperties {
  const outside = -16;
  if (position === 'left') {
    return { top: `${offset}%`, left: outside, transform: 'translateY(-50%)' };
  }
  if (position === 'right') {
    return { top: `${offset}%`, right: outside, transform: 'translateY(-50%)' };
  }
  if (position === 'top') {
    return { left: `${offset}%`, top: outside, transform: 'translateX(-50%)' };
  }
  return { left: `${offset}%`, bottom: outside, transform: 'translateX(-50%)' };
}

const ConstructNode = memo(({ data, selected }: ConstructNodeComponentProps) => {
  const schema = registry.getSchema(data.constructType);
  const [hoveredPort, setHoveredPort] = useState<string | null>(null);

  if (!schema) {
    return (
      <div className="bg-danger-muted border-2 border-danger rounded-lg min-w-[250px] p-2 text-node-lg text-content">
        <Handle type="target" position={Position.Left} id="flow-in" className="port-handle" />
        <div>Unknown construct type: {data.constructType}</div>
        <Handle type="source" position={Position.Right} id="flow-out" className="port-handle" />
      </div>
    );
  }

  // Get ports from schema or use defaults
  const ports = getPortsForSchema(schema.ports);

  const mapFields = schema.fields.filter((f) => f.displayInMap);
  const formatValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'object') {
      if (Array.isArray(value)) return `${value.length} items`;
      return 'object';
    }
    return String(value);
  };

  // Calculate tooltip position based on port position
  const getTooltipPosition = (port: PortConfig): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      whiteSpace: 'nowrap',
      zIndex: 1000,
    };
    switch (port.position) {
      case 'left':
        return { ...base, left: -8, top: `${port.offset}%`, transform: 'translateX(-100%) translateY(-50%)' };
      case 'right':
        return { ...base, right: -8, top: `${port.offset}%`, transform: 'translateX(100%) translateY(-50%)' };
      case 'top':
        return { ...base, top: -8, left: `${port.offset}%`, transform: 'translateY(-100%) translateX(-50%)' };
      case 'bottom':
        return { ...base, bottom: -8, left: `${port.offset}%`, transform: 'translateY(100%) translateX(-50%)' };
    }
  };

  return (
    <div
      className={`bg-surface border-[3px] rounded-lg w-full h-full text-node-base text-content shadow-md overflow-visible relative flex flex-col min-w-[250px] ${selected ? 'border-accent shadow-[0_0_0_2px_var(--color-accent)]' : 'border'}`}
    >
      {selected && (
        <NodeResizer
          minWidth={250}
          minHeight={100}
          lineClassName="!border-accent !border-2"
          handleClassName="!w-3 !h-3 !bg-accent !border-surface !rounded-full"
        />
      )}

      {/* Dynamic port handles */}
      {ports.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type={getHandleType(port.portType)}
          position={positionMap[port.position]}
          className="port-handle"
          style={{
            ...getHandlePositionStyle(port.position, port.offset),
            backgroundColor: getPortColor(port.portType),
          }}
          data-port-type={port.portType}
          onMouseEnter={() => setHoveredPort(port.id)}
          onMouseLeave={() => setHoveredPort(null)}
        />
      ))}

      {/* Port tooltip */}
      {hoveredPort && (
        <div
          className="bg-surface-elevated text-content text-node-sm px-2 py-1 rounded shadow-lg border pointer-events-none"
          style={getTooltipPosition(ports.find(p => p.id === hoveredPort)!)}
        >
          {ports.find(p => p.id === hoveredPort)?.label}
        </div>
      )}

      <div
        className="flex items-center justify-center gap-1.5 px-2 py-1 text-white cursor-move select-none border-b border-white/20 w-full shrink-0"
        style={{ backgroundColor: schema.color }}
      >
        <svg
          className="w-5 h-5 opacity-60"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        <span className="text-node-xs opacity-80 uppercase">{schema.displayName}</span>
      </div>

      <div className="px-2 py-1 bg-surface shrink-0">
        <div className="text-node-xs text-content-muted uppercase tracking-wide">ID</div>
        <div className="text-node-lg text-content font-medium leading-tight">{getDisplayName(data, schema)}</div>
      </div>

      <div className="px-2 py-1.5 text-node-sm text-content-muted flex-1 overflow-y-auto min-h-0">
        {mapFields.length === 0 ? (
          <div></div>
        ) : (
          <div className="flex flex-col gap-1">
            {mapFields.map((field) => (
              <div key={field.name} className="flex gap-1 justify-between">
                <span className="text-content-subtle">{field.label}:</span>
                <span className="text-content font-medium text-right max-w-[70%] truncate">
                  {formatValue(data.values[field.name] ?? field.default)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default ConstructNode;
