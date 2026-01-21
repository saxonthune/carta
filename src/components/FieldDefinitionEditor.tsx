import { useState } from 'react';
import type { FieldDefinition, DataKind, DisplayHint } from '../constructs/types';

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

const DATA_KINDS: { value: DataKind; label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'enum', label: 'Enum' },
];

const DISPLAY_HINTS: { value: DisplayHint | ''; label: string }[] = [
  { value: '', label: 'Default' },
  { value: 'multiline', label: 'Multiline' },
  { value: 'code', label: 'Code' },
  { value: 'password', label: 'Password' },
  { value: 'url', label: 'URL' },
  { value: 'color', label: 'Color' },
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
              onChange={(e) => updateField({ type: e.target.value as DataKind })}
              disabled={isReadOnly}
            >
              {DATA_KINDS.map(ft => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
          </div>

          {field.type === 'string' && (
            <div className="mb-3">
              <label className="block mb-1.5 text-xs font-medium text-content-muted">Display Hint</label>
              <select
                className="w-full px-3 py-2 bg-surface rounded text-content text-sm focus:outline-none focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed"
                value={field.displayHint || ''}
                onChange={(e) => updateField({ displayHint: (e.target.value || undefined) as DisplayHint | undefined })}
                disabled={isReadOnly}
              >
                {DISPLAY_HINTS.map(dh => (
                  <option key={dh.value} value={dh.value}>{dh.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-3">
            <label className="block mb-1.5 text-xs font-medium text-content-muted">Description (AI context)</label>
            <textarea
              className="w-full px-3 py-2 bg-surface rounded text-content text-sm focus:outline-none focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed resize-y"
              value={field.description || ''}
              onChange={(e) => updateField({ description: e.target.value })}
              placeholder="Describe this field's purpose for AI compilation..."
              rows={2}
              disabled={isReadOnly}
            />
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

          <div className="mb-3">
            <label className="flex items-center gap-2 text-xs font-medium text-content-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={field.displayInMap ?? false}
                onChange={(e) => updateField({ displayInMap: e.target.checked })}
                disabled={isReadOnly}
                className="w-4 h-4 accent-[var(--color-accent)] disabled:opacity-60 disabled:cursor-not-allowed"
              />
              Display in Map
            </label>
          </div>

          {field.type === 'enum' && (
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
        </div>
      )}
    </div>
  );
}
