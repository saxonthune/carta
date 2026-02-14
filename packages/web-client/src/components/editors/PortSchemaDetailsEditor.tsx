import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { usePortSchemas } from '../../hooks/usePortSchemas';
import Button from '../ui/Button';
import SchemaGroupSelector from '../ui/SchemaGroupSelector';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { toKebabCase } from '../../utils/stringUtils';
import type { PortSchema, Polarity } from '@carta/domain';

interface PortSchemaDetailsEditorProps {
  portSchema: PortSchema | null;
  isNew: boolean;
  onSave: (schema: PortSchema, isNew: boolean) => void;
  onDelete: (id: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  compact?: boolean;
}

const createEmptySchema = (): PortSchema => ({
  id: '',
  displayName: '',
  semanticDescription: '',
  polarity: 'source',
  compatibleWith: [],
  color: '#6366f1',
});

const POLARITY_OPTIONS: { value: Polarity; label: string }[] = [
  { value: 'source', label: 'Source' },
  { value: 'sink', label: 'Sink' },
  { value: 'bidirectional', label: 'Bidirectional' },
  { value: 'relay', label: 'Relay' },
  { value: 'intercept', label: 'Intercept' },
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
    onDirtyChange,
    compact = false
  }, ref) {
  const { getPortSchemas } = usePortSchemas();
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
    <div className={`h-full flex flex-col ${compact ? 'p-3' : ''}`}>
      <div className={`flex items-center justify-between gap-2 mb-0 shrink-0 border-b ${compact ? 'pb-2' : 'pb-3 gap-3'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <h2 className={`m-0 font-semibold text-content truncate ${compact ? 'text-sm' : 'text-xl'}`}>
            {isNew ? 'New Port Schema' : formData.displayName}
          </h2>
          {isDirty && (
            <span className={`shrink-0 bg-surface-elevated rounded text-content-muted ${compact ? 'text-[10px] px-1.5 py-0.5' : 'px-2.5 py-1 text-xs'}`}>
              • Unsaved
            </span>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {!isNew && (
            <Button variant="danger" size={compact ? 'sm' : 'md'} onClick={handleDelete}>Delete</Button>
          )}
          <Button variant="accent" size={compact ? 'sm' : 'md'} onClick={handleSave}>{isNew ? 'Create' : 'Save'}</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className={`bg-surface-elevated rounded-lg ${compact ? 'p-2 mt-2' : 'p-4'}`}>
          {/* Display Name */}
          <div className={compact ? 'mb-2' : 'mb-3'}>
            <label className={`block mb-1 font-medium text-content ${compact ? 'text-xs' : 'text-sm'}`}>Display Name</label>
            <Input
              size={compact ? 'sm' : 'md'}
              className={`${errors.displayName ? '!border-danger' : ''}`}
              value={formData.displayName}
              onChange={(e) => updateField('displayName', e.target.value)}
              placeholder="Flow In"
            />
            {formData.displayName && (
              <span className="block mt-1 text-[10px] text-content-muted">ID: {toKebabCase(formData.displayName)}</span>
            )}
            {errors.displayName && <span className="block mt-1 text-[10px] text-danger">{errors.displayName}</span>}
          </div>

          {/* ID (read-only for existing) */}
          {!isNew && !compact && (
            <div className="mb-3">
              <label className="block mb-1 text-sm font-medium text-content">ID</label>
              <Input
                value={formData.id}
                disabled
              />
            </div>
          )}

          {/* Semantic Description */}
          <div className={compact ? 'mb-2' : 'mb-3'}>
            <label className={`block mb-1 font-medium text-content ${compact ? 'text-xs' : 'text-sm'}`}>Description</label>
            <Textarea
              size={compact ? 'sm' : 'md'}
              value={formData.semanticDescription}
              onChange={(e) => updateField('semanticDescription', e.target.value)}
              placeholder="Describe what this port type represents..."
              rows={compact ? 2 : 3}
            />
          </div>

          {/* Polarity */}
          <div className={compact ? 'mb-2' : 'mb-3'}>
            <label className={`block mb-1 font-medium text-content ${compact ? 'text-xs' : 'text-sm'}`}>Polarity</label>
            <Select
              size={compact ? 'sm' : 'md'}
              value={formData.polarity}
              onChange={(e) => updateField('polarity', e.target.value as Polarity)}
            >
              {POLARITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>

          {/* Color */}
          <div className={compact ? 'mb-2' : 'mb-3'}>
            <label className={`block mb-1 font-medium text-content ${compact ? 'text-xs' : 'text-sm'}`}>Color</label>
            <div className="flex flex-wrap gap-1 items-center">
              {DEFAULT_COLORS.slice(0, compact ? 4 : 6).map(color => (
                <button
                  key={color}
                  type="button"
                  className={`border-2 border-transparent rounded cursor-pointer transition-all hover:scale-110 ${compact ? 'w-5 h-5' : 'w-6 h-6'} ${formData.color === color ? 'border-white shadow-[0_0_0_2px_#6366f1]' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => updateField('color', color)}
                />
              ))}
              <input
                type="color"
                className={`p-0 border-none rounded cursor-pointer ${compact ? 'w-5 h-5' : 'w-6 h-6'}`}
                value={formData.color}
                onChange={(e) => updateField('color', e.target.value)}
              />
            </div>
          </div>

          {/* Compatible With */}
          <div className={compact ? 'mb-2' : 'mb-3'}>
            <label className={`block mb-1 font-medium text-content ${compact ? 'text-xs' : 'text-sm'}`}>Compatible With</label>
            {!compact && <p className="text-xs text-content-muted mb-2">Specify which port IDs can connect. Use '*' for all. Relay, intercept, and bidirectional polarities bypass this check.</p>}
            <div className="flex gap-2 mb-2">
              <Input
                size={compact ? 'sm' : 'md'}
                className="flex-1"
                value={newCompatibleWith}
                onChange={(e) => setNewCompatibleWith(e.target.value)}
                placeholder={compact ? 'e.g., *source*' : 'e.g., flow-out, *source*, or *'}
                onKeyDown={(e) => e.key === 'Enter' && addCompatibleWith()}
              />
              <button
                className={`bg-surface-alt rounded text-content cursor-pointer hover:bg-content-muted transition-colors ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
                onClick={addCompatibleWith}
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {formData.compatibleWith.map(value => (
                <div key={value} className={`flex items-center gap-1 bg-surface-alt rounded text-content ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-sm'}`}>
                  <span>{value}</span>
                  <button
                    className="w-3.5 h-3.5 flex items-center justify-center bg-transparent border-none rounded-full text-content-muted cursor-pointer text-xs hover:bg-danger hover:text-white"
                    onClick={() => removeCompatibleWith(value)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Expected Complement - hide in compact mode */}
          {!compact && (
            <div className="mb-3">
              <label className="block mb-1 text-sm font-medium text-content">Expected Complement</label>
              <p className="text-xs text-content-muted mb-2">Optional: another port ID that commonly connects to this one (for UI hints only)</p>
              <Select
                value={formData.expectedComplement || ''}
                onChange={(e) => updateField('expectedComplement', e.target.value || undefined)}
              >
                <option value="">None</option>
                {allPortSchemas
                  .filter(s => s.id !== formData.id)
                  .map(schema => (
                    <option key={schema.id} value={schema.id}>{schema.displayName}</option>
                  ))}
              </Select>
            </div>
          )}

          {/* Group - hide in compact mode */}
          {!compact && (
            <SchemaGroupSelector
              value={formData.groupId}
              onChange={(groupId) => updateField('groupId', groupId)}
              label="Group"
            />
          )}
        </div>
      </div>
    </div>
  );
  }
);

PortSchemaDetailsEditor.displayName = 'PortSchemaDetailsEditor';

export default PortSchemaDetailsEditor;
