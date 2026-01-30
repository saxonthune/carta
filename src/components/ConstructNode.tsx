import { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useDocument } from '../hooks/useDocument';
import { getPortsForSchema, getHandleType, getPortColor } from '../constructs/ports';
import CreateDeployablePopover from './CreateDeployablePopover';
import type { ConstructNodeData, PortConfig, PortPosition } from '../constructs/types';

// Long hover delay in milliseconds
const LONG_HOVER_DELAY = 800;

// Special value for "Add new..." deployable option
const ADD_NEW_DEPLOYABLE = '__ADD_NEW__';

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
  const { getSchema, addDeployable } = useDocument();
  const schema = getSchema(data.constructType);
  const [hoveredPort, setHoveredPort] = useState<string | null>(null);
  const [showExtendedTooltip, setShowExtendedTooltip] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);

  // New deployable modal state
  const [showNewDeployableModal, setShowNewDeployableModal] = useState(false);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // Start/reset long hover timer when hoveredPort changes
  useEffect(() => {
    setShowExtendedTooltip(false);
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
    if (hoveredPort) {
      hoverTimerRef.current = window.setTimeout(() => {
        setShowExtendedTooltip(true);
      }, LONG_HOVER_DELAY);
    }
  }, [hoveredPort]);

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

  const mapFields = Array.isArray(schema.fields)
    ? schema.fields.filter((f) => f.showInMinimalDisplay)
    : [];
  const formatValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'object') {
      if (Array.isArray(value)) return `${value.length} items`;
      return 'object';
    }
    return String(value);
  };

  // Handle deployable change - show modal if "Add new..." is selected
  const handleDeployableChange = (value: string) => {
    if (value === ADD_NEW_DEPLOYABLE) {
      setShowNewDeployableModal(true);
    } else {
      data.onDeployableChange?.(value || null);
    }
  };

  // Create new deployable and assign to this node
  const handleCreateDeployable = (name: string, description: string) => {
    const newDeployable = addDeployable({
      name: name.trim(),
      description: description.trim(),
    });

    data.onDeployableChange?.(newDeployable.id);
    setShowNewDeployableModal(false);
  };

  // Calculate tooltip position based on port position
  const getTooltipPosition = (port: PortConfig, extended: boolean): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      zIndex: 1000,
      // Extended tooltip needs wrapping for description
      whiteSpace: extended ? 'normal' : 'nowrap',
      maxWidth: extended ? '200px' : 'none',
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
      className={`bg-surface border-[3px] rounded-lg w-full h-full text-node-base text-content shadow-md overflow-visible relative flex flex-col ${data.isExpanded ? 'min-w-[350px]' : 'min-w-[250px]'} ${selected ? 'border-accent shadow-[0_0_0_2px_var(--color-accent)]' : 'border'}`}
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
      {hoveredPort && (() => {
        const port = ports.find(p => p.id === hoveredPort);
        if (!port) return null;
        const hasDescription = showExtendedTooltip && port.semanticDescription;
        return (
          <div
            className="bg-surface-elevated text-content text-node-sm px-2 py-1 rounded shadow-lg border pointer-events-none"
            style={getTooltipPosition(port, !!hasDescription)}
          >
            <div className="font-medium">{port.label}</div>
            {hasDescription && (
              <div className="text-content-muted text-node-xs mt-1">{port.semanticDescription}</div>
            )}
          </div>
        );
      })()}

      <div
        className="node-drag-handle flex items-center justify-between gap-1.5 px-2 py-1 text-white cursor-move select-none border-b border-white/20 w-full shrink-0"
        style={{ backgroundColor: schema.color }}
      >
        <div className="flex items-center gap-1.5">
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
        {data.onToggleExpand && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onToggleExpand?.();
            }}
            className="opacity-90 hover:opacity-100 transition-all flex-shrink-0 bg-black/20 hover:bg-black/30 rounded-full p-1 shadow-md"
            title={data.isExpanded ? "Collapse" : "Expand"}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {data.isExpanded ? (
                <path d="M18 15l-6-6-6 6" />
              ) : (
                <path d="M6 9l6 6 6-6" />
              )}
            </svg>
          </button>
        )}
      </div>

      {!data.isExpanded && (
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
      )}

      {data.isExpanded && (
        <div className="px-2 py-2 bg-surface-depth-1 flex flex-col gap-2">
          {/* Deployable dropdown */}
          {data.deployables && (
            <div className="relative">
              <label className="text-node-xs text-content-muted uppercase tracking-wide">Deployable</label>
              <select
                className="w-full px-2 py-1 bg-surface rounded text-node-sm text-content border border-content-muted/20"
                value={data.deployableId || ''}
                onChange={(e) => handleDeployableChange(e.target.value)}
              >
                <option value="">—</option>
                {data.deployables.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
                <option value={ADD_NEW_DEPLOYABLE}>+ Add new...</option>
              </select>

              {/* New Deployable Popover */}
              <CreateDeployablePopover
                isOpen={showNewDeployableModal}
                onClose={() => setShowNewDeployableModal(false)}
                onCreate={handleCreateDeployable}
              />
            </div>
          )}

          {/* All schema fields */}
          {Array.isArray(schema.fields) && schema.fields.map((field) => (
            <div key={field.name}>
              <label className="text-node-xs text-content-muted uppercase tracking-wide">{field.label}</label>
              {field.type === 'boolean' ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    checked={!!data.values[field.name]}
                    onChange={(e) => data.onValuesChange?.({ ...data.values, [field.name]: e.target.checked })}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="text-node-sm text-content">{field.label}</span>
                </div>
              ) : field.type === 'enum' && field.options ? (
                <select
                  className="w-full px-2 py-1 bg-surface rounded text-node-sm text-content border border-content-muted/20"
                  value={String(data.values[field.name] ?? field.default ?? '')}
                  onChange={(e) => data.onValuesChange?.({ ...data.values, [field.name]: e.target.value })}
                >
                  <option value="">Select...</option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.value}</option>
                  ))}
                </select>
              ) : field.displayHint === 'multiline' || field.displayHint === 'code' ? (
                <textarea
                  className="w-full px-2 py-1 bg-surface rounded text-node-sm text-content border border-content-muted/20 resize-y min-h-[60px] font-mono text-xs"
                  value={String(data.values[field.name] ?? field.default ?? '')}
                  onChange={(e) => data.onValuesChange?.({ ...data.values, [field.name]: e.target.value })}
                  placeholder={field.placeholder}
                />
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  className="w-full px-2 py-1 bg-surface rounded text-node-sm text-content border border-content-muted/20"
                  value={String(data.values[field.name] ?? field.default ?? '')}
                  onChange={(e) => data.onValuesChange?.({ ...data.values, [field.name]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                  placeholder={field.placeholder}
                />
              )}
            </div>
          ))}

          {/* Identity display (read-only) */}
          <div>
            <label className="text-node-xs text-content-muted uppercase tracking-wide">Semantic ID</label>
            <input
              type="text"
              className="w-full px-2 py-1 bg-surface rounded text-node-sm text-content border border-content-muted/20"
              value={data.semanticId}
              disabled
              title="Human/AI-readable identifier (used in connections and compilation)"
            />
          </div>
          <div>
            <label className="text-node-xs text-content-muted uppercase tracking-wide">Technical ID</label>
            <input
              type="text"
              className="w-full px-2 py-1 bg-surface rounded text-node-xs text-content-muted border border-content-muted/20 font-mono"
              value={data.nodeId || '—'}
              disabled
              title="Immutable UUID (used internally by React Flow and Yjs)"
            />
          </div>

          {/* Connections (read-only) */}
          {data.connections && data.connections.length > 0 && (
            <div>
              <label className="text-node-xs text-content-muted uppercase tracking-wide">Connections</label>
              <div className="text-node-sm text-content-muted bg-surface rounded px-2 py-1 border border-content-muted/20">
                {data.connections.map((c, i) => (
                  <div key={i} className="truncate text-xs">{c.portId} → {c.targetSemanticId}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ConstructNode;
