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
        <h3 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Ports Configuration</h3>
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
        <div className="flex flex-col gap-2">
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
  );
}
