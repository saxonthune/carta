import { useState } from 'react';
import type { PortSchema, PortConfig } from '@carta/domain';

interface PortsInitialChoiceProps {
  portSchemas: PortSchema[];
  currentPorts: PortConfig[];
  onStartWithDefaults: () => void;
  onLoadFromList: (portTypes: string[]) => void;
  onMakeOwn: () => void;
}

export default function PortsInitialChoice({
  portSchemas,
  currentPorts,
  onStartWithDefaults,
  onLoadFromList,
  onMakeOwn,
}: PortsInitialChoiceProps) {
  const [mode, setMode] = useState<'choose' | 'pick'>('choose');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (mode === 'pick') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-content-muted">Select the port types to include:</p>
        <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
          {portSchemas.map(ps => (
            <label key={ps.id} className="flex items-center gap-2.5 px-3 py-2 bg-surface rounded-md hover:bg-surface-elevated transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(ps.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(ps.id);
                  else next.delete(ps.id);
                  setSelected(next);
                }}
                className="w-4 h-4 accent-[var(--color-accent)]"
              />
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: ps.color }}
              />
              <span className="text-sm text-content">{ps.displayName}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded text-content-muted uppercase ml-auto">{ps.polarity}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end mt-2">
          <button
            className="px-3 py-1.5 text-sm text-content-muted hover:text-content transition-colors"
            onClick={() => setMode('choose')}
          >
            Back
          </button>
          <button
            className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-50"
            disabled={selected.size === 0}
            onClick={() => onLoadFromList(Array.from(selected))}
          >
            Add Selected
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <p className="text-sm text-content-muted text-center mb-2">How would you like to set up ports?</p>
      <button
        className="px-4 py-3 bg-surface rounded-lg hover:bg-surface-elevated transition-colors text-left"
        onClick={onStartWithDefaults}
      >
        <div className="text-sm font-medium text-content">Start with defaults</div>
        <div className="text-xs text-content-muted mt-0.5">
          {currentPorts.map(p => p.label).join(', ')}
        </div>
      </button>
      <button
        className="px-4 py-3 bg-surface rounded-lg hover:bg-surface-elevated transition-colors text-left"
        onClick={() => setMode('pick')}
      >
        <div className="text-sm font-medium text-content">Pick from available port types</div>
        <div className="text-xs text-content-muted mt-0.5">
          Choose which port types to include from the registry
        </div>
      </button>
      <button
        className="px-4 py-3 bg-surface rounded-lg hover:bg-surface-elevated transition-colors text-left"
        onClick={onMakeOwn}
      >
        <div className="text-sm font-medium text-content">Start from scratch</div>
        <div className="text-xs text-content-muted mt-0.5">
          Create a new port type and configure it
        </div>
      </button>
    </div>
  );
}
