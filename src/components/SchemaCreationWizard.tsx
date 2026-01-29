import { useState, useCallback } from 'react';
import { useDocument } from '../hooks/useDocument';
import WizardModal from './ui/WizardModal';
import type { ConstructSchema, FieldSchema, DataKind, DisplayHint } from '../constructs/types';

// Convert string to snake_case
function toSnakeCase(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '_');
}

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#1e293b'
];

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
];

interface SchemaCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  editSchema?: ConstructSchema;
}

function createEmptySchema(): ConstructSchema {
  return {
    type: '',
    displayName: '',
    color: '#6366f1',
    semanticDescription: '',
    fields: [],
    ports: [
      { id: 'parent', portType: 'parent', position: 'top', offset: 50, label: 'Parent' },
      { id: 'child', portType: 'child', position: 'bottom', offset: 50, label: 'Children' },
      { id: 'flow-in', portType: 'flow-in', position: 'left', offset: 50, label: 'Flow In' },
      { id: 'flow-out', portType: 'flow-out', position: 'right', offset: 50, label: 'Flow Out' },
    ],
    compilation: { format: 'json', sectionHeader: '' },
  };
}

export default function SchemaCreationWizard({ isOpen, onClose, editSchema }: SchemaCreationWizardProps) {
  const { addSchema, updateSchema, getSchema } = useDocument();
  const isEditMode = !!editSchema;

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ConstructSchema>(editSchema || createEmptySchema());
  const [fieldSubWizard, setFieldSubWizard] = useState<{ active: boolean; fieldIndex: number | null }>({ active: false, fieldIndex: null });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset state when modal opens/closes
  const handleClose = useCallback(() => {
    setStep(0);
    setFormData(editSchema || createEmptySchema());
    setFieldSubWizard({ active: false, fieldIndex: null });
    setErrors({});
    onClose();
  }, [onClose, editSchema]);

  // --- Basics ---
  const updateBasicField = (key: keyof ConstructSchema, value: unknown) => {
    if (key === 'displayName' && typeof value === 'string') {
      setFormData(prev => ({ ...prev, displayName: value, type: toSnakeCase(value) }));
    } else {
      setFormData(prev => ({ ...prev, [key]: value }));
    }
    // Clear errors on change
    if (errors[key as string]) {
      setErrors(prev => { const next = { ...prev }; delete next[key as string]; return next; });
    }
  };

  // --- Fields ---
  const addField = () => {
    const newField: FieldSchema = {
      name: `field_${formData.fields.length + 1}`,
      label: '',
      type: 'string',
    };
    setFormData(prev => ({ ...prev, fields: [...prev.fields, newField] }));
    setFieldSubWizard({ active: true, fieldIndex: formData.fields.length });
  };

  const updateFieldAt = (index: number, updates: Partial<FieldSchema>) => {
    if (updates.label !== undefined) {
      updates.name = toSnakeCase(updates.label);
    }
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === index ? { ...f, ...updates } : f),
    }));
  };

  const removeField = (index: number) => {
    setFormData(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }));
    if (fieldSubWizard.fieldIndex === index) {
      setFieldSubWizard({ active: false, fieldIndex: null });
    }
  };

  // --- Validation ---
  const validateBasics = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }
    const derivedType = toSnakeCase(formData.displayName);
    if (derivedType && !isEditMode && getSchema(derivedType)) {
      newErrors.displayName = 'A construct with this name already exists';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Navigation ---
  const handleNext = () => {
    if (fieldSubWizard.active) {
      // "Done" button in field sub-wizard: return to fields list
      setFieldSubWizard({ active: false, fieldIndex: null });
      return;
    }

    if (step === 0) {
      if (!validateBasics()) return;
      setStep(1);
    } else if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      // Save
      handleSave();
    }
  };

  const handleBack = () => {
    if (fieldSubWizard.active) {
      setFieldSubWizard({ active: false, fieldIndex: null });
      return;
    }
    if (step > 0) setStep(step - 1);
  };

  const handleSave = () => {
    if (!validateBasics()) {
      setStep(0);
      return;
    }

    const schema: ConstructSchema = {
      ...formData,
      type: toSnakeCase(formData.displayName),
      compilation: formData.compilation || { format: 'json', sectionHeader: '' },
    };

    if (isEditMode) {
      updateSchema(schema.type, schema);
    } else {
      addSchema(schema);
    }
    handleClose();
  };

  // Determine wizard footer state
  const canGoBack = fieldSubWizard.active || step > 0;
  const canGoNext = fieldSubWizard.active || step === 0 ? formData.displayName.trim() !== '' : true;
  const isLastStep = step === 2 && !fieldSubWizard.active;
  const nextLabel = fieldSubWizard.active ? 'Save Field Changes' : undefined;
  const backLabel = fieldSubWizard.active ? 'Back to field list' : undefined;
  const hideStepIndicator = fieldSubWizard.active;

  return (
    <WizardModal
      isOpen={isOpen}
      title={isEditMode ? 'Edit Construct Schema' : 'New Construct Schema'}
      currentStep={step}
      totalSteps={3}
      stepLabels={['Basics', 'Fields', 'Ports']}
      onClose={handleClose}
      onBack={handleBack}
      onNext={handleNext}
      canGoBack={canGoBack}
      canGoNext={canGoNext}
      isLastStep={isLastStep}
      nextLabel={nextLabel}
      backLabel={backLabel}
      hideStepIndicator={hideStepIndicator}
    >
      {step === 0 && <BasicsStep formData={formData} errors={errors} updateField={updateBasicField} />}
      {step === 1 && (
        fieldSubWizard.active && fieldSubWizard.fieldIndex !== null ? (
          <FieldSubWizard
            field={formData.fields[fieldSubWizard.fieldIndex]}
            onChange={(updates) => updateFieldAt(fieldSubWizard.fieldIndex!, updates)}
          />
        ) : (
          <FieldsListStep
            fields={formData.fields}
            onEdit={(index) => setFieldSubWizard({ active: true, fieldIndex: index })}
            onRemove={removeField}
            onAdd={addField}
          />
        )
      )}
      {step === 2 && <PortsPlaceholder />}
    </WizardModal>
  );
}

// ============ Step Components ============

function BasicsStep({ formData, errors, updateField }: {
  formData: ConstructSchema;
  errors: Record<string, string>;
  updateField: (key: keyof ConstructSchema, value: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block mb-1 text-sm font-medium text-content">Display Name</label>
        <input
          type="text"
          className={`w-full px-3 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:ring-1 focus:ring-accent ${errors.displayName ? 'ring-1 ring-danger' : ''}`}
          value={formData.displayName}
          onChange={(e) => updateField('displayName', e.target.value)}
          placeholder="e.g., REST Controller, Database Table"
          autoFocus
        />
        {formData.displayName && (
          <span className="block mt-1 text-[11px] text-content-muted">
            Type ID: <code className="text-content-subtle">{toSnakeCase(formData.displayName)}</code>
          </span>
        )}
        {errors.displayName && <span className="block mt-1 text-xs text-danger">{errors.displayName}</span>}
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-content">Semantic Description</label>
        <textarea
          className="w-full px-3 py-2 bg-surface rounded-md text-content text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          value={formData.semanticDescription || ''}
          onChange={(e) => updateField('semanticDescription', e.target.value)}
          placeholder="Describe what this construct represents..."
          rows={3}
        />
        <span className="block mt-1 text-[11px] text-content-muted">
          Add a description that separates this construct schema from the others around it
        </span>
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-content">Color</label>
        <div className="flex flex-wrap gap-1.5 items-center">
          {DEFAULT_COLORS.map(color => (
            <button
              key={color}
              type="button"
              className={`w-7 h-7 border-2 rounded cursor-pointer transition-all hover:scale-110 ${formData.color === color ? 'border-white shadow-[0_0_0_2px_var(--color-accent)]' : 'border-transparent'}`}
              style={{ backgroundColor: color }}
              onClick={() => updateField('color', color)}
            />
          ))}
          <input
            type="color"
            className="w-7 h-7 p-0 border-none rounded cursor-pointer"
            value={formData.color}
            onChange={(e) => updateField('color', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function FieldsListStep({ fields, onEdit, onRemove, onAdd }: {
  fields: FieldSchema[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {fields.length === 0 ? (
        <div className="text-center py-8 text-content-muted text-sm">
          <p className="mb-2">No fields defined yet</p>
          <p className="text-xs">Fields let users enter data on construct instances</p>
        </div>
      ) : (
        fields.map((field, index) => (
          <div
            key={index}
            className="flex items-center justify-between px-3 py-2.5 bg-surface rounded-md hover:bg-surface-elevated transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-content truncate">{field.label || field.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded text-content-muted uppercase">{field.type}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="w-8 h-8 flex items-center justify-center text-content-muted hover:text-content transition-colors rounded hover:bg-surface-alt"
                onClick={() => onEdit(index)}
                title="Edit field"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                className="w-8 h-8 flex items-center justify-center text-content-muted hover:text-danger transition-colors rounded hover:bg-surface-alt"
                onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                title="Remove field"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          </div>
        ))
      )}
      <button
        className="w-full px-3 py-2.5 text-sm font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded-md transition-colors"
        onClick={onAdd}
      >
        + Add Field
      </button>
    </div>
  );
}

function FieldSubWizard({ field, onChange }: {
  field: FieldSchema;
  onChange: (updates: Partial<FieldSchema>) => void;
}) {
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
        <input
          type="text"
          className="w-full px-3 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:ring-1 focus:ring-accent"
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
        <textarea
          className="w-full px-3 py-2 bg-surface rounded-md text-content text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent"
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
        <select
          className="w-full px-3 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value as DataKind })}
        >
          {DATA_KINDS.map(dk => (
            <option key={dk.value} value={dk.value}>{dk.label}</option>
          ))}
        </select>
        <span className="block mt-1 text-[11px] text-content-muted">
          {DATA_KINDS.find(dk => dk.value === field.type)?.description}
        </span>
      </div>

      {field.type === 'string' && (
        <div>
          <label className="block mb-1 text-sm font-medium text-content">Display Hint</label>
          <select
            className="w-full px-3 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            value={field.displayHint || ''}
            onChange={(e) => onChange({ displayHint: (e.target.value || undefined) as DisplayHint | undefined })}
          >
            {DISPLAY_HINTS.map(dh => (
              <option key={dh.value} value={dh.value}>{dh.label}</option>
            ))}
          </select>
        </div>
      )}

      {field.type === 'enum' && (
        <div>
          <label className="block mb-1 text-sm font-medium text-content">Options</label>
          {(field.options && field.options.length > 0) && (
            <div className="flex flex-col gap-1.5 mb-2">
              {field.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2 bg-surface rounded-md px-2 py-1.5">
                  <input
                    type="text"
                    className="flex-1 min-w-0 px-2 py-1 bg-surface-alt rounded text-sm text-content focus:outline-none"
                    value={opt.value}
                    onChange={(e) => updateOption(i, { value: e.target.value })}
                    placeholder="Value"
                  />
                  <input
                    type="text"
                    className="flex-1 min-w-0 px-2 py-1 bg-surface-alt rounded text-sm text-content-muted focus:outline-none"
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
            <input
              type="text"
              className="flex-1 min-w-0 px-2 py-1.5 bg-surface rounded text-sm text-content focus:outline-none focus:ring-1 focus:ring-accent"
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              placeholder="New option value"
              onKeyDown={(e) => e.key === 'Enter' && addOption()}
            />
            <input
              type="text"
              className="flex-1 min-w-0 px-2 py-1.5 bg-surface rounded text-sm text-content-muted focus:outline-none focus:ring-1 focus:ring-accent"
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

      <label className="flex items-center gap-2 text-sm text-content cursor-pointer select-none">
        <input
          type="checkbox"
          checked={field.showInMinimalDisplay ?? false}
          onChange={(e) => onChange({ showInMinimalDisplay: e.target.checked })}
          className="w-4 h-4 accent-[var(--color-accent)]"
        />
        Show in minimal display
      </label>

      {/* Preview */}
      <div className="border border-border rounded-md p-3 bg-surface">
        <label className="block mb-1 text-[11px] font-semibold text-content-muted uppercase">Preview</label>
        <FieldPreview field={field} />
      </div>
    </div>
  );
}

function FieldPreview({ field }: { field: FieldSchema }) {
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm text-content">
        <input type="checkbox" disabled className="w-4 h-4" />
        {field.label || 'Field'}
      </label>
    );
  }
  if (field.type === 'enum') {
    return (
      <select className="w-full px-2 py-1.5 bg-surface-alt rounded text-sm text-content" disabled>
        <option>Select...</option>
        {(field.options || []).map((opt, i) => (
          <option key={i}>{opt.value}</option>
        ))}
      </select>
    );
  }
  if (field.type === 'number') {
    return <input type="number" className="w-full px-2 py-1.5 bg-surface-alt rounded text-sm text-content" placeholder={field.placeholder || 'Number'} disabled />;
  }
  if (field.type === 'date') {
    return <input type="date" className="w-full px-2 py-1.5 bg-surface-alt rounded text-sm text-content" disabled />;
  }
  // string
  if (field.displayHint === 'multiline' || field.displayHint === 'code') {
    return <textarea className="w-full px-2 py-1.5 bg-surface-alt rounded text-sm text-content font-mono resize-none" rows={2} placeholder={field.placeholder || 'Text'} disabled />;
  }
  return <input type="text" className="w-full px-2 py-1.5 bg-surface-alt rounded text-sm text-content" placeholder={field.placeholder || 'Text'} disabled />;
}

function PortsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-content-muted">
      <svg className="w-12 h-12 mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6m0 6v6M1 12h6m6 0h6" />
      </svg>
      <p className="text-sm font-medium">Port configuration will be available here soon</p>
      <p className="text-xs mt-1">Default ports (parent, child, flow-in, flow-out) will be applied</p>
    </div>
  );
}
