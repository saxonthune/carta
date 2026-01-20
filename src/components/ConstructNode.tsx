import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { registry } from '../constructs/registry';
import { fieldRenderers } from './fields';
import type { ConstructNodeData } from '../constructs/types';

interface ConstructNodeComponentProps {
  data: ConstructNodeData;
  selected?: boolean;
}

const ConstructNode = memo(({ data, selected }: ConstructNodeComponentProps) => {
  const schema = registry.getSchema(data.constructType);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(data.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isExpanded = false,
    isRenaming,
    onRename,
    onValuesChange,
    onToggleExpand,
    onDeployableChange,
    deployables = [],
    deployableId,
  } = data;

  useEffect(() => {
    if (isRenaming) {
      setEditingName(true);
    }
  }, [isRenaming]);

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  const handleNameSubmit = useCallback(() => {
    if (nameValue.trim() && onRename) {
      onRename(nameValue.trim());
    }
    setEditingName(false);
  }, [nameValue, onRename]);

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setNameValue(data.name);
      setEditingName(false);
      if (onRename) onRename(data.name);
    }
  };

  const handleFieldChange = useCallback(
    (fieldName: string, value: unknown) => {
      if (onValuesChange) {
        onValuesChange({
          ...data.values,
          [fieldName]: value,
        });
      }
    },
    [data.values, onValuesChange]
  );

  if (!schema) {
    return (
      <div className="bg-danger-muted border-2 border-danger rounded-lg min-w-[250px] p-2 text-sm text-content">
        <Handle type="target" position={Position.Left} className="!bg-accent !w-2 !h-2" />
        <div>Unknown construct type: {data.constructType}</div>
        <Handle type="source" position={Position.Right} className="!bg-accent !w-2 !h-2" />
      </div>
    );
  }

  return (
    <div
      className={`bg-surface border-2 rounded-lg w-full h-full text-[13px] text-content shadow-md overflow-hidden relative flex flex-col ${isExpanded ? 'min-w-[300px]' : 'min-w-[250px]'} ${selected ? 'border-accent shadow-[0_0_0_2px_var(--color-accent)]' : 'border'}`}
    >
      {selected && (
        <NodeResizer
          minWidth={250}
          minHeight={100}
          lineClassName="!border-accent !border-2"
          handleClassName="!w-2 !h-2 !bg-accent !!border-surface !rounded-full"
        />
      )}

      <Handle type="target" position={Position.Left} className="!bg-accent !w-2 !h-2" />

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
        <span className="text-[11px] opacity-80 uppercase">{schema.displayName}</span>
      </div>

      {/* Deployable dropdown */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-alt border-b shrink-0">
        <svg
          className="w-3.5 h-3.5 text-content-subtle shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
        <select
          className={`nodrag flex-1 px-1.5 py-0.5 text-[11px] rounded bg-surface outline-none focus:border-accent transition-colors cursor-pointer ${
            !deployableId ? 'text-content-subtle italic' : 'text-content'
          }`}
          value={deployableId || ''}
          onChange={(e) => onDeployableChange?.(e.target.value || null)}
        >
          <option value="" className="italic text-content-subtle">None</option>
          {deployables.map((d) => (
            <option key={d.id} value={d.id} className="not-italic text-content">
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 px-2 py-1 bg-surface shrink-0">
        {editingName ? (
          <input
            ref={inputRef}
            type="text"
            className="flex-1 px-2 py-1 border-accent rounded bg-surface text-content text-[13px] font-medium outline-none nodrag"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
          />
        ) : (
          <span
            className="flex-1 cursor-text text-content text-sm"
            onDoubleClick={() => setEditingName(true)}
          >
            {data.name}
          </span>
        )}
        <button
          className="w-6 h-6 rounded bg-surface-alt text-content text-sm font-bold cursor-pointer flex items-center justify-center hover:bg-border-subtle hover:nodrag"
          onClick={onToggleExpand}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <div className="p-2 flex flex-col gap-2 flex-1 overflow-y-auto min-h-0">
          {schema.fields.map((field) => {
            const FieldRenderer = fieldRenderers[field.type];
            const value = data.values[field.name] ?? field.default;

            return (
              <FieldRenderer
                key={field.name}
                field={field}
                value={value}
                onChange={(newValue: unknown) =>
                  handleFieldChange(field.name, newValue)
                }
              />
            );
          })}
        </div>
      )}

      {!isExpanded && (
        <div className="px-2 py-1 text-xs text-content-muted flex-1 overflow-y-auto min-h-0">
          {schema.fields.slice(0, 2).map((field) => {
            const value = data.values[field.name];
            if (!value) return null;
            return (
              <div key={field.name} className="flex gap-1">
                <span className="text-content-subtle">{field.label}:</span>
                <span className="text-content font-medium">
                  {typeof value === 'object'
                    ? Array.isArray(value)
                      ? `${value.length} items`
                      : 'object'
                    : String(value)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-accent !w-2 !h-2" />
    </div>
  );
});

export default ConstructNode;
