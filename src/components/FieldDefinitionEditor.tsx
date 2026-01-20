import { useState } from 'react';
import type { FieldDefinition, FieldType, ColumnDef } from '../constructs/types';

interface FieldDefinitionEditorProps {
  field: FieldDefinition;
  index: number;
  isExpanded: boolean;
  isReadOnly: boolean;
  onToggleExpand: () => void;
  onChange: (field: FieldDefinition) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'table', label: 'Table' },
  { value: 'code', label: 'Code / Textarea' },
  { value: 'connection', label: 'Connection' }
];

const COLUMN_TYPES: { value: string; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'boolean', label: 'Boolean' }
];

export default function FieldDefinitionEditor({
  field,
  index,
  isExpanded,
  isReadOnly,
  onToggleExpand,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown
}: FieldDefinitionEditorProps) {
  const [newOption, setNewOption] = useState('');
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnLabel, setNewColumnLabel] = useState('');

  const updateField = (updates: Partial<FieldDefinition>) => {
    if (isReadOnly) return;
    onChange({ ...field, ...updates });
  };

  const addOption = () => {
    if (!newOption.trim() || isReadOnly) return;
    const options = field.options || [];
    updateField({ options: [...options, newOption.trim()] });
    setNewOption('');
  };

  const removeOption = (optionIndex: number) => {
    if (isReadOnly) return;
    const options = field.options || [];
    updateField({ options: options.filter((_, i) => i !== optionIndex) });
  };

  const addColumn = () => {
    if (!newColumnName.trim() || !newColumnLabel.trim() || isReadOnly) return;
    const columns = field.columns || [];
    const newCol: ColumnDef = {
      name: newColumnName.trim().toLowerCase().replace(/\s+/g, '_'),
      label: newColumnLabel.trim(),
      type: 'text'
    };
    updateField({ columns: [...columns, newCol] });
    setNewColumnName('');
    setNewColumnLabel('');
  };

  const updateColumn = (colIndex: number, updates: Partial<ColumnDef>) => {
    if (isReadOnly) return;
    const columns = field.columns || [];
    updateField({
      columns: columns.map((col, i) => i === colIndex ? { ...col, ...updates } : col)
    });
  };

  const removeColumn = (colIndex: number) => {
    if (isReadOnly) return;
    const columns = field.columns || [];
    updateField({ columns: columns.filter((_, i) => i !== colIndex) });
  };

  const [editingColumnOptions, setEditingColumnOptions] = useState<number | null>(null);
  const [columnOptionInput, setColumnOptionInput] = useState('');

  const addColumnOption = (colIndex: number) => {
    if (!columnOptionInput.trim() || isReadOnly) return;
    const columns = field.columns || [];
    const col = columns[colIndex];
    const options = col.options || [];
    updateColumn(colIndex, { options: [...options, columnOptionInput.trim()] });
    setColumnOptionInput('');
  };

  const removeColumnOption = (colIndex: number, optIndex: number) => {
    if (isReadOnly) return;
    const columns = field.columns || [];
    const col = columns[colIndex];
    const options = col.options || [];
    updateColumn(colIndex, { options: options.filter((_, i) => i !== optIndex) });
  };

  return (
    <div className={`bg-surface rounded-md overflow-hidden ${isExpanded ? 'border-accent' : 'border'}`}>
      <div
        className="flex justify-between items-center px-4 py-3 cursor-pointer hover:bg-surface-elevated transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-content-muted font-medium">#{index + 1}</span>
          <span className="text-sm font-medium text-content">{field.label || field.name}</span>
          <span className="text-xs px-2 py-0.5 bg-surface-alt rounded text-content-muted">{field.type}</span>
        </div>
        <div className="flex items-center gap-1">
          {!isReadOnly && (
            <>
              <button
                className="w-7 h-7 flex items-center justify-center bg-transparent rounded text-content-muted cursor-pointer text-sm hover:bg-surface-alt hover:text-content transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                disabled={!canMoveUp}
                title="Move Up"
              >
                ↑
              </button>
              <button
                className="w-7 h-7 flex items-center justify-center bg-transparent rounded text-content-muted cursor-pointer text-sm hover:bg-surface-alt hover:text-content transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                disabled={!canMoveDown}
                title="Move Down"
              >
                ↓
              </button>
              <button
                className="w-7 h-7 flex items-center justify-center bg-transparent rounded text-content-muted cursor-pointer text-sm hover:bg-danger hover:border-danger hover:text-white transition-all"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                title="Remove Field"
              >
                ×
              </button>
            </>
          )}
          <span className="w-6 h-6 flex items-center justify-center text-content-muted text-base ml-2">
            {isExpanded ? '−' : '+'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-surface-elevated border-t border">
          <div className="mb-3">
            <label className="block mb-1.5 text-xs font-medium text-content-muted">Field Name (internal)</label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-surface rounded text-content text-sm focus:outline-none focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed"
              value={field.name}
              onChange={(e) => updateField({ name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
              placeholder="field_name"
              disabled={isReadOnly}
            />
          </div>

          <div className="mb-3">
            <label className="block mb-1.5 text-xs font-medium text-content-muted">Label (display)</label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-surface rounded text-content text-sm focus:outline-none focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed"
              value={field.label}
              onChange={(e) => updateField({ label: e.target.value })}
              placeholder="Field Label"
              disabled={isReadOnly}
            />
          </div>

          <div className="mb-3">
            <label className="block mb-1.5 text-xs font-medium text-content-muted">Type</label>
            <select
              className="w-full px-3 py-2 bg-surface rounded text-content text-sm focus:outline-none focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed"
              value={field.type}
              onChange={(e) => updateField({ type: e.target.value as FieldType })}
              disabled={isReadOnly}
            >
              {FIELD_TYPES.map(ft => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="block mb-1.5 text-xs font-medium text-content-muted">Placeholder</label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-surface rounded text-content text-sm focus:outline-none focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed"
              value={field.placeholder || ''}
              onChange={(e) => updateField({ placeholder: e.target.value })}
              placeholder="Enter placeholder text..."
              disabled={isReadOnly}
            />
          </div>

          {field.type === 'dropdown' && (
            <div className="mt-4 pt-4 border-t border">
              <label className="block mb-2 text-xs font-medium text-content-muted">Options</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(field.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 bg-surface-alt rounded text-sm text-content">
                    <span>{opt}</span>
                    {!isReadOnly && (
                      <button
                        className="w-4 h-4 flex items-center justify-center bg-transparent border-none rounded-full text-content-muted cursor-pointer text-sm hover:bg-danger hover:text-white"
                        onClick={() => removeOption(i)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!isReadOnly && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-2.5 py-1.5 bg-surface rounded text-content text-sm focus:outline-none focus:border-accent"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="New option"
                    onKeyDown={(e) => e.key === 'Enter' && addOption()}
                  />
                  <button
                    className="px-3 py-1.5 bg-surface-alt rounded text-content text-sm cursor-pointer hover:bg-content-muted"
                    onClick={addOption}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          )}

          {field.type === 'connection' && (
            <div className="mb-3">
              <label className="block mb-1.5 text-xs font-medium text-content-muted">Connection Target Type</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-surface rounded text-content text-sm focus:outline-none focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed"
                value={field.connectionType || ''}
                onChange={(e) => updateField({ connectionType: e.target.value })}
                placeholder="e.g., table, model"
                disabled={isReadOnly}
              />
            </div>
          )}

          {field.type === 'table' && (
            <div className="mt-4 pt-4 border-t border">
              <label className="block mb-2 text-xs font-medium text-content-muted">Table Columns</label>
              <div className="flex flex-col gap-2 mb-3">
                {(field.columns || []).map((col, colIndex) => (
                  <div key={colIndex} className="flex flex-col gap-2 p-3 bg-surface rounded-md">
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        className="w-[120px] shrink-0 px-2.5 py-1.5 bg-surface-elevated rounded text-content text-xs focus:outline-none focus:border-accent disabled:opacity-60"
                        value={col.name}
                        onChange={(e) => updateColumn(colIndex, { name: e.target.value })}
                        placeholder="name"
                        disabled={isReadOnly}
                      />
                      <input
                        type="text"
                        className="flex-1 px-2.5 py-1.5 bg-surface-elevated rounded text-content text-xs focus:outline-none focus:border-accent disabled:opacity-60"
                        value={col.label}
                        onChange={(e) => updateColumn(colIndex, { label: e.target.value })}
                        placeholder="Label"
                        disabled={isReadOnly}
                      />
                      <select
                        className="w-[100px] shrink-0 px-2.5 py-1.5 bg-surface-elevated rounded text-content text-xs focus:outline-none focus:border-accent disabled:opacity-60"
                        value={col.type || 'text'}
                        onChange={(e) => updateColumn(colIndex, { type: e.target.value as ColumnDef['type'] })}
                        disabled={isReadOnly}
                      >
                        {COLUMN_TYPES.map(ct => (
                          <option key={ct.value} value={ct.value}>{ct.label}</option>
                        ))}
                      </select>
                      {!isReadOnly && (
                        <button
                          className="w-7 h-7 shrink-0 flex items-center justify-center bg-transparent rounded text-content-muted cursor-pointer text-base hover:bg-danger hover:border-danger hover:text-white transition-all"
                          onClick={() => removeColumn(colIndex)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {col.type === 'dropdown' && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border">
                        <span className="text-[11px] text-content-muted">Options:</span>
                        {(col.options || []).map((opt, optIndex) => (
                          <span key={optIndex} className="flex items-center gap-1 px-2 py-0.5 bg-surface-alt rounded text-xs text-content-muted">
                            {opt}
                            {!isReadOnly && (
                              <button
                                className="w-3.5 h-3.5 flex items-center justify-center bg-transparent border-none rounded-full text-content-muted cursor-pointer text-xs hover:bg-danger hover:text-white"
                                onClick={() => removeColumnOption(colIndex, optIndex)}
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                        {!isReadOnly && (
                          editingColumnOptions === colIndex ? (
                            <div className="flex gap-1 items-center">
                              <input
                                type="text"
                                className="w-20 px-2 py-1 bg-surface-elevated rounded text-content text-xs"
                                value={columnOptionInput}
                                onChange={(e) => setColumnOptionInput(e.target.value)}
                                placeholder="option"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') addColumnOption(colIndex);
                                  if (e.key === 'Escape') {
                                    setEditingColumnOptions(null);
                                    setColumnOptionInput('');
                                  }
                                }}
                                autoFocus
                              />
                              <button
                                className="px-2 py-1 bg-surface-alt rounded text-content text-xs cursor-pointer hover:bg-content-muted"
                                onClick={() => addColumnOption(colIndex)}
                              >
                                +
                              </button>
                              <button
                                className="px-2 py-1 bg-surface-alt rounded text-content text-xs cursor-pointer hover:bg-content-muted"
                                onClick={() => {
                                  setEditingColumnOptions(null);
                                  setColumnOptionInput('');
                                }}
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <button
                              className="px-2 py-0.5 bg-transparent border-dashed rounded text-content-muted text-xs cursor-pointer hover:border-accent hover:text-accent transition-colors"
                              onClick={() => setEditingColumnOptions(colIndex)}
                            >
                              + Add
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!isReadOnly && (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 bg-surface rounded text-content text-sm focus:outline-none focus:border-accent"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder="column_name"
                  />
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 bg-surface rounded text-content text-sm focus:outline-none focus:border-accent"
                    value={newColumnLabel}
                    onChange={(e) => setNewColumnLabel(e.target.value)}
                    placeholder="Column Label"
                  />
                  <button
                    className="px-4 py-2 bg-surface-alt rounded text-content text-sm cursor-pointer whitespace-nowrap hover:bg-content-muted transition-colors"
                    onClick={addColumn}
                  >
                    Add Column
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
