import { useState } from 'react';
import type { PortConfig, PortSchema } from '@carta/domain';
import { PencilSimple, Trash } from '@phosphor-icons/react';

interface PortsListStepProps {
  ports: PortConfig[];
  portSchemas: PortSchema[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: (portType: string) => void;
}

export default function PortsListStep({ ports, portSchemas, onEdit, onRemove, onAdd }: PortsListStepProps) {
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {ports.length === 0 ? (
        <div className="text-center py-8 text-content-muted text-sm">
          <p className="mb-2">No ports configured</p>
          <p className="text-xs">Ports define how this construct connects to others</p>
        </div>
      ) : (
        ports.map((port, index) => {
          const ps = portSchemas.find(s => s.id === port.portType);
          return (
            <div
              key={index}
              className="flex items-center justify-between px-3 py-2.5 bg-surface rounded-md hover:bg-surface-elevated transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: ps?.color || '#6b7280' }}
                />
                <span className="text-sm font-medium text-content truncate">{port.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded text-content-muted uppercase">{port.portType}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="w-8 h-8 flex items-center justify-center text-content-muted hover:text-content transition-colors rounded hover:bg-surface-alt"
                  onClick={() => onEdit(index)}
                  title="Edit port"
                >
                  <PencilSimple weight="regular" size={16} />
                </button>
                <button
                  className="w-8 h-8 flex items-center justify-center text-content-muted hover:text-danger transition-colors rounded hover:bg-surface-alt"
                  onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                  title="Remove port"
                >
                  <Trash weight="regular" size={16} />
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Add Port button with dropdown */}
      <div className="relative">
        <button
          className="w-full px-3 py-2.5 text-sm font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded-md transition-colors"
          onClick={() => setShowAddDropdown(!showAddDropdown)}
        >
          + Add Port
        </button>
        {showAddDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface-elevated border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
            {portSchemas.map(ps => (
              <button
                key={ps.id}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content hover:bg-surface transition-colors text-left"
                onClick={() => {
                  onAdd(ps.id);
                  setShowAddDropdown(false);
                }}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: ps.color }}
                />
                <span>{ps.displayName}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded text-content-muted uppercase ml-auto">{ps.polarity}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
