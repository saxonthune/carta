import { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, useConnection, useNodeId } from '@xyflow/react';
import { useDocument } from '../../hooks/useDocument';
import { getPortsForSchema, generateTints, getDisplayName, getFieldsForSummary, getFieldsForTier } from '@carta/domain';
import type { ConstructNodeData, ConstructSchema } from '@carta/domain';
import CreateDeployablePopover from '../CreateDeployablePopover';
import PortDrawer from './PortDrawer';
import IndexBasedDropZones from './IndexBasedDropZones';
import { useLodBand } from './lod/useLodBand';
import { WindowIcon, PinIcon, ExpandIcon, CollapseIcon } from '../ui/icons';

// Special value for "Add new..." deployable option
const ADD_NEW_DEPLOYABLE = '__ADD_NEW__';

interface ConstructNodeComponentProps {
  data: ConstructNodeData;
  selected?: boolean;
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
  const nodeId = useNodeId();
  const [editingField, setEditingField] = useState<string | null>(null);

  // Connection drop zone detection
  const connection = useConnection();
  const isConnectionTarget = connection.inProgress && connection.toNode?.id === nodeId;

  // Look up source port type from the connection's fromHandle
  let sourcePortType: string | undefined;
  if (connection.inProgress && connection.fromHandle?.id) {
    const sourceData = connection.fromNode?.data as ConstructNodeData | undefined;
    if (sourceData) {
      const sourceSchema = getSchema(sourceData.constructType);
      if (sourceSchema) {
        const sourcePorts = getPortsForSchema(sourceSchema.ports);
        const sourcePort = sourcePorts.find(p => p.id === connection.fromHandle!.id);
        if (sourcePort) {
          sourcePortType = sourcePort.portType;
        }
      }
    }
  }

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
  const isCard = schema.renderStyle === 'card';

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

  const color = data.instanceColor || schema.color;

  // Background color from instanceColor
  const bgStyle: React.CSSProperties = data.instanceColor
    ? { backgroundColor: data.instanceColor }
    : {};

  // Pill mode: subtle tinted background with accent dot
  // No drawer in pill mode - just minimal invisible handles
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
        {/* Minimal invisible handles for connections in pill mode */}
        {ports.map((port) => (
          <Handle
            key={port.id}
            id={port.id}
            type="source"
            position={Position.Bottom}
            className="port-handle !opacity-0 !w-1 !h-1"
            style={{ position: 'absolute', bottom: 0, left: '50%' }}
          />
        ))}
      </div>
    );
  }

  // ==========================================
  // CARD RENDER STYLE (accent-bar variant)
  // ==========================================
  if (isCard) {
    const displayValue = getDisplayName(data, schema);
    const minimalFields = getFieldsForTier(schema, 'minimal');

    return (
      <div
        className={`rounded-lg overflow-visible relative flex flex-col min-w-[200px] min-h-[100px] bg-surface ${selected ? 'ring-2 ring-accent/30' : ''}`}
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

        {/* Drag handle - card header area */}
        <div className="node-drag-handle flex-1 flex flex-col cursor-move select-none px-3 pt-3 pb-2">
          {/* Fullview button on hover */}
          {data.onOpenFullView && (
            <div className="absolute top-1.5 right-1.5 opacity-0 hover:opacity-100 transition-opacity z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onOpenFullView?.();
                }}
                className="bg-content-muted/20 hover:bg-content-muted/30 rounded-full p-1 shadow-md text-content-muted"
                title="Open Full View"
              >
                <WindowIcon className="w-2.5 h-2.5" size={10} />
              </button>
            </div>
          )}

          {/* Label */}
          <div className="text-content text-node-lg font-bold truncate">
            {displayValue}
          </div>

          {/* Minimal tier fields */}
          {minimalFields.length > 0 && (
            <div className="mt-1.5 text-content-muted text-node-sm flex flex-col gap-0.5">
              {minimalFields.map((field) => (
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

        {/* Card details view - edit fields */}
        {data.viewLevel === 'details' && (
          <div className="px-3 pb-2 flex flex-col gap-2">
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
          </div>
        )}

        {/* Port Drawer at bottom */}
        <PortDrawer ports={ports} />
      </div>
    );
  }

  // ==========================================
  // DEFAULT RENDER STYLE
  // ==========================================

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
        </div>
      </div>

      {/* Unified body: summary shows pill+minimal fields, details shows all fields */}
      {(() => {
        const isDetails = data.viewLevel === 'details';
        const visibleFields = isDetails ? schema.fields : getFieldsForSummary(schema);

        return (
          <div className="px-2 py-2 bg-surface flex flex-col gap-2 flex-1 overflow-y-auto min-h-0">
            {/* Display name row */}
            <div className="text-node-lg font-semibold text-content">
              {getDisplayName(data, schema)}
            </div>

            {/* Background Color (details only) */}
            {isDetails && data.onInstanceColorChange && (schema.backgroundColorPolicy === 'tints' || schema.backgroundColorPolicy === 'any') && (
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

            {/* Deployable dropdown (details only) */}
            {isDetails && data.deployables && (
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
        );
      })()}

      {/* Port Drawer at bottom */}
      <PortDrawer ports={ports} />
    </div>
  );
});

export default ConstructNode;
