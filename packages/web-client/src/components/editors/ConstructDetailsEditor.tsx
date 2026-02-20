import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { SquaresFour, Crosshair, List, GitBranch } from '@phosphor-icons/react';
import { useSchemas } from '../../hooks/useSchemas';
import Button from '../ui/Button';
import OverviewTab from '../construct-editor/OverviewTab';
import PortsTab from '../construct-editor/PortsTab';
import FieldsTab from '../construct-editor/FieldsTab';
import RelatedTab from '../construct-editor/RelatedTab';
import TabBar, { type Tab } from '../ui/TabBar';
import { toSnakeCase } from '../../utils/stringUtils';
import type { ConstructSchema, FieldSchema, PortConfig } from '@carta/domain';

interface ConstructDetailsEditorProps {
  construct: ConstructSchema | null;
  isNew: boolean;
  onSave: (construct: ConstructSchema, isNew: boolean) => void;
  onDelete: (type: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  compact?: boolean;
}

type EditorTab = 'basic' | 'ports' | 'fields' | 'related';

const createEmptySchema = (): ConstructSchema => ({
  type: '',
  displayName: '',
  color: '#6366f1',
  semanticDescription: '',
  fields: [],
  ports: [
    { id: 'parent', portType: 'parent', label: 'Parent' },
    { id: 'child', portType: 'child', label: 'Children' },
    { id: 'flow-in', portType: 'flow-in', label: 'Flow In' },
    { id: 'flow-out', portType: 'flow-out', label: 'Flow Out' },
  ],
  compilation: {
    format: 'json',
    sectionHeader: ''
  }
});

const ConstructDetailsEditor = forwardRef<{ save: () => void }, ConstructDetailsEditorProps>(
  function ConstructDetailsEditor({
    construct,
    isNew,
    onSave,
    onDelete,
    onDirtyChange,
    compact = false
  }, ref) {
  const { getSchema } = useSchemas();
  const [formData, setFormData] = useState<ConstructSchema>(
    construct || createEmptySchema()
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedFieldIndex, setExpandedFieldIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>('basic');
  const [isDirty, setIsDirty] = useState(false);

  // Reset form state when construct prop changes
  useEffect(() => {
    // eslint-disable-next-line
    setFormData(construct || createEmptySchema());
    setErrors({});
    setExpandedFieldIndex(null);
    setActiveTab('basic');
    setIsDirty(false);
  }, [construct]);

  // Check if form has unsaved changes
  useEffect(() => {
    if (!construct) {
      // For new constructs, check if user has entered any meaningful data
      const hasContent = formData.displayName.trim() !== '' || (formData.semanticDescription?.trim() ?? '') !== '';
      setIsDirty(hasContent);
      return;
    }
    const isDifferent = JSON.stringify(formData) !== JSON.stringify(construct);
    setIsDirty(isDifferent);
  }, [formData, construct]);

  // Notify parent when dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }

    // Derive type from displayName
    const derivedType = toSnakeCase(formData.displayName);
    if (!derivedType) {
      newErrors.displayName = 'Display name must contain at least one alphanumeric character';
    } else if (isNew && getSchema(derivedType) !== undefined) {
      newErrors.displayName = 'A construct with this display name already exists';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isNew]);

  const handleSave = useCallback(() => {
    if (validateForm()) {
      onSave(formData, isNew);
    }
  }, [formData, isNew, onSave, validateForm]);

  // Expose save method via ref for parent to trigger from confirmation modal
  useImperativeHandle(ref, () => ({
    save: handleSave
  }), [handleSave]);

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${formData.displayName}"?`)) {
      onDelete(formData.type);
    }
  };

  const updateField = (key: keyof ConstructSchema, value: unknown) => {
    if (key === 'displayName' && typeof value === 'string') {
      // Auto-sync type when displayName changes
      setFormData(prev => ({ 
        ...prev, 
        displayName: value,
        type: toSnakeCase(value)
      }));
    } else {
      setFormData(prev => ({ ...prev, [key]: value }));
    }
  };

  const addField = () => {
    const newField: FieldSchema = {
      name: `field_${formData.fields.length + 1}`,
      label: `Field ${formData.fields.length + 1}`,
      type: 'string',
      placeholder: ''
    };
    setFormData(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
    setExpandedFieldIndex(formData.fields.length);
  };

  const updateFieldDefinition = (index: number, field: FieldSchema) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === index ? field : f)
    }));
  };

  const removeField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index)
    }));
    setExpandedFieldIndex(null);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.fields.length) return;

    const newFields = [...formData.fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFormData(prev => ({ ...prev, fields: newFields }));
    setExpandedFieldIndex(newIndex);
  };

  // Port management functions
  const addPort = () => {
    const newPort: PortConfig = {
      id: 'port',
      portType: 'symmetric',
      label: 'Port',
    };
    setFormData(prev => ({
      ...prev,
      ports: [...(prev.ports || []), newPort]
    }));
  };

  const updatePort = (index: number, updates: Partial<PortConfig>) => {
    setFormData(prev => ({
      ...prev,
      ports: (prev.ports || []).map((p, i) => i === index ? { ...p, ...updates } : p)
    }));
  };

  const removePort = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ports: (prev.ports || []).filter((_, i) => i !== index)
    }));
  };

  const tabs: Tab<EditorTab>[] = [
    { id: 'basic', label: 'Overview', icon: <SquaresFour weight="regular" size={18} /> },
    { id: 'ports', label: 'Ports', icon: <Crosshair weight="regular" size={18} /> },
    { id: 'fields', label: 'Fields', icon: <List weight="regular" size={18} /> },
    { id: 'related', label: 'Related', icon: <GitBranch weight="regular" size={18} /> },
  ];

  // Compact mode: horizontal tabs instead of vertical TabBar
  if (compact) {
    return (
      <div className="h-full flex flex-col p-3">
        <div className="flex items-center justify-between gap-2 mb-0 shrink-0 pb-2 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="m-0 text-sm font-semibold text-content truncate">
              {isNew ? 'New Construct' : formData.displayName}
            </h2>
            {isDirty && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-surface-elevated rounded text-content-muted">
                • Unsaved
              </span>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {!isNew && (
              <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
            )}
            <Button variant="accent" size="sm" onClick={handleSave}>{isNew ? 'Create' : 'Save'}</Button>
          </div>
        </div>

        {/* Horizontal tabs for compact mode */}
        <div className="flex gap-1 py-2 border-b border-border shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`px-2 py-1 text-[10px] rounded transition-colors ${
                activeTab === tab.id
                  ? 'bg-accent/20 text-accent font-medium'
                  : 'text-content-muted hover:bg-surface-depth-1'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto min-h-0 mt-2">
          {activeTab === 'basic' && (
            <OverviewTab
              formData={formData}
              errors={errors}
              updateField={updateField}
            />
          )}
          {activeTab === 'ports' && (
            <PortsTab
              formData={formData}
              addPort={addPort}
              updatePort={updatePort}
              removePort={removePort}
            />
          )}
          {activeTab === 'fields' && (
            <FieldsTab
              formData={formData}
              expandedFieldIndex={expandedFieldIndex}
              addField={addField}
              updateFieldDefinition={updateFieldDefinition}
              removeField={removeField}
              moveField={moveField}
              setExpandedFieldIndex={setExpandedFieldIndex}
            />
          )}
          {activeTab === 'related' && (
            <RelatedTab schemaType={formData.type} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-0 shrink-0 pb-3 border-b">
        <div className="flex items-center gap-3">
          <h2 className="m-0 text-xl font-semibold text-content">{isNew ? 'Create New Construct' : formData.displayName}</h2>
          {isDirty && (
            <span className="px-2.5 py-1 bg-surface-elevated rounded text-xs text-content-muted">• Unsaved changes</span>
          )}
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          )}
          <Button variant="accent" onClick={handleSave}>{isNew ? 'Create' : 'Save'}</Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-3">
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Content Area */}
        <div className="flex-1 bg-surface-depth-3 p-1 overflow-y-auto min-h-0 rounded-xl">
          {activeTab === 'basic' && (
            <OverviewTab
              formData={formData}
              errors={errors}
              updateField={updateField}
            />
          )}
          {activeTab === 'ports' && (
            <PortsTab
              formData={formData}
              addPort={addPort}
              updatePort={updatePort}
              removePort={removePort}
            />
          )}
          {activeTab === 'fields' && (
            <FieldsTab
              formData={formData}
              expandedFieldIndex={expandedFieldIndex}
              addField={addField}
              updateFieldDefinition={updateFieldDefinition}
              removeField={removeField}
              moveField={moveField}
              setExpandedFieldIndex={setExpandedFieldIndex}
            />
          )}
          {activeTab === 'related' && (
            <RelatedTab schemaType={formData.type} />
          )}
        </div>
      </div>
    </div>
  );
  }
);

ConstructDetailsEditor.displayName = 'ConstructDetailsEditor';

export default ConstructDetailsEditor;
