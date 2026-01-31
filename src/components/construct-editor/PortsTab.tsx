import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import type { ConstructSchema, PortConfig, PortPosition } from '@carta/domain';
import { useDocument } from '../../hooks/useDocument';
import { toSnakeCase } from '../../utils/stringUtils';

interface PortsTabProps {
  formData: ConstructSchema;
  addPort: () => void;
  updatePort: (index: number, updates: Partial<PortConfig>) => void;
  removePort: (index: number) => void;
}

const PORT_POSITIONS: PortPosition[] = ['left', 'right', 'top', 'bottom'];

export default function PortsTab({
  formData,
  addPort,
  updatePort,
  removePort
}: PortsTabProps) {
  const { getPortSchemas } = useDocument();
  const portSchemas = getPortSchemas();

  return (
    <div className="bg-surface-elevated rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Ports Configuration</h3>
          <p className="text-xs text-content-muted mt-1 mb-0">Define connection points for this construct type</p>
        </div>
        {(
          <Button size="sm" variant="secondary" onClick={addPort}>+ Add Port</Button>
        )}
      </div>

      {(!formData.ports || formData.ports.length === 0) ? (
        <p className="text-content-muted text-sm italic m-0">No ports defined (defaults will be used)</p>
      ) : (
        <div className="flex flex-col gap-3">
          {formData.ports.map((port, index) => (
            <div key={index} className="bg-surface p-3 rounded border border-surface-alt">
              {/* Header with delete button */}
              <div className="flex justify-between items-center mb-2">
                <Button variant="danger" size="sm" onClick={() => removePort(index)} title="Remove port">Remove</Button>
              </div>

              {/* Identification Section */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1">
                    Display Label <span className="text-danger">*</span>
                  </label>
                  <Input
                    size="sm"
                    className="text-xs"
                    value={port.label}
                    onChange={(e) => updatePort(index, { label: e.target.value, id: toSnakeCase(e.target.value) })}
                    placeholder="e.g., 'Input Data', 'Output'"
                  />
                </div>
              </div>

              {/* Description Section */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-content-muted mb-1">
                  Description
                </label>
                <Textarea
                  size="sm"
                  className="text-xs"
                  value={port.semanticDescription || ''}
                  onChange={(e) => updatePort(index, { semanticDescription: e.target.value })}
                  placeholder="Describe what this port is used for (appears in compiled output)"
                  rows={2}
                />
              </div>

              {/* Connection & Layout Section */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1">
                    Port Type <span className="text-danger">*</span>
                  </label>
                  <Select
                    size="sm"
                    className="text-xs"
                    value={port.portType}
                    onChange={(e) => updatePort(index, { portType: e.target.value })}
                    title={portSchemas.find(ps => ps.id === port.portType)?.semanticDescription}
                  >
                    {portSchemas.map(ps => (
                      <option key={ps.id} value={ps.id}>{ps.displayName}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-content-muted mt-1 mb-0 italic">
                    {portSchemas.find(ps => ps.id === port.portType)?.semanticDescription || 'Select a port type'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1">
                    Position <span className="text-danger">*</span>
                  </label>
                  <Select
                    size="sm"
                    className="text-xs"
                    value={port.position}
                    onChange={(e) => updatePort(index, { position: e.target.value as PortPosition })}
                  >
                    {PORT_POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-content-muted mt-1 mb-0">Side of node</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1">
                    Offset (%) <span className="text-danger">*</span>
                  </label>
                  <Input
                    size="sm"
                    className="text-xs"
                    type="number"
                    value={port.offset}
                    onChange={(e) => updatePort(index, { offset: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                    min={0}
                    max={100}
                    placeholder="0-100"
                  />
                  <p className="text-xs text-content-muted mt-1 mb-0">Along edge</p>
                </div>
              </div>

              {/* Current Values Summary */}
              <div className="mt-2 pt-2 border-t border-surface-alt">
                <div className="text-xs text-content-muted">
                  <span className="font-medium">Current:</span> {port.id} ({port.label}) • {port.portType} • {port.position} edge @ {port.offset}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
