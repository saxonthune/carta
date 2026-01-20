import { useState, useCallback, useEffect } from 'react';
import { registry } from '../constructs/registry';
import BasicInfoTab from './construct-editor/BasicInfoTab';
import CompilationTab from './construct-editor/CompilationTab';
import PortsTab from './construct-editor/PortsTab';
import FieldsTab from './construct-editor/FieldsTab';
import PreviewTab from './construct-editor/PreviewTab';
import type { ConstructSchema, FieldDefinition, PortConfig } from '../constructs/types';

interface ConstructDetailsEditorProps {
  construct: ConstructSchema | null;
  isNew: boolean;
  onSave: (construct: ConstructSchema, isNew: boolean) => void;
  onCancel: () => void;
  onDelete: (type: string) => void;
}

type EditorTab = 'basic' | 'compilation' | 'ports' | 'fields' | 'preview';

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
  const [activeTab, setActiveTab] = useState<EditorTab>('basic');

  const isReadOnly = formData.isBuiltIn === true;

  // Reset form state when construct prop changes
  useEffect(() => {
    // eslint-disable-next-line
    setFormData(construct || createEmptySchema());
    setErrors({});
    setExpandedFieldIndex(null);
    setActiveTab('basic');
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

  const tabs = [
    { id: 'basic' as EditorTab, label: 'Overview', icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    )},
    { id: 'compilation' as EditorTab, label: 'Compile', icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
      </svg>
    )},
    { id: 'ports' as EditorTab, label: 'Ports', icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6M1 12h6m6 0h6"/>
      </svg>
    )},
    { id: 'fields' as EditorTab, label: 'Fields', icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    )},
    { id: 'preview' as EditorTab, label: 'Preview', icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    )},
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 mb-0 shrink-0">
        <h2 className="m-0 text-xl font-semibold text-content">{isNew ? 'Create New Construct' : formData.displayName}</h2>
        {isReadOnly && (
          <span className="px-2.5 py-1 bg-surface-elevated rounded text-xs text-content-muted">Read-only (Built-in)</span>
        )}
      </div>

      <div className="flex-1 min-h-0 flex gap-3">
        {/* Vertical Tab Bar */}
        <div className="bg-surface-depth-1 flex flex-col w-[110px] shrink-0 p-2 gap-1 rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex flex-row items-center justify-start gap-2 p-1 rounded-lg cursor-pointer transition-all ${
                activeTab === tab.id
                  ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-sm shadow-accent/20'
                  : 'text-content bg-transparent hover:bg-surface-depth-3/50'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <div className="w-4 h-4 shrink-0">
                {tab.icon}
              </div>
              <span className="text-[12px] font-medium leading-tight">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-surface-depth-3 p-1 overflow-y-auto min-h-0 rounded-xl">
          {activeTab === 'basic' && (
            <BasicInfoTab
              formData={formData}
              errors={errors}
              isReadOnly={isReadOnly}
              isNew={isNew}
              updateField={updateField}
            />
          )}
          {activeTab === 'compilation' && (
            <CompilationTab
              formData={formData}
              isReadOnly={isReadOnly}
              updateField={updateField}
            />
          )}
          {activeTab === 'ports' && (
            <PortsTab
              formData={formData}
              isReadOnly={isReadOnly}
              addPort={addPort}
              updatePort={updatePort}
              removePort={removePort}
            />
          )}
          {activeTab === 'fields' && (
            <FieldsTab
              formData={formData}
              isReadOnly={isReadOnly}
              expandedFieldIndex={expandedFieldIndex}
              addField={addField}
              updateFieldDefinition={updateFieldDefinition}
              removeField={removeField}
              moveField={moveField}
              setExpandedFieldIndex={setExpandedFieldIndex}
            />
          )}
          {activeTab === 'preview' && (
            <PreviewTab formData={formData} />
          )}
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 pt-2 border-t shrink-0">
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
