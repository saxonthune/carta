import { useState, useCallback, useEffect } from 'react';
import { registry } from '../constructs/registry';
import FieldDefinitionEditor from './FieldDefinitionEditor';
import type { ConstructSchema, FieldDefinition, CompilationFormat, PortConfig, PortDirection, PortPosition } from '../constructs/types';

interface ConstructDetailsEditorProps {
  construct: ConstructSchema | null;
  isNew: boolean;
  onSave: (construct: ConstructSchema, isNew: boolean) => void;
  onCancel: () => void;
  onDelete: (type: string) => void;
}

const COMPILATION_FORMATS: CompilationFormat[] = ['json', 'openapi', 'dbml', 'custom'];
const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#1e293b'
];

const PORT_DIRECTIONS: PortDirection[] = ['in', 'out', 'parent', 'child', 'bidi'];
const PORT_POSITIONS: PortPosition[] = ['left', 'right', 'top', 'bottom'];

const createEmptySchema = (): ConstructSchema => ({
  type: '',
  displayName: '',
  color: '#6366f1',
  description: '',
  fields: [],
  ports: [
    { id: 'parent', direction: 'parent', position: 'top', offset: 50, label: 'Parent' },
    { id: 'child', direction: 'child', position: 'bottom', offset: 50, label: 'Children' },
    { id: 'flow-in', direction: 'in', position: 'left', offset: 50, label: 'Flow In' },
    { id: 'flow-out', direction: 'out', position: 'right', offset: 50, label: 'Flow Out' },
  ],
  compilation: {
    format: 'json',
    sectionHeader: ''
  },
  isBuiltIn: false
});

export default function ConstructDetailsEditor({
  construct,
  isNew,
  onSave,
  onCancel,
  onDelete
}: ConstructDetailsEditorProps) {
  const [formData, setFormData] = useState<ConstructSchema>(
    construct || createEmptySchema()
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedFieldIndex, setExpandedFieldIndex] = useState<number | null>(null);

  const isReadOnly = formData.isBuiltIn === true;

  useEffect(() => {
    setFormData(construct || createEmptySchema());
    setErrors({});
    setExpandedFieldIndex(null);
  }, [construct]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.type.trim()) {
      newErrors.type = 'Type identifier is required';
    } else if (!/^[a-z][a-z0-9_]*$/.test(formData.type)) {
      newErrors.type = 'Type must start with lowercase letter and contain only lowercase letters, numbers, underscores';
    } else if (isNew && registry.hasSchema(formData.type)) {
      newErrors.type = 'A construct with this type already exists';
    }

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isNew]);

  const handleSave = () => {
    if (isReadOnly) return;
    if (validateForm()) {
      onSave(formData, isNew);
    }
  };

  const handleDelete = () => {
    if (isReadOnly) return;
    if (confirm(`Are you sure you want to delete "${formData.displayName}"?`)) {
      onDelete(formData.type);
    }
  };

  const updateField = (key: keyof ConstructSchema, value: unknown) => {
    if (isReadOnly) return;
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const addField = () => {
    if (isReadOnly) return;
    const newField: FieldDefinition = {
      name: `field_${formData.fields.length + 1}`,
      label: `Field ${formData.fields.length + 1}`,
      type: 'text',
      placeholder: ''
    };
    setFormData(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
    setExpandedFieldIndex(formData.fields.length);
  };

  const updateFieldDefinition = (index: number, field: FieldDefinition) => {
    if (isReadOnly) return;
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === index ? field : f)
    }));
  };

  const removeField = (index: number) => {
    if (isReadOnly) return;
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index)
    }));
    setExpandedFieldIndex(null);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (isReadOnly) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.fields.length) return;

    const newFields = [...formData.fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFormData(prev => ({ ...prev, fields: newFields }));
    setExpandedFieldIndex(newIndex);
  };

  // Port management functions
  const addPort = () => {
    if (isReadOnly) return;
    const ports = formData.ports || [];
    const newPort: PortConfig = {
      id: `port_${ports.length + 1}`,
      direction: 'bidi',
      position: 'right',
      offset: 50,
      label: `Port ${ports.length + 1}`,
    };
    setFormData(prev => ({
      ...prev,
      ports: [...(prev.ports || []), newPort]
    }));
  };

  const updatePort = (index: number, updates: Partial<PortConfig>) => {
    if (isReadOnly) return;
    setFormData(prev => ({
      ...prev,
      ports: (prev.ports || []).map((p, i) => i === index ? { ...p, ...updates } : p)
    }));
  };

  const removePort = (index: number) => {
    if (isReadOnly) return;
    setFormData(prev => ({
      ...prev,
      ports: (prev.ports || []).filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <h2 className="m-0 text-xl font-semibold text-content">{isNew ? 'Create New Construct' : formData.displayName}</h2>
        {isReadOnly && (
          <span className="px-2.5 py-1 bg-surface-elevated rounded text-xs text-content-muted">Read-only (Built-in)</span>
        )}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column: Basic Info + Compilation Settings */}
        <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
          <div className="bg-surface-elevated rounded-lg p-4">
            <h3 className="m-0 mb-3 text-sm font-semibold text-content-muted uppercase tracking-wide">Basic Information</h3>

            <div className="mb-3">
              <label className="block mb-1 text-sm font-medium text-content">
                Type Identifier
                <span className="block text-[11px] font-normal text-content-muted">Unique ID (e.g., "my_construct")</span>
              </label>
              <input
                type="text"
                className={`w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent transition-colors ${errors.type ? '!border-danger' : ''}`}
                value={formData.type}
                onChange={(e) => updateField('type', e.target.value.toLowerCase())}
                placeholder="my_construct"
                disabled={isReadOnly || !isNew}
              />
              {errors.type && <span className="block mt-1 text-xs text-danger">{errors.type}</span>}
            </div>

            <div className="mb-3">
              <label className="block mb-1 text-sm font-medium text-content">Display Name</label>
              <input
                type="text"
                className={`w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent transition-colors ${errors.displayName ? '!border-danger' : ''}`}
                value={formData.displayName}
                onChange={(e) => updateField('displayName', e.target.value)}
                placeholder="My Construct"
                disabled={isReadOnly}
              />
              {errors.displayName && <span className="block mt-1 text-xs text-danger">{errors.displayName}</span>}
            </div>

            <div className="mb-3">
              <label className="block mb-1 text-sm font-medium text-content">Color</label>
              <div className="flex flex-wrap gap-1 items-center">
                {DEFAULT_COLORS.slice(0, 6).map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-6 h-6 border-2 border-transparent rounded cursor-pointer transition-all hover:scale-110 ${formData.color === color ? 'border-white shadow-[0_0_0_2px_#6366f1]' : ''} ${isReadOnly ? 'cursor-not-allowed opacity-50' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => updateField('color', color)}
                    disabled={isReadOnly}
                  />
                ))}
                <input
                  type="color"
                  className="w-6 h-6 p-0 border-none rounded cursor-pointer"
                  value={formData.color}
                  onChange={(e) => updateField('color', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-content">Description</label>
              <textarea
                className="w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm resize-none focus:outline-none focus:border-accent transition-colors"
                value={formData.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe what this construct represents..."
                rows={2}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="bg-surface-elevated rounded-lg p-4">
            <h3 className="m-0 mb-3 text-sm font-semibold text-content-muted uppercase tracking-wide">Compilation</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-sm font-medium text-content">Format</label>
                <select
                  className="w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent transition-colors"
                  value={formData.compilation.format}
                  onChange={(e) => updateField('compilation', {
                    ...formData.compilation,
                    format: e.target.value as CompilationFormat
                  })}
                  disabled={isReadOnly}
                >
                  {COMPILATION_FORMATS.map(format => (
                    <option key={format} value={format}>{format.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-content">Section Header</label>
                <input
                  type="text"
                  className="w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent transition-colors"
                  value={formData.compilation.sectionHeader || ''}
                  onChange={(e) => updateField('compilation', {
                    ...formData.compilation,
                    sectionHeader: e.target.value
                  })}
                  placeholder="# My Section"
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>

          {/* Ports Configuration */}
          <div className="bg-surface-elevated rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Ports</h3>
              {!isReadOnly && (
                <button
                  className="px-2.5 py-1 bg-surface-alt rounded text-content text-xs cursor-pointer hover:bg-content-muted transition-colors"
                  onClick={addPort}
                >
                  + Add Port
                </button>
              )}
            </div>

            {(!formData.ports || formData.ports.length === 0) ? (
              <p className="text-content-muted text-sm italic m-0">No ports defined (defaults will be used)</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                {formData.ports.map((port, index) => (
                  <div key={index} className="bg-surface p-2 rounded border flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 px-2 py-1 bg-surface-alt rounded text-content text-xs focus:outline-none"
                        value={port.id}
                        onChange={(e) => updatePort(index, { id: e.target.value })}
                        placeholder="Port ID"
                        disabled={isReadOnly}
                      />
                      <input
                        type="text"
                        className="flex-1 px-2 py-1 bg-surface-alt rounded text-content text-xs focus:outline-none"
                        value={port.label}
                        onChange={(e) => updatePort(index, { label: e.target.value })}
                        placeholder="Label"
                        disabled={isReadOnly}
                      />
                      {!isReadOnly && (
                        <button
                          className="px-2 py-1 text-danger text-xs hover:bg-danger-muted rounded"
                          onClick={() => removePort(index)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 px-2 py-1 bg-surface-alt rounded text-content text-xs focus:outline-none"
                        value={port.direction}
                        onChange={(e) => updatePort(index, { direction: e.target.value as PortDirection })}
                        disabled={isReadOnly}
                      >
                        {PORT_DIRECTIONS.map(dir => (
                          <option key={dir} value={dir}>{dir}</option>
                        ))}
                      </select>
                      <select
                        className="flex-1 px-2 py-1 bg-surface-alt rounded text-content text-xs focus:outline-none"
                        value={port.position}
                        onChange={(e) => updatePort(index, { position: e.target.value as PortPosition })}
                        disabled={isReadOnly}
                      >
                        {PORT_POSITIONS.map(pos => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className="w-16 px-2 py-1 bg-surface-alt rounded text-content text-xs focus:outline-none"
                        value={port.offset}
                        onChange={(e) => updatePort(index, { offset: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                        min={0}
                        max={100}
                        placeholder="Offset %"
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Fields */}
        <div className="bg-surface-elevated rounded-lg p-4 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-3 shrink-0">
            <h3 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Fields</h3>
            {!isReadOnly && (
              <button
                className="px-2.5 py-1 bg-surface-alt rounded text-content text-xs cursor-pointer hover:bg-content-muted transition-colors"
                onClick={addField}
              >
                + Add Field
              </button>
            )}
          </div>

          {formData.fields.length === 0 ? (
            <p className="text-content-muted text-sm italic m-0">No fields defined yet</p>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="flex flex-col gap-2">
                {formData.fields.map((field, index) => (
                  <FieldDefinitionEditor
                    key={index}
                    field={field}
                    index={index}
                    isExpanded={expandedFieldIndex === index}
                    isReadOnly={isReadOnly}
                    onToggleExpand={() => setExpandedFieldIndex(
                      expandedFieldIndex === index ? null : index
                    )}
                    onChange={(updatedField) => updateFieldDefinition(index, updatedField)}
                    onRemove={() => removeField(index)}
                    onMoveUp={() => moveField(index, 'up')}
                    onMoveDown={() => moveField(index, 'down')}
                    canMoveUp={index > 0}
                    canMoveDown={index < formData.fields.length - 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 pt-4 border-t shrink-0">
        {!isReadOnly && !isNew && (
          <button
            className="px-5 py-2.5 bg-transparent border-danger rounded-md text-danger text-sm font-medium cursor-pointer hover:bg-danger hover:text-white transition-all"
            onClick={handleDelete}
          >
            Delete Construct
          </button>
        )}
        <div className="flex gap-3 ml-auto">
          <button
            className="px-5 py-2.5 bg-transparent rounded-md text-content text-sm font-medium cursor-pointer hover:bg-surface-alt transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          {!isReadOnly && (
            <button
              className="px-5 py-2.5 bg-accent border-none rounded-md text-white text-sm font-medium cursor-pointer hover:bg-accent-hover transition-colors"
              onClick={handleSave}
            >
              {isNew ? 'Create Construct' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
