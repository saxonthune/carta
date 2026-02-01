import { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useDocument } from '../../hooks/useDocument';
import { getPortsForSchema, getHandleType, getPortColor, generateTints, getDisplayName, getFieldsForTier } from '@carta/domain';
import type { ConstructNodeData, PortConfig, PortPosition, ConstructSchema } from '@carta/domain';
import CreateDeployablePopover from '../CreateDeployablePopover';
import PortPickerPopover from '../ui/PortPickerPopover';
import { useLodBand } from './lod/useLodBand';
import { WindowIcon, PinIcon, ExpandIcon, CollapseIcon } from '../ui/icons';

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
  const [editingField, setEditingField] = useState<string | null>(null);
  const hoverTimerRef = useRef<number | null>(null);

  // LOD transition crossfade
  const prevBandRef = useRef(lod.band);
  const [lodTransitioning, setLodTransitioning] = useState(false);

  useEffect(() => {
    if (prevBandRef.current !== lod.band) {
      prevBandRef.current = lod.band;
      setLodTransitioning(true);
      requestAnimationFrame(() => setLodTransitioning(false));
    }
  }, [lod.band]);

  // LOD transition style applied to outer wrapper
  const lodTransitionStyle: React.CSSProperties = {
    opacity: lodTransitioning ? 0 : 1,
    transition: 'opacity 120ms ease',
  };

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

  // Pill mode: subtle tinted background with accent dot
  if (lod.band === 'pill') {
    const color = data.instanceColor || schema.color;
    const displayValue = getDisplayName(data, schema);
    const fullText = `${schema.displayName}: ${displayValue}`;
    return (
      <div
        className={`node-drag-handle rounded-lg font-semibold px-5 py-3 truncate cursor-move select-none whitespace-nowrap text-content flex items-center gap-3 ${selected ? 'ring-2 ring-accent/40' : ''}`}
        style={{
          ...lodTransitionStyle,
          backgroundColor: `color-mix(in srgb, ${color} 25%, var(--color-surface))`,
          minWidth: 180,
          maxWidth: 500,
          fontSize: '24px',
          boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
        }}
        title={fullText}
      >
        <span
          className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="truncate">
          <span className="opacity-50">{schema.displayName}:</span> {displayValue}
        </span>
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

  const color = data.instanceColor || schema.color;

  return (
    <div
      className={`bg-surface rounded-lg w-full h-full text-node-base text-content overflow-visible relative flex flex-col transition-shadow duration-150 ${data.viewLevel === 'details' ? 'min-w-[280px]' : 'min-w-[180px]'} ${selected ? 'ring-2 ring-accent/30' : ''}`}
      style={{
        ...bgStyle,
        ...lodTransitionStyle,
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
        borderLeft: `2px solid color-mix(in srgb, ${color} 70%, var(--color-surface-alt))`,
      }}
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
        className="node-drag-handle flex items-center justify-between gap-1.5 px-2 py-1 cursor-move select-none bg-surface-alt w-full shrink-0 rounded-t-lg"
      >
        <span className="text-node-xs text-content-muted">{schema.displayName}</span>
        <div className="flex items-center gap-1">
          {/* Open Full View button */}
          {data.onOpenFullView && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onOpenFullView?.();
              }}
              className="text-content-muted hover:text-content transition-colors flex-shrink-0 rounded-full p-1"
              title="Open Full View"
            >
              <WindowIcon className="w-2.5 h-2.5" size={10} />
            </button>
          )}
          {data.onSetViewLevel && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onSetViewLevel?.(data.viewLevel === 'details' ? 'summary' : 'details');
              }}
              className="text-content-muted hover:text-content transition-colors flex-shrink-0 rounded-full p-1"
              title={data.viewLevel === 'details' ? "Collapse" : "Expand"}
            >
              {data.viewLevel === 'details' ? (
                <CollapseIcon className="w-2.5 h-2.5" size={10} />
              ) : (
                <ExpandIcon className="w-2.5 h-2.5" size={10} />
              )}
            </button>
          )}
          {data.onToggleDetailsPin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onToggleDetailsPin?.();
              }}
              className={`transition-colors flex-shrink-0 rounded-full p-1 ${data.isDetailsPinned ? 'text-accent' : 'text-content-muted hover:text-content'}`}
              title={data.isDetailsPinned ? "Unpin (will collapse on deselect)" : "Pin expanded"}
            >
              <PinIcon
                className="w-2.5 h-2.5"
                size={10}
                filled={data.isDetailsPinned}
              />
            </button>
          )}
          {/* Universal port icon for collapsed ports */}
          {isCollapsedPorts && (
            <div className="relative">
              <button
                type="button"
                className="w-3.5 h-3.5 rounded-full bg-content-muted/20 hover:bg-content-muted/30 border border-content-muted/30 flex items-center justify-center cursor-pointer transition-colors text-content-muted"
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
        <div className="flex-1 overflow-y-auto min-h-0 bg-surface">
          {/* Display name - visually dominant */}
          <div className="px-2 pt-2 pb-1 text-node-lg font-semibold text-content border-b border-border-subtle">
            {getDisplayName(data, schema)}
          </div>

          {/* Minimal tier fields */}
          {mapFields.length > 0 && (
            <div className="px-2 py-1.5 text-node-sm text-content-muted">
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

          {/* Schema fields — click-to-edit two-column grid */}
          {Array.isArray(schema.fields) && schema.fields.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {schema.fields.map((field) => {
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
      )}
    </div>
  );
});

export default ConstructNode;
