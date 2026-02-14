import { useState } from 'react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { toKebabCase } from '../../utils/stringUtils';
import type { PortConfig, PortSchema, Polarity } from '@carta/domain';

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#1e293b'
];

const POLARITY_OPTIONS: { value: Polarity; label: string; description: string }[] = [
  { value: 'source', label: 'Source', description: 'Initiates connections (like flow-out, parent)' },
  { value: 'sink', label: 'Sink', description: 'Receives connections (like flow-in, child)' },
  { value: 'bidirectional', label: 'Bidirectional', description: 'Can both initiate and receive' },
  { value: 'relay', label: 'Relay', description: 'Pass-through output, bypasses type checking' },
  { value: 'intercept', label: 'Intercept', description: 'Pass-through input, bypasses type checking' },
];

interface PortSubWizardProps {
  port: PortConfig | undefined;
  isNewPortSchema: boolean;
  portSchemas: PortSchema[];
  onChange: (updates: Partial<PortConfig>) => void;
  onCreatePortSchema: (schema: PortSchema) => void;
}

export default function PortSubWizard({
  port,
  isNewPortSchema,
  portSchemas,
  onChange,
  onCreatePortSchema,
}: PortSubWizardProps) {
  // State for creating a new port schema inline
  const [newSchema, setNewSchema] = useState<Partial<PortSchema>>({
    displayName: '',
    semanticDescription: '',
    polarity: 'source',
    compatibleWith: [],
    color: '#6366f1',
  });
  const [newCompatTag, setNewCompatTag] = useState('');
  const [schemaCreated, setSchemaCreated] = useState(false);

  // If creating a new port schema, show the schema creation form first
  if (isNewPortSchema && !schemaCreated) {
    const handleCreateSchema = () => {
      if (!newSchema.displayName?.trim()) return;
      const id = toKebabCase(newSchema.displayName);
      const fullSchema: PortSchema = {
        id,
        displayName: newSchema.displayName,
        semanticDescription: newSchema.semanticDescription || '',
        polarity: newSchema.polarity || 'source',
        compatibleWith: newSchema.compatibleWith || [],
        color: newSchema.color || '#6366f1',
      };
      onCreatePortSchema(fullSchema);
      // Now set up the port config
      onChange({
        id,
        portType: id,
        label: fullSchema.displayName,
      });
      setSchemaCreated(true);
    };

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-content">Create New Port Type</p>

        <div>
          <label className="block mb-1 text-sm font-medium text-content">Display Name</label>
          <Input
            value={newSchema.displayName || ''}
            onChange={(e) => setNewSchema(prev => ({ ...prev, displayName: e.target.value }))}
            placeholder="e.g., Data Input, Trigger"
            autoFocus
          />
          {newSchema.displayName && (
            <span className="block mt-1 text-[11px] text-content-muted">
              ID: <code className="text-content-subtle">{toKebabCase(newSchema.displayName)}</code>
            </span>
          )}
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-content">Semantic Description</label>
          <Textarea
            value={newSchema.semanticDescription || ''}
            onChange={(e) => setNewSchema(prev => ({ ...prev, semanticDescription: e.target.value }))}
            placeholder="Describe what this port type represents..."
            rows={2}
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium text-content">Polarity</label>
          <Select
            value={newSchema.polarity || 'source'}
            onChange={(e) => setNewSchema(prev => ({ ...prev, polarity: e.target.value as Polarity }))}
          >
            {POLARITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
          <span className="block mt-1 text-[11px] text-content-muted">
            {POLARITY_OPTIONS.find(o => o.value === newSchema.polarity)?.description}
          </span>
        </div>

        {/* Compatible With - only show for source/sink */}
        {(newSchema.polarity === 'source' || newSchema.polarity === 'sink') && (
          <div>
            <label className="block mb-1 text-sm font-medium text-content">Compatible With</label>
            <p className="text-[11px] text-content-muted mb-1.5">Port IDs this type can connect to. Use '*' for all.</p>
            <div className="flex gap-2 mb-1.5">
              <Input
                size="sm"
                className="flex-1"
                value={newCompatTag}
                onChange={(e) => setNewCompatTag(e.target.value)}
                placeholder="e.g., flow-out or *"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCompatTag.trim()) {
                    setNewSchema(prev => ({
                      ...prev,
                      compatibleWith: [...new Set([...(prev.compatibleWith || []), newCompatTag.trim()])],
                    }));
                    setNewCompatTag('');
                  }
                }}
              />
              <button
                className="px-3 py-1.5 bg-surface-alt rounded text-sm text-content hover:bg-surface-elevated transition-colors"
                onClick={() => {
                  if (!newCompatTag.trim()) return;
                  setNewSchema(prev => ({
                    ...prev,
                    compatibleWith: [...new Set([...(prev.compatibleWith || []), newCompatTag.trim()])],
                  }));
                  setNewCompatTag('');
                }}
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {(newSchema.compatibleWith || []).map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-surface-alt rounded text-xs text-content">
                  {tag}
                  <button
                    className="w-3.5 h-3.5 flex items-center justify-center text-content-muted hover:text-danger text-xs"
                    onClick={() => setNewSchema(prev => ({
                      ...prev,
                      compatibleWith: (prev.compatibleWith || []).filter(c => c !== tag),
                    }))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block mb-1 text-sm font-medium text-content">Color</label>
          <div className="flex flex-wrap gap-1.5 items-center">
            {DEFAULT_COLORS.slice(0, 6).map(color => (
              <button
                key={color}
                type="button"
                className={`w-6 h-6 border-2 rounded cursor-pointer transition-all hover:scale-110 ${newSchema.color === color ? 'border-white shadow-[0_0_0_2px_var(--color-accent)]' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
                onClick={() => setNewSchema(prev => ({ ...prev, color }))}
              />
            ))}
            <input
              type="color"
              className="w-6 h-6 p-0 border-none rounded cursor-pointer"
              value={newSchema.color || '#6366f1'}
              onChange={(e) => setNewSchema(prev => ({ ...prev, color: e.target.value }))}
            />
          </div>
        </div>

        <button
          className="w-full px-3 py-2.5 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50"
          disabled={!newSchema.displayName?.trim()}
          onClick={handleCreateSchema}
        >
          Create Port Type & Configure
        </button>
      </div>
    );
  }

  // Show port config editing (for existing port types or after schema creation)
  if (!port) return null;

  const currentSchema = portSchemas.find(s => s.id === port.portType);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: currentSchema?.color || '#6b7280' }}
        />
        <span className="text-sm font-medium text-content">{currentSchema?.displayName || port.portType}</span>
        <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded text-content-muted uppercase">{currentSchema?.polarity || 'unknown'}</span>
      </div>

      {/* Port Type selector (for non-new-schema mode) */}
      {!isNewPortSchema && (
        <div>
          <label className="block mb-1 text-sm font-medium text-content">Port Type</label>
          <Select
            value={port.portType}
            onChange={(e) => {
              const ps = portSchemas.find(s => s.id === e.target.value);
              onChange({
                portType: e.target.value,
                id: e.target.value,
                label: ps?.displayName || port.label,
              });
            }}
          >
            {portSchemas.map(ps => (
              <option key={ps.id} value={ps.id}>{ps.displayName}</option>
            ))}
          </Select>
        </div>
      )}

      <div>
        <label className="block mb-1 text-sm font-medium text-content">Label</label>
        <Input
          value={port.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Display label for this port"
        />
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-content">Semantic Description</label>
        <Textarea
          value={port.semanticDescription || ''}
          onChange={(e) => onChange({ semanticDescription: e.target.value })}
          placeholder="Describe what this port is used for on this construct..."
          rows={2}
        />
      </div>

    </div>
  );
}
