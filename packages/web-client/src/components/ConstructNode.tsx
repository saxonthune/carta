import { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useDocument } from '../hooks/useDocument';
import { getPortsForSchema, getHandleType, getPortColor, generateTints, getDisplayName, getFieldsForTier } from '@carta/domain';
import type { ConstructNodeData, PortConfig, PortPosition, ConstructSchema } from '@carta/domain';
import CreateDeployablePopover from './CreateDeployablePopover';
import PortPickerPopover from './ui/PortPickerPopover';
import { useLodBand } from './lod/useLodBand';

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
  const outside = -10;
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

// Inline color picker component
function ColorPicker({ schema, instanceColor, onColorChange }: {
  schema: ConstructSchema;
  instanceColor?: string;
  onColorChange: (color: string | null) => void;
}) {
  const policy = schema.backgroundColorPolicy || 'defaultOnly';

  if (policy === 'defaultOnly') return null;

  if (policy === 'tints') {
    const tints = generateTints(schema.color, 7);
    return (
      <div className="flex gap-1 items-center">
        {tints.map((tint) => (
          <button
            key={tint}
            type="button"
            className={`w-4 h-4 rounded border-2 cursor-pointer transition-all hover:scale-110 ${instanceColor === tint ? 'border-accent shadow-[0_0_0_2px_var(--color-accent)]' : 'border-transparent'}`}
            style={{ backgroundColor: tint }}
            onClick={(e) => { e.stopPropagation(); onColorChange(tint); }}
          />
        ))}
        {instanceColor && (
          <button
            type="button"
            className="w-4 h-4 rounded border border-content-muted/30 cursor-pointer text-content-muted hover:text-content text-node-2xs flex items-center justify-center bg-surface hover:bg-surface-depth-1 transition-colors"
            onClick={(e) => { e.stopPropagation(); onColorChange(null); }}
            title="Reset to default"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  // policy === 'any'
  return (
    <div className="flex gap-2 items-center">
      <input
        type="color"
        className="w-5 h-5 p-0 border border-content-muted/20 rounded cursor-pointer"
        value={instanceColor || schema.color}
        onChange={(e) => { e.stopPropagation(); onColorChange(e.target.value); }}
      />
      {instanceColor && (
        <button
          type="button"
          className="px-2 py-1 text-xs rounded border border-content-muted/30 cursor-pointer text-content-muted hover:text-content bg-surface hover:bg-surface-depth-1 transition-colors"
          onClick={(e) => { e.stopPropagation(); onColorChange(null); }}
          title="Reset to default"
        >
          Reset
        </button>
      )}
    </div>
  );
}

const ConstructNode = memo(({ data, selected }: ConstructNodeComponentProps) => {
  const lod = useLodBand();
  const { getSchema, addDeployable } = useDocument();
  const schema = getSchema(data.constructType);
  const [hoveredPort, setHoveredPort] = useState<string | null>(null);
  const [showExtendedTooltip, setShowExtendedTooltip] = useState(false);
  const [showPortPicker, setShowPortPicker] = useState(false);
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
      <div className="bg-danger-muted border-2 border-danger rounded-lg min-w-[180px] p-2 text-node-lg text-content">
        <Handle type="target" position={Position.Left} id="flow-in" className="port-handle" />
        <div>Unknown construct type: {data.constructType}</div>
        <Handle type="source" position={Position.Right} id="flow-out" className="port-handle" />
      </div>
    );
  }

  // Get ports from schema or use defaults
  const ports = getPortsForSchema(schema.ports);
  const isCollapsedPorts = schema.portDisplayPolicy === 'collapsed';

  const mapFields = getFieldsForTier(schema, 'minimal');
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

  // Background color from instanceColor
  const bgStyle: React.CSSProperties = data.instanceColor
    ? { backgroundColor: data.instanceColor }
    : {};

  // Pill mode: minimal colored bar — overrides all view levels at low zoom
  if (lod.band === 'pill') {
    const displayValue = getDisplayName(data, schema);
    return (
      <div
        className={`node-drag-handle rounded-lg text-white text-halo font-bold px-5 py-3 truncate cursor-move select-none whitespace-nowrap ${selected ? 'ring-2 ring-accent' : ''}`}
        style={{
          backgroundColor: data.instanceColor || schema.color,
          minWidth: 180,
          maxWidth: 500,
          fontSize: '32px',
        }}
      >
        <span className="opacity-70">{schema.displayName}:</span> {displayValue}
        {/* Minimal handles for connections */}
        {ports.map((port) => (
          <Handle
            key={port.id}
            id={port.id}
            type={getHandleType(port.portType)}
            position={positionMap[port.position]}
            className="port-handle !opacity-0 !w-1 !h-1"
            style={getHandlePositionStyle(port.position, port.offset)}
          />
        ))}
      </div>
    );
  }

  // Compact mode: header + display value only, no fields
  if (lod.band === 'compact') {
    const displayValue = getDisplayName(data, schema);
    const headerBg = data.instanceColor || schema.color;

    return (
      <div
        className={`bg-surface border-2 rounded-lg shadow-lg overflow-visible relative flex flex-col min-w-[220px] ${selected ? 'border-accent shadow-[0_0_0_2px_var(--color-accent)]' : 'border'}`}
        style={bgStyle}
      >
        {/* Port handles */}
        {!isCollapsedPorts && ports.map((port) => (
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
          />
        ))}

        {/* Header */}
        <div
          className="node-drag-handle flex items-center justify-between gap-1.5 px-3 py-2 cursor-move select-none border-b border-white/20 w-full shrink-0 text-white text-halo"
          style={{ backgroundColor: headerBg }}
        >
          <span className="text-node-lg font-bold uppercase tracking-wide">{schema.displayName}</span>
        </div>

        {/* Display value */}
        <div className="px-3 py-2.5 text-node-lg font-semibold text-content truncate">
          {displayValue}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-surface border-2 rounded-lg w-full h-full text-node-base text-content shadow-lg overflow-visible relative flex flex-col ${data.viewLevel === 'details' ? 'min-w-[280px]' : 'min-w-[180px]'} ${selected ? 'border-accent shadow-[0_0_0_2px_var(--color-accent)]' : 'border'}`}
      style={bgStyle}
    >
      {selected && (
        <NodeResizer
          minWidth={180}
          minHeight={100}
          lineClassName="!border-accent !border-2"
          handleClassName="!w-3 !h-3 !bg-accent !border-surface !rounded-full"
        />
      )}

      {/* Dynamic port handles - inline mode */}
      {!isCollapsedPorts && ports.map((port) => (
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

      {/* Collapsed port handles - hidden but functional */}
      {isCollapsedPorts && ports.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type={getHandleType(port.portType)}
          position={Position.Right}
          className="port-handle"
          style={{
            top: '14px',
            right: -16,
            opacity: 0,
            pointerEvents: 'none',
            width: 1,
            height: 1,
          }}
          data-port-type={port.portType}
        />
      ))}

      {/* Port tooltip (inline mode only) */}
      {!isCollapsedPorts && hoveredPort && (() => {
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
        className="node-drag-handle flex items-center justify-between gap-1.5 px-2 py-1 text-white text-halo cursor-move select-none border-b border-white/20 w-full shrink-0"
        style={{ backgroundColor: data.instanceColor || schema.color }}
      >
        <div className="flex items-center gap-1.5">
          <svg
            className="w-3.5 h-3.5 opacity-60"
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
        <div className="flex items-center gap-1">
          {data.onSetViewLevel && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onSetViewLevel?.(data.viewLevel === 'details' ? 'summary' : 'details');
              }}
              className="opacity-90 hover:opacity-100 transition-all flex-shrink-0 bg-black/20 hover:bg-black/30 rounded-full p-1 shadow-md"
              title={data.viewLevel === 'details' ? "Collapse" : "Expand"}
            >
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {data.viewLevel === 'details' ? (
                  <path d="M18 15l-6-6-6 6" />
                ) : (
                  <path d="M6 9l6 6 6-6" />
                )}
              </svg>
            </button>
          )}
          {data.viewLevel === 'details' && data.onToggleDetailsPin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onToggleDetailsPin?.();
              }}
              className={`opacity-90 hover:opacity-100 transition-all flex-shrink-0 rounded-full p-1 shadow-md ${data.isDetailsPinned ? 'bg-white/40' : 'bg-black/20 hover:bg-black/30'}`}
              title={data.isDetailsPinned ? "Unpin (will collapse on deselect)" : "Pin expanded"}
            >
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v10M12 22v-4M5 12h14" />
              </svg>
            </button>
          )}
          {/* Universal port icon for collapsed ports */}
          {isCollapsedPorts && (
            <div className="relative">
              <button
                type="button"
                className="w-3.5 h-3.5 rounded-full bg-white/30 hover:bg-white/50 border border-white/40 flex items-center justify-center cursor-pointer transition-colors"
                onClick={(e) => { e.stopPropagation(); setShowPortPicker(!showPortPicker); }}
                title="Ports"
              >
                <svg className="w-2 h-2" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </button>
              {/* Visible source+target handles overlapping the icon */}
              <Handle
                id="__collapsed-source"
                type="source"
                position={Position.Right}
                className="!absolute !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-3.5 !h-3.5 !opacity-0 !border-none"
                style={{ pointerEvents: ports.length <= 1 ? 'auto' : 'none' }}
              />
              <Handle
                id="__collapsed-target"
                type="target"
                position={Position.Left}
                className="!absolute !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-3.5 !h-3.5 !opacity-0 !border-none"
                style={{ pointerEvents: ports.length <= 1 ? 'auto' : 'none' }}
              />
              {showPortPicker && ports.length > 1 && (
                <PortPickerPopover
                  ports={ports}
                  onSelect={(portId) => {
                    setShowPortPicker(false);
                    // Focus the hidden handle for this port to initiate connection
                    const handleEl = document.querySelector(`[data-handleid="${portId}"]`) as HTMLElement;
                    if (handleEl) {
                      handleEl.style.pointerEvents = 'auto';
                      handleEl.style.opacity = '1';
                      handleEl.style.position = 'absolute';
                      handleEl.style.top = '14px';
                      handleEl.style.right = '-16px';
                      handleEl.style.width = '12px';
                      handleEl.style.height = '12px';
                      // Reset after a short delay
                      setTimeout(() => {
                        handleEl.style.opacity = '0';
                        handleEl.style.pointerEvents = 'none';
                        handleEl.style.width = '1px';
                        handleEl.style.height = '1px';
                      }, 5000);
                    }
                  }}
                  onClose={() => setShowPortPicker(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {data.viewLevel !== 'details' && (
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

      {data.viewLevel === 'details' && (
        <div className="px-2 py-2 bg-surface-depth-1 flex flex-col gap-2">
          {/* Background Color */}
          {data.onInstanceColorChange && (schema.backgroundColorPolicy === 'tints' || schema.backgroundColorPolicy === 'any') && (
            <div>
              <label className="text-node-xs text-content-muted uppercase tracking-wide">Background Color</label>
              <div className="mt-1">
                <ColorPicker
                  schema={schema}
                  instanceColor={data.instanceColor}
                  onColorChange={data.onInstanceColorChange}
                />
              </div>
            </div>
          )}

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

          {/* Open Full View button */}
          {data.onOpenFullView && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); data.onOpenFullView?.(); }}
              className="w-full px-2 py-1.5 text-node-xs text-content-muted uppercase tracking-wide border border-content-muted/20 rounded bg-surface hover:bg-surface-alt transition-colors cursor-pointer text-center"
            >
              Open Full View
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default ConstructNode;
