import { useState } from 'react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { toSnakeCase } from '../../utils/stringUtils';
import FieldPreview from './FieldPreview';
import type { FieldSchema, DataKind, DisplayHint, DisplayTier } from '@carta/schema';

const DATA_KINDS: { value: DataKind; label: string; description: string }[] = [
  { value: 'string', label: 'String', description: 'Free-form text. Use for names, descriptions, URLs, or any textual data.' },
  { value: 'number', label: 'Number', description: 'Numeric values like counts, IDs, ports, or measurements.' },
  { value: 'boolean', label: 'Boolean', description: 'Yes/no, true/false, or on/off toggles.' },
  { value: 'date', label: 'Date', description: 'Timestamps or calendar dates.' },
  { value: 'enum', label: 'Enum', description: 'Pick from a predefined list of options (like dropdowns).' },
];

const DISPLAY_HINTS: { value: DisplayHint | ''; label: string }[] = [
  { value: '', label: 'Default' },
  { value: 'multiline', label: 'Multiline' },
  { value: 'code', label: 'Code' },
  { value: 'url', label: 'URL' },
  { value: 'markdown', label: 'Markdown' },
];

interface FieldSubWizardProps {
  field: FieldSchema;
  onChange: (updates: Partial<FieldSchema>) => void;
}

export default function FieldSubWizard({ field, onChange }: FieldSubWizardProps) {
  const [newOptionValue, setNewOptionValue] = useState('');
  const [newOptionDesc, setNewOptionDesc] = useState('');

  const addOption = () => {
    if (!newOptionValue.trim()) return;
    const options = field.options || [];
    onChange({ options: [...options, { value: newOptionValue.trim(), semanticDescription: newOptionDesc.trim() || undefined }] });
    setNewOptionValue('');
    setNewOptionDesc('');
  };

  const removeOption = (index: number) => {
    const options = field.options || [];
    onChange({ options: options.filter((_, i) => i !== index) });
  };

  const updateOption = (index: number, updates: Partial<{ value: string; semanticDescription: string }>) => {
    const options = field.options || [];
    onChange({ options: options.map((opt, i) => i === index ? { ...opt, ...updates } : opt) });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block mb-1 text-sm font-medium text-content">What is this field called?</label>
        <Input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g., Route, Method, Description"
          autoFocus
        />
        {field.label && (
          <span className="block mt-1 text-[11px] text-content-muted">
            Field name: <code className="text-content-subtle">{toSnakeCase(field.label)}</code>
          </span>
        )}
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-content">Semantic Description</label>
        <Textarea
          value={field.semanticDescription || ''}
          onChange={(e) => onChange({ semanticDescription: e.target.value })}
          placeholder="Describe what this field represents..."
          rows={2}
        />
        <span className="block mt-1 text-[11px] text-content-muted">
          Describe what this field represents so AI can use it during compilation
        </span>
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-content">Data Kind</label>
        <Select
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value as DataKind })}
        >
          {DATA_KINDS.map(dk => (
            <option key={dk.value} value={dk.value}>{dk.label}</option>
          ))}
        </Select>
        <span className="block mt-1 text-[11px] text-content-muted">
          {DATA_KINDS.find(dk => dk.value === field.type)?.description}
        </span>
      </div>

      {field.type === 'string' && (
        <div>
          <label className="block mb-1 text-sm font-medium text-content">Display Hint</label>
          <Select
            value={field.displayHint || ''}
            onChange={(e) => onChange({ displayHint: (e.target.value || undefined) as DisplayHint | undefined })}
          >
            {DISPLAY_HINTS.map(dh => (
              <option key={dh.value} value={dh.value}>{dh.label}</option>
            ))}
          </Select>
        </div>
      )}

      {field.type === 'enum' && (
        <div>
          <label className="block mb-1 text-sm font-medium text-content">Options</label>
          {(field.options && field.options.length > 0) && (
            <div className="flex flex-col gap-1.5 mb-2">
              {field.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2 bg-surface rounded-md px-2 py-1.5">
                  <Input
                    size="sm"
                    className="flex-1 min-w-0"
                    value={opt.value}
                    onChange={(e) => updateOption(i, { value: e.target.value })}
                    placeholder="Value"
                  />
                  <Input
                    size="sm"
                    className="flex-1 min-w-0"
                    value={opt.semanticDescription || ''}
                    onChange={(e) => updateOption(i, { semanticDescription: e.target.value })}
                    placeholder="Description (optional)"
                  />
                  <button
                    className="w-6 h-6 flex items-center justify-center text-content-muted hover:text-danger transition-colors shrink-0"
                    onClick={() => removeOption(i)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              size="sm"
              className="flex-1 min-w-0"
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              placeholder="New option value"
              onKeyDown={(e) => e.key === 'Enter' && addOption()}
            />
            <Input
              size="sm"
              className="flex-1 min-w-0"
              value={newOptionDesc}
              onChange={(e) => setNewOptionDesc(e.target.value)}
              placeholder="Description (optional)"
              onKeyDown={(e) => e.key === 'Enter' && addOption()}
            />
            <button
              className="px-3 py-1.5 bg-surface-alt rounded text-sm text-content hover:bg-surface-elevated transition-colors shrink-0"
              onClick={addOption}
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="block mb-1 text-sm font-medium text-content">Display Tier</label>
        <Select
          value={field.displayTier || ''}
          onChange={(e) => onChange({ displayTier: (e.target.value as DisplayTier) || undefined })}
        >
          <option value="summary">Summary (shown on canvas)</option>
          <option value="">Inspector only</option>
        </Select>
        <span className="block mt-1 text-[11px] text-content-muted">
          Controls whether this field is visible on canvas nodes. Pill assignment is done via the Field Display Editor.
        </span>
      </div>

      {/* Preview */}
      <div className="border border-border rounded-md p-3 bg-surface">
        <label className="block mb-1 text-[11px] font-semibold text-content-muted uppercase">Preview</label>
        <FieldPreview field={field} />
      </div>
    </div>
  );
}
