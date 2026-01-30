import { useState, useCallback } from 'react';
import { useDocument } from '../hooks/useDocument';
import WizardModal from './ui/WizardModal';
import { toSnakeCase } from '../utils/stringUtils';
import BasicsStep from './schema-wizard/BasicsStep';
import FieldsListStep from './schema-wizard/FieldsListStep';
import FieldSubWizard from './schema-wizard/FieldSubWizard';
import PortsInitialChoice from './schema-wizard/PortsInitialChoice';
import PortsListStep from './schema-wizard/PortsListStep';
import PortSubWizard from './schema-wizard/PortSubWizard';
import type { ConstructSchema, FieldSchema, PortConfig } from '../constructs/types';

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
  const { addSchema, updateSchema, getSchema, portSchemas, addPortSchema, schemaGroups } = useDocument();
  const isEditMode = !!editSchema;

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ConstructSchema>(editSchema || createEmptySchema());
  const [fieldSubWizard, setFieldSubWizard] = useState<{ active: boolean; fieldIndex: number | null }>({ active: false, fieldIndex: null });
  const [portSubWizard, setPortSubWizard] = useState<{ active: boolean; portIndex: number | null; isNewPortSchema: boolean }>({ active: false, portIndex: null, isNewPortSchema: false });
  const [portsInitialized, setPortsInitialized] = useState(!!editSchema);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset state when modal opens/closes
  const handleClose = useCallback(() => {
    setStep(0);
    setFormData(editSchema || createEmptySchema());
    setFieldSubWizard({ active: false, fieldIndex: null });
    setPortSubWizard({ active: false, portIndex: null, isNewPortSchema: false });
    setPortsInitialized(!!editSchema);
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

  // --- Ports ---
  const addPortConfig = (portType: string) => {
    const ps = portSchemas.find(s => s.id === portType);
    if (!ps) return;
    const newPort: PortConfig = {
      id: portType,
      portType,
      position: ps.defaultPosition,
      offset: 50,
      label: ps.displayName,
    };
    setFormData(prev => ({ ...prev, ports: [...(prev.ports || []), newPort] }));
    setPortSubWizard({ active: true, portIndex: (formData.ports || []).length, isNewPortSchema: false });
  };

  const updatePortAt = (index: number, updates: Partial<PortConfig>) => {
    setFormData(prev => ({
      ...prev,
      ports: (prev.ports || []).map((p, i) => i === index ? { ...p, ...updates } : p),
    }));
  };

  const removePort = (index: number) => {
    setFormData(prev => ({ ...prev, ports: (prev.ports || []).filter((_, i) => i !== index) }));
    if (portSubWizard.portIndex === index) {
      setPortSubWizard({ active: false, portIndex: null, isNewPortSchema: false });
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
      setFieldSubWizard({ active: false, fieldIndex: null });
      return;
    }
    if (portSubWizard.active) {
      setPortSubWizard({ active: false, portIndex: null, isNewPortSchema: false });
      return;
    }

    if (step === 0) {
      if (!validateBasics()) return;
      setStep(1);
    } else if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      handleSave();
    }
  };

  const handleBack = () => {
    if (fieldSubWizard.active) {
      setFieldSubWizard({ active: false, fieldIndex: null });
      return;
    }
    if (portSubWizard.active) {
      setPortSubWizard({ active: false, portIndex: null, isNewPortSchema: false });
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
  const inSubWizard = fieldSubWizard.active || portSubWizard.active;
  const canGoBack = inSubWizard || step > 0;
  const canGoNext = inSubWizard || step === 0 ? formData.displayName.trim() !== '' : true;
  const isLastStep = step === 2 && !inSubWizard && portsInitialized;
  const nextLabel = fieldSubWizard.active ? 'Save Field Changes' : portSubWizard.active ? 'Save Port Changes' : undefined;
  const backLabel = fieldSubWizard.active ? 'Back to field list' : portSubWizard.active ? 'Back to port list' : undefined;
  const hideStepIndicator = inSubWizard || (step === 2 && !portsInitialized);

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
      {step === 0 && <BasicsStep formData={formData} errors={errors} updateField={updateBasicField} schemaGroups={schemaGroups} />}
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
      {step === 2 && (
        portSubWizard.active && portSubWizard.portIndex !== null ? (
          <PortSubWizard
            port={(formData.ports || [])[portSubWizard.portIndex]}
            isNewPortSchema={portSubWizard.isNewPortSchema}
            portSchemas={portSchemas}
            onChange={(updates) => updatePortAt(portSubWizard.portIndex!, updates)}
            onCreatePortSchema={(schema) => addPortSchema(schema)}
          />
        ) : portsInitialized ? (
          <PortsListStep
            ports={formData.ports || []}
            portSchemas={portSchemas}
            onEdit={(index) => setPortSubWizard({ active: true, portIndex: index, isNewPortSchema: false })}
            onRemove={removePort}
            onAdd={addPortConfig}
          />
        ) : (
          <PortsInitialChoice
            portSchemas={portSchemas}
            currentPorts={formData.ports || []}
            onStartWithDefaults={() => setPortsInitialized(true)}
            onLoadFromList={(selectedPortTypes) => {
              const newPorts: PortConfig[] = selectedPortTypes.map(portType => {
                const ps = portSchemas.find(s => s.id === portType);
                return {
                  id: portType,
                  portType,
                  position: ps?.defaultPosition || 'right',
                  offset: 50,
                  label: ps?.displayName || portType,
                };
              });
              setFormData(prev => ({ ...prev, ports: newPorts }));
              setPortsInitialized(true);
            }}
            onMakeOwn={() => {
              setFormData(prev => ({ ...prev, ports: [] }));
              setPortsInitialized(true);
              setPortSubWizard({ active: true, portIndex: null, isNewPortSchema: true });
            }}
          />
        )
      )}
    </WizardModal>
  );
}
