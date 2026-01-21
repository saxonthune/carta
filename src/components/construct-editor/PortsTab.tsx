import type { ConstructSchema, PortConfig, PortDirection, PortPosition } from '../../constructs/types';

interface PortsTabProps {
  formData: ConstructSchema;
  isReadOnly: boolean;
  addPort: () => void;
  updatePort: (index: number, updates: Partial<PortConfig>) => void;
  removePort: (index: number) => void;
}

const PORT_DIRECTIONS: PortDirection[] = ['in', 'out', 'parent', 'child', 'bidi'];
const PORT_POSITIONS: PortPosition[] = ['left', 'right', 'top', 'bottom'];

const PORT_DIRECTION_DESCRIPTIONS: Record<PortDirection, string> = {
  'in': 'Receives connections from out/bidi ports',
  'out': 'Sends connections to in/bidi ports',
  'parent': 'Parent in hierarchy (receives child connections)',
  'child': 'Child in hierarchy (connects to parent)',
  'bidi': 'Bidirectional (connects to any compatible port)'
};

export default function PortsTab({
  formData,
  isReadOnly,
  addPort,
  updatePort,
  removePort
}: PortsTabProps) {
  return (
    <div className="bg-surface-elevated rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Ports Configuration</h3>
          <p className="text-xs text-content-muted mt-1 mb-0">Define connection points for this construct type</p>
        </div>
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
        <div className="flex flex-col gap-3">
          {formData.ports.map((port, index) => (
            <div key={index} className="bg-surface p-3 rounded border border-surface-alt">
              {/* Header with port number and delete button */}
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-semibold text-content-muted">Port #{index + 1}</div>
                {!isReadOnly && (
                  <button
                    className="px-2 py-1 text-danger text-xs hover:bg-danger-muted rounded transition-colors"
                    onClick={() => removePort(index)}
                    title="Remove port"
                  >
                    × Remove
                  </button>
                )}
              </div>

              {/* Identification Section */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1">
                    Port ID <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 bg-surface-alt rounded text-content text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    value={port.id}
                    onChange={(e) => updatePort(index, { id: e.target.value })}
                    placeholder="e.g., 'input', 'output'"
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1">
                    Display Label <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 bg-surface-alt rounded text-content text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    value={port.label}
                    onChange={(e) => updatePort(index, { label: e.target.value })}
                    placeholder="e.g., 'Input Data', 'Output'"
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {/* Connection & Layout Section */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1">
                    Direction <span className="text-danger">*</span>
                  </label>
                  <select
                    className="w-full px-2 py-1.5 bg-surface-alt rounded text-content text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    value={port.direction}
                    onChange={(e) => updatePort(index, { direction: e.target.value as PortDirection })}
                    disabled={isReadOnly}
                    title={PORT_DIRECTION_DESCRIPTIONS[port.direction]}
                  >
                    {PORT_DIRECTIONS.map(dir => (
                      <option key={dir} value={dir}>{dir}</option>
                    ))}
                  </select>
                  <p className="text-xs text-content-muted mt-1 mb-0 italic">
                    {PORT_DIRECTION_DESCRIPTIONS[port.direction]}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1">
                    Position <span className="text-danger">*</span>
                  </label>
                  <select
                    className="w-full px-2 py-1.5 bg-surface-alt rounded text-content text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    value={port.position}
                    onChange={(e) => updatePort(index, { position: e.target.value as PortPosition })}
                    disabled={isReadOnly}
                  >
                    {PORT_POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                  <p className="text-xs text-content-muted mt-1 mb-0">Side of node</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-muted mb-1">
                    Offset (%) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    className="w-full px-2 py-1.5 bg-surface-alt rounded text-content text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    value={port.offset}
                    onChange={(e) => updatePort(index, { offset: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                    min={0}
                    max={100}
                    placeholder="0-100"
                    disabled={isReadOnly}
                  />
                  <p className="text-xs text-content-muted mt-1 mb-0">Along edge</p>
                </div>
              </div>

              {/* Current Values Summary */}
              <div className="mt-2 pt-2 border-t border-surface-alt">
                <div className="text-xs text-content-muted">
                  <span className="font-medium">Current:</span> {port.id} ({port.label}) • {port.direction} • {port.position} edge @ {port.offset}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
