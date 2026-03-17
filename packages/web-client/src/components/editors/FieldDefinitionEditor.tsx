import { useState } from 'react';
import Button from '../ui/Button';
import { toSnakeCase } from '../../utils/stringUtils';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import type { FieldSchema, DataKind, DisplayHint, DisplayTier } from '@carta/schema';

interface FieldDefinitionEditorProps {
  field: FieldSchema;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onChange: (field: FieldSchema) => void;
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
  { value: 'markdown', label: 'Markdown' },
];

export default function FieldDefinitionEditor({
  field,
  isExpanded,
  onToggleExpand,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown
}: FieldDefinitionEditorProps) {
  const [newOption, setNewOption] = useState('');

  const updateField = (updates: Partial<FieldSchema>) => {
    // If label is being updated, auto-derive name from it
    if (updates.label) {
      updates.name = toSnakeCase(updates.label);
    }
    
    onChange({ ...field, ...updates });
  };

  const addOption = () => {
    if (!newOption.trim()) return;
    const options = field.options || [];
    updateField({ options: [...options, { value: newOption.trim() }] });
    setNewOption('');
  };

  const removeOption = (optionIndex: number) => {
    const options = field.options || [];
    updateField({ options: options.filter((_, i) => i !== optionIndex) });
  };

  return (
    <div className="bg-surface rounded-md overflow-hidden">
      <div
        className="flex justify-between items-center px-4 py-3 cursor-pointer hover:bg-surface-elevated transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-content">{field.label || field.name}</span>
          <span className="text-xs px-2 py-0.5 bg-surface-alt rounded text-content-muted">{field.type}</span>
        </div>
        <div className="flex items-center gap-1">
          <>
            <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={!canMoveUp} title="Move Up" className="w-7 h-7 p-0">↑</Button>
            <Button variant="ghost" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={!canMoveDown} title="Move Down" className="w-7 h-7 p-0">↓</Button>
            <Button variant="danger" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Remove Field" className="w-7 h-7 p-0">×</Button>
          </>
          <span className="w-6 h-6 flex items-center justify-center text-content-muted text-base ml-2">
            {isExpanded ? '−' : '+'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-surface-elevated">
          <div className="mb-3">
            <label className="block mb-1.5 text-xs font-medium text-content-muted">Label (display)</label>
            <Input
              value={field.label}
              onChange={(e) => updateField({ label: e.target.value })}
              placeholder="Field Label"
            />
          </div>

          <div className="mb-3">
            <label className="block mb-1.5 text-xs font-medium text-content-muted">Type</label>
            <Select
              value={field.type}
              onChange={(e) => updateField({ type: e.target.value as DataKind })}
            >
              {DATA_KINDS.map(ft => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </Select>
          </div>

          {field.type === 'string' && (
            <div className="mb-3 hidden">
              <label className="block mb-1.5 text-xs font-medium text-content-muted">Display Hint</label>
              <Select
                value={field.displayHint || ''}
                onChange={(e) => updateField({ displayHint: (e.target.value || undefined) as DisplayHint | undefined })}
              >
                {DISPLAY_HINTS.map(dh => (
                  <option key={dh.value} value={dh.value}>{dh.label}</option>
                ))}
              </Select>
            </div>
          )}

          <div className="mb-3">
            <label className="block mb-1.5 text-xs font-medium text-content-muted">Description (AI context)</label>
            <Textarea
              className="resize-y"
              value={field.semanticDescription || ''}
              onChange={(e) => updateField({ semanticDescription: e.target.value })}
              placeholder="Describe this field's purpose for AI compilation..."
              rows={2}
            />
          </div>

          <div className="mb-3">
            <label className="block mb-1.5 text-xs font-medium text-content-muted">Placeholder</label>
            <Input
              value={field.placeholder || ''}
              onChange={(e) => updateField({ placeholder: e.target.value })}
              placeholder="Enter placeholder text..."
            />
          </div>

          <div className="mb-3">
            <label className="block mb-1.5 text-xs font-medium text-content-muted">Display Tier</label>
            <Select
              value={field.displayTier || ''}
              onChange={(e) => updateField({ displayTier: e.target.value as DisplayTier || undefined })}
            >
              <option value="summary">Summary (shown on canvas)</option>
              <option value="">Inspector only</option>
            </Select>
          </div>

          {field.type === 'enum' && (
            <div className="mt-4 pt-4">
              <label className="block mb-2 text-xs font-medium text-content-muted">Options</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(field.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 bg-surface-alt rounded text-sm text-content">
                    <span>{opt.value}</span>
                    <button
                      className="w-4 h-4 flex items-center justify-center bg-transparent border-none rounded-full text-content-muted cursor-pointer text-sm hover:bg-danger hover:text-white"
                      onClick={() => removeOption(i)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                  <Input
                    size="sm"
                    className="flex-1"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="New option"
                    onKeyDown={(e) => e.key === 'Enter' && addOption()}
                  />
                  <Button size="sm" variant="secondary" onClick={addOption}>Add</Button>
                </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
