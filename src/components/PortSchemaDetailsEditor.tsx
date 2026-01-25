import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDocument } from '../hooks/useDocument';
import type { PortSchema, Polarity, PortPosition } from '../constructs/types';

// Convert string to kebab-case for IDs
// (e.g., "Flow In" → "flow-in", "Custom Port #1" → "custom-port-#1")
function toKebabCase(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-');
}

interface PortSchemaDetailsEditorProps {
  portSchema: PortSchema | null;
  isNew: boolean;
  onSave: (schema: PortSchema, isNew: boolean) => void;
  onDelete: (id: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const createEmptySchema = (): PortSchema => ({
  id: '',
  displayName: '',
  semanticDescription: '',
  polarity: 'source',
  compatibleWith: [],
  defaultPosition: 'right',
  color: '#6366f1',
});

const POLARITY_OPTIONS: { value: Polarity; label: string }[] = [
  { value: 'source', label: 'Source' },
  { value: 'sink', label: 'Sink' },
  { value: 'bidirectional', label: 'Bidirectional' },
];

const POSITION_OPTIONS: { value: PortPosition; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#1e293b'
];

const PortSchemaDetailsEditor = forwardRef<{ save: () => void }, PortSchemaDetailsEditorProps>(
  function PortSchemaDetailsEditor({
    portSchema,
    isNew,
    onSave,
    onDelete,
    onDirtyChange
  }, ref) {
  const { getPortSchemas } = useDocument();
  const [formData, setFormData] = useState<PortSchema>(
    portSchema || createEmptySchema()
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [newCompatibleWith, setNewCompatibleWith] = useState('');

  const allPortSchemas = getPortSchemas();

  // Reset form state when portSchema prop changes
  useEffect(() => {
    setFormData(portSchema || createEmptySchema());
    setErrors({});
    setIsDirty(false);
  }, [portSchema]);

  // Check if form has unsaved changes
  useEffect(() => {
    if (!portSchema) {
      // For new schemas, check if user has entered any meaningful data
      const hasContent = formData.displayName.trim() !== '' || formData.semanticDescription.trim() !== '';
      setIsDirty(hasContent);
      return;
    }
    const isDifferent = JSON.stringify(formData) !== JSON.stringify(portSchema);
    setIsDirty(isDifferent);
  }, [formData, portSchema]);

  // Notify parent when dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }

    // Derive id from displayName
    const derivedId = toKebabCase(formData.displayName);
    if (!derivedId) {
      newErrors.displayName = 'Display name must contain at least one alphanumeric character';
    } else if (isNew && allPortSchemas.some(s => s.id === derivedId)) {
      newErrors.displayName = 'A port schema with this display name already exists';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isNew, allPortSchemas]);

  const handleSave = useCallback(() => {
    if (validateForm()) {
      // Auto-derive id from displayName for new schemas
      const schemaToSave = isNew
        ? { ...formData, id: toKebabCase(formData.displayName) }
        : formData;
      onSave(schemaToSave, isNew);
    }
  }, [formData, isNew, onSave, validateForm]);

  // Expose save method via ref for parent to trigger from confirmation modal
  useImperativeHandle(ref, () => ({
    save: handleSave
  }), [handleSave]);

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${formData.displayName}"?`)) {
      onDelete(formData.id);
    }
  };

  const updateField = (key: keyof PortSchema, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const addCompatibleWith = () => {
    if (!newCompatibleWith.trim()) return;
    const updated = Array.from(new Set([...formData.compatibleWith, newCompatibleWith.trim()]));
    updateField('compatibleWith', updated);
    setNewCompatibleWith('');
  };

  const removeCompatibleWith = (value: string) => {
    updateField('compatibleWith', formData.compatibleWith.filter(c => c !== value));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-0 shrink-0 pb-3 border-b">
        <div className="flex items-center gap-3">
          <h2 className="m-0 text-xl font-semibold text-content">{isNew ? 'Create New Port Schema' : formData.displayName}</h2>
          {isDirty && (
            <span className="px-2.5 py-1 bg-surface-elevated rounded text-xs text-content-muted">• Unsaved changes</span>
          )}
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <button
              className="px-3 py-1.5 bg-transparent border border-danger rounded text-danger text-sm font-medium cursor-pointer hover:bg-danger hover:text-white transition-all"
              onClick={handleDelete}
            >
              Delete
            </button>
          )}
          <button
            className="px-3 py-1.5 bg-accent border-none rounded text-white text-sm font-medium cursor-pointer hover:bg-accent-hover transition-colors"
            onClick={handleSave}
          >
            {isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-surface-elevated rounded-lg p-4">
          {/* Display Name */}
          <div className="mb-3">
            <label className="block mb-1 text-sm font-medium text-content">Display Name</label>
            <input
              type="text"
              className={`w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent transition-colors ${errors.displayName ? '!border-danger' : ''}`}
              value={formData.displayName}
              onChange={(e) => updateField('displayName', e.target.value)}
              placeholder="Flow In"
            />
            {formData.displayName && (
              <span className="block mt-1 text-[11px] text-content-muted">ID: {toKebabCase(formData.displayName)}</span>
            )}
            {errors.displayName && <span className="block mt-1 text-xs text-danger">{errors.displayName}</span>}
          </div>

          {/* ID (read-only for existing) */}
          {!isNew && (
            <div className="mb-3">
              <label className="block mb-1 text-sm font-medium text-content">ID</label>
              <input
                type="text"
                className="w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none disabled:opacity-50"
                value={formData.id}
                disabled
              />
            </div>
          )}

          {/* Semantic Description */}
          <div className="mb-3">
            <label className="block mb-1 text-sm font-medium text-content">Semantic Description</label>
            <textarea
              className="w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm resize-none focus:outline-none focus:border-accent transition-colors"
              value={formData.semanticDescription}
              onChange={(e) => updateField('semanticDescription', e.target.value)}
              placeholder="Describe what this port type represents for AI compilation..."
              rows={3}
            />
          </div>

          {/* Polarity */}
          <div className="mb-3">
            <label className="block mb-1 text-sm font-medium text-content">Polarity</label>
            <select
              className="w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent"
              value={formData.polarity}
              onChange={(e) => updateField('polarity', e.target.value as Polarity)}
            >
              {POLARITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div className="mb-3">
            <label className="block mb-1 text-sm font-medium text-content">Color</label>
            <div className="flex flex-wrap gap-1 items-center">
              {DEFAULT_COLORS.slice(0, 6).map(color => (
                <button
                  key={color}
                  type="button"
                  className={`w-6 h-6 border-2 border-transparent rounded cursor-pointer transition-all hover:scale-110 ${formData.color === color ? 'border-white shadow-[0_0_0_2px_#6366f1]' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => updateField('color', color)}
                />
              ))}
              <input
                type="color"
                className="w-6 h-6 p-0 border-none rounded cursor-pointer"
                value={formData.color}
                onChange={(e) => updateField('color', e.target.value)}
              />
            </div>
          </div>

          {/* Default Position */}
          <div className="mb-3">
            <label className="block mb-1 text-sm font-medium text-content">Default Position</label>
            <select
              className="w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent"
              value={formData.defaultPosition}
              onChange={(e) => updateField('defaultPosition', e.target.value as PortPosition)}
            >
              {POSITION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Compatible With */}
          <div className="mb-3">
            <label className="block mb-1 text-sm font-medium text-content">Compatible With</label>
            <p className="text-xs text-content-muted mb-2">Specify which port IDs can connect. Use patterns like '*source*', '*sink*', or '*' for all.</p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                className="flex-1 px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent"
                value={newCompatibleWith}
                onChange={(e) => setNewCompatibleWith(e.target.value)}
                placeholder="e.g., flow-out, *source*, or *"
                onKeyDown={(e) => e.key === 'Enter' && addCompatibleWith()}
              />
              <button
                className="px-3 py-2 bg-surface-alt rounded text-content text-sm cursor-pointer hover:bg-content-muted transition-colors"
                onClick={addCompatibleWith}
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {formData.compatibleWith.map(value => (
                <div key={value} className="flex items-center gap-1 px-2 py-1 bg-surface-alt rounded text-sm text-content">
                  <span>{value}</span>
                  <button
                    className="w-4 h-4 flex items-center justify-center bg-transparent border-none rounded-full text-content-muted cursor-pointer text-sm hover:bg-danger hover:text-white"
                    onClick={() => removeCompatibleWith(value)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Expected Complement */}
          <div className="mb-3">
            <label className="block mb-1 text-sm font-medium text-content">Expected Complement</label>
            <p className="text-xs text-content-muted mb-2">Optional: another port ID that commonly connects to this one (for UI hints only)</p>
            <select
              className="w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent"
              value={formData.expectedComplement || ''}
              onChange={(e) => updateField('expectedComplement', e.target.value || undefined)}
            >
              <option value="">None</option>
              {allPortSchemas
                .filter(s => s.id !== formData.id)
                .map(schema => (
                  <option key={schema.id} value={schema.id}>{schema.displayName}</option>
                ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
  }
);

PortSchemaDetailsEditor.displayName = 'PortSchemaDetailsEditor';

export default PortSchemaDetailsEditor;
