import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { getDisplayName, getFieldsForTier } from '@carta/domain';
import { useDeployables } from '../../../hooks/useDeployables';
import CreateDeployablePopover from '../../CreateDeployablePopover';
import PortDrawer from '../PortDrawer';
import IndexBasedDropZones from '../IndexBasedDropZones';
import ColorPicker from '../../ui/ColorPicker';
import { WindowIcon } from '../../ui/icons';
import { formatValue, ADD_NEW_DEPLOYABLE } from './shared';
import type { ConstructNodeVariantProps } from './shared';

export function ConstructNodeCard({
  data,
  selected,
  schema,
  ports,
  isConnectionTarget,
  isDragActive,
  sourcePortType,
  lodTransitionStyle,
}: ConstructNodeVariantProps) {
  const { addDeployable } = useDeployables();
  const [showNewDeployableModal, setShowNewDeployableModal] = useState(false);

  const color = data.instanceColor || schema.color;
  const displayValue = getDisplayName(data, schema);
  const minimalFields = getFieldsForTier(schema, 'minimal');

  const bgStyle: React.CSSProperties = data.instanceColor
    ? { backgroundColor: data.instanceColor }
    : {};

  const handleDeployableChange = (value: string) => {
    if (value === ADD_NEW_DEPLOYABLE) {
      setShowNewDeployableModal(true);
    } else {
      data.onDeployableChange?.(value || null);
    }
  };

  const handleCreateDeployable = (name: string, description: string) => {
    const newDeployable = addDeployable({
      name: name.trim(),
      description: description.trim(),
    });
    data.onDeployableChange?.(newDeployable.id);
    setShowNewDeployableModal(false);
  };

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
                  policy={schema.backgroundColorPolicy}
                  baseColor={schema.color}
                  value={data.instanceColor}
                  onChange={data.onInstanceColorChange}
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

      {/* Anchor handles — target handles enlarged during drag for detection */}
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
      <PortDrawer ports={ports} />
    </div>
  );
}
