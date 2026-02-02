import { useState } from 'react';
import PortsInitialChoice from '../schema-wizard/PortsInitialChoice';
import PortsListStep from '../schema-wizard/PortsListStep';
import PortSubWizard from '../schema-wizard/PortSubWizard';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { ConstructSchema, PortConfig, PortSchema } from '@carta/domain';

interface PortsStepProps {
  formData: ConstructSchema;
  setFormData: React.Dispatch<React.SetStateAction<ConstructSchema>>;
  portSchemas: PortSchema[];
  addPortSchema: (schema: PortSchema) => void;
  portsInitialized: boolean;
  setPortsInitialized: (v: boolean) => void;
}

export default function PortsStep({
  formData,
  setFormData,
  portSchemas,
  addPortSchema,
  portsInitialized,
  setPortsInitialized,
}: PortsStepProps) {
  const [portSubWizard, setPortSubWizard] = useState<{ portIndex: number | null; isNewPortSchema: boolean } | null>(null);

  const addPortConfig = (portType: string) => {
    const ps = portSchemas.find(s => s.id === portType);
    if (!ps) return;
    const newPort: PortConfig = {
      id: portType,
      portType,
      label: ps.displayName,
    };
    setFormData(prev => ({ ...prev, ports: [...(prev.ports || []), newPort] }));
    setPortSubWizard({ portIndex: (formData.ports || []).length, isNewPortSchema: false });
  };

  const updatePortAt = (index: number, updates: Partial<PortConfig>) => {
    setFormData(prev => ({
      ...prev,
      ports: (prev.ports || []).map((p, i) => i === index ? { ...p, ...updates } : p),
    }));
  };

  const removePort = (index: number) => {
    setFormData(prev => ({ ...prev, ports: (prev.ports || []).filter((_, i) => i !== index) }));
    if (portSubWizard?.portIndex === index) {
      setPortSubWizard(null);
    }
  };

  if (!portsInitialized) {
    return (
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
              label: ps?.displayName || portType,
            };
          });
          setFormData(prev => ({ ...prev, ports: newPorts }));
          setPortsInitialized(true);
        }}
        onMakeOwn={() => {
          setFormData(prev => ({ ...prev, ports: [] }));
          setPortsInitialized(true);
          setPortSubWizard({ portIndex: null, isNewPortSchema: true });
        }}
      />
    );
  }

  return (
    <>
      <PortsListStep
        ports={formData.ports || []}
        portSchemas={portSchemas}
        onEdit={(index) => setPortSubWizard({ portIndex: index, isNewPortSchema: false })}
        onRemove={removePort}
        onAdd={addPortConfig}
      />

      {portSubWizard && (
        <Modal
          isOpen
          onClose={() => setPortSubWizard(null)}
          title={portSubWizard.isNewPortSchema ? '+Add Port' : 'Edit Port'}
          maxWidth="480px"
          footer={
            <div className="flex justify-end">
              <Button variant="accent" size="sm" onClick={() => setPortSubWizard(null)}>
                Done
              </Button>
            </div>
          }
        >
          <PortSubWizard
            port={portSubWizard.portIndex !== null ? (formData.ports || [])[portSubWizard.portIndex] : undefined}
            isNewPortSchema={portSubWizard.isNewPortSchema}
            portSchemas={portSchemas}
            onChange={(updates) => {
              if (portSubWizard.portIndex !== null) {
                updatePortAt(portSubWizard.portIndex, updates);
              } else {
                // New port being created via "start from scratch"
                const newPort: PortConfig = {
                  id: updates.id || '',
                  portType: updates.portType || '',
                  label: updates.label || '',
                  ...updates,
                };
                setFormData(prev => ({ ...prev, ports: [...(prev.ports || []), newPort] }));
                setPortSubWizard(prev => prev ? { ...prev, portIndex: (formData.ports || []).length } : null);
              }
            }}
            onCreatePortSchema={addPortSchema}
          />
        </Modal>
      )}
    </>
  );
}
