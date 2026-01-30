import { useState, useMemo, useEffect } from 'react';
import type { ConstructSchema, PortConfig, Polarity } from '../constructs/types';
import { portRegistry } from '../constructs/portRegistry';

interface MetamapConnectionModalProps {
  sourceSchema: ConstructSchema;
  targetSchema: ConstructSchema;
  initialSourceHandle?: string;
  initialTargetHandle?: string;
  onSave: (config: {
    sourceSchema: ConstructSchema;
    targetSchema: ConstructSchema;
    fromPortId: string;
    toPortId: string;
    label: string;
    inverse: boolean;
    inverseLabel: string;
    newSourcePort?: { polarity: Polarity; label: string; color: string };
    newTargetPort?: { polarity: Polarity; label: string; color: string };
  }) => void;
  onCancel: () => void;
}

type PortMode = 'existing' | 'new';

const POLARITIES: Polarity[] = ['source', 'sink', 'bidirectional', 'relay', 'intercept'];

function PortPanel({
  schema,
  mode,
  onModeChange,
  existingPortId,
  onExistingPortChange,
  newPolarity,
  onNewPolarityChange,
  newLabel,
  onNewLabelChange,
  newColor,
  onNewColorChange,
  align,
}: {
  schema: ConstructSchema;
  mode: PortMode;
  onModeChange: (mode: PortMode) => void;
  existingPortId: string;
  onExistingPortChange: (portId: string) => void;
  newPolarity: Polarity;
  onNewPolarityChange: (polarity: Polarity) => void;
  newLabel: string;
  onNewLabelChange: (label: string) => void;
  newColor: string;
  onNewColorChange: (color: string) => void;
  align: 'left' | 'right';
}) {
  const ports = schema.ports || [];
  const hasExistingPorts = ports.length > 0;

  const selectedPort = mode === 'existing' ? ports.find(p => p.id === existingPortId) : null;
  const selectedPortSchema = selectedPort ? portRegistry.get(selectedPort.portType) : null;

  return (
    <div
      className={`flex-1 flex flex-col border border-border rounded-lg overflow-hidden ${
        align === 'right' ? 'items-end text-right' : ''
      }`}
    >
      {/* Color header */}
      <div
        className="w-full px-4 py-2 text-white font-semibold text-sm"
        style={{ backgroundColor: schema.color }}
      >
        {schema.displayName}
      </div>

      <div className="p-3 flex flex-col gap-3 w-full">
        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              mode === 'existing'
                ? 'bg-accent text-white'
                : 'bg-surface-alt text-content-muted hover:bg-surface-alt/80'
            }`}
            onClick={() => onModeChange('existing')}
            disabled={!hasExistingPorts}
          >
            Existing Port
          </button>
          <button
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              mode === 'new'
                ? 'bg-accent text-white'
                : 'bg-surface-alt text-content-muted hover:bg-surface-alt/80'
            }`}
            onClick={() => onModeChange('new')}
          >
            New Port
          </button>
        </div>

        {mode === 'existing' ? (
          <>
            <div>
              <label className="text-xs text-content-muted uppercase tracking-wide">Port</label>
              <select
                className="w-full px-2 py-1.5 bg-surface rounded text-sm text-content border border-border mt-1"
                value={existingPortId}
                onChange={(e) => onExistingPortChange(e.target.value)}
              >
                <option value="">Select port...</option>
                {ports.map((port: PortConfig) => (
                  <option key={port.id} value={port.id}>
                    {port.label} ({port.portType})
                  </option>
                ))}
              </select>
            </div>

            {selectedPort && selectedPortSchema && (
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: selectedPortSchema.color }}
                />
                <span className="text-xs text-content-muted">
                  {selectedPortSchema.polarity}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="text-xs text-content-muted uppercase tracking-wide">Polarity</label>
              <select
                className="w-full px-2 py-1.5 bg-surface rounded text-sm text-content border border-border mt-1"
                value={newPolarity}
                onChange={(e) => onNewPolarityChange(e.target.value as Polarity)}
              >
                {POLARITIES.map(pol => (
                  <option key={pol} value={pol}>{pol}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-content-muted uppercase tracking-wide">Port Label</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 bg-surface rounded text-sm text-content border border-border mt-1"
                value={newLabel}
                onChange={(e) => onNewLabelChange(e.target.value)}
                placeholder="e.g., output, connects to"
              />
            </div>

            <div>
              <label className="text-xs text-content-muted uppercase tracking-wide">Color</label>
              <div className="flex gap-2 items-center mt-1">
                <input
                  type="color"
                  className="w-12 h-9 rounded border border-border cursor-pointer"
                  value={newColor}
                  onChange={(e) => onNewColorChange(e.target.value)}
                />
                <input
                  type="text"
                  className="flex-1 px-2 py-1.5 bg-surface rounded text-sm text-content border border-border"
                  value={newColor}
                  onChange={(e) => onNewColorChange(e.target.value)}
                  placeholder="#6b7280"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function MetamapConnectionModal({
  sourceSchema,
  targetSchema,
  initialSourceHandle,
  initialTargetHandle,
  onSave,
  onCancel,
}: MetamapConnectionModalProps) {
  // Determine initial mode based on handles
  const sourceIsNew = !initialSourceHandle || initialSourceHandle === 'meta-connect';
  const targetIsNew = !initialTargetHandle || initialTargetHandle === 'meta-connect';

  const [sourceMode, setSourceMode] = useState<PortMode>(sourceIsNew ? 'new' : 'existing');
  const [targetMode, setTargetMode] = useState<PortMode>(targetIsNew ? 'new' : 'existing');

  const [sourceExistingPortId, setSourceExistingPortId] = useState(sourceIsNew ? '' : initialSourceHandle || '');
  const [targetExistingPortId, setTargetExistingPortId] = useState(targetIsNew ? '' : initialTargetHandle || '');

  const [sourceNewPolarity, setSourceNewPolarity] = useState<Polarity>('source');
  const [targetNewPolarity, setTargetNewPolarity] = useState<Polarity>('sink');

  const [sourceNewLabel, setSourceNewLabel] = useState('');
  const [targetNewLabel, setTargetNewLabel] = useState('');

  const [sourceNewColor, setSourceNewColor] = useState('#6b7280');
  const [targetNewColor, setTargetNewColor] = useState('#6b7280');

  const [label, setLabel] = useState('');
  const [inverse, setInverse] = useState(false);
  const [inverseLabel, setInverseLabel] = useState('');

  // Reset to 'new' mode if schema has no ports
  useEffect(() => {
    if ((sourceSchema.ports?.length || 0) === 0) {
      setSourceMode('new');
    }
  }, [sourceSchema]);

  useEffect(() => {
    if ((targetSchema.ports?.length || 0) === 0) {
      setTargetMode('new');
    }
  }, [targetSchema]);

  const validation = useMemo(() => {
    // Validate based on mode
    if (sourceMode === 'existing' && !sourceExistingPortId) {
      return { valid: false, error: 'Select a source port' };
    }
    if (targetMode === 'existing' && !targetExistingPortId) {
      return { valid: false, error: 'Select a target port' };
    }
    if (sourceMode === 'new' && !sourceNewLabel.trim()) {
      return { valid: false, error: 'Source port needs a label' };
    }
    if (targetMode === 'new' && !targetNewLabel.trim()) {
      return { valid: false, error: 'Target port needs a label' };
    }

    // Validate polarity compatibility
    let sourcePolarity: Polarity;
    let targetPolarity: Polarity;

    if (sourceMode === 'existing') {
      const port = (sourceSchema.ports || []).find(p => p.id === sourceExistingPortId);
      if (!port) return { valid: false, error: 'Source port not found' };
      const portSchema = portRegistry.get(port.portType);
      if (!portSchema) return { valid: false, error: 'Source port type not found' };
      sourcePolarity = portSchema.polarity;
    } else {
      sourcePolarity = sourceNewPolarity;
    }

    if (targetMode === 'existing') {
      const port = (targetSchema.ports || []).find(p => p.id === targetExistingPortId);
      if (!port) return { valid: false, error: 'Target port not found' };
      const portSchema = portRegistry.get(port.portType);
      if (!portSchema) return { valid: false, error: 'Target port type not found' };
      targetPolarity = portSchema.polarity;
    } else {
      targetPolarity = targetNewPolarity;
    }

    // Check polarity compatibility (simplified - just check basic rules)
    const canConnect = validatePolarities(sourcePolarity, targetPolarity);
    if (!canConnect) {
      return {
        valid: false,
        error: `Incompatible polarity: ${sourcePolarity} cannot connect to ${targetPolarity}`,
      };
    }

    return { valid: true, error: '' };
  }, [sourceMode, targetMode, sourceExistingPortId, targetExistingPortId, sourceNewPolarity, targetNewPolarity, sourceNewLabel, targetNewLabel, sourceSchema, targetSchema]);

  const handleSave = () => {
    if (!validation.valid) return;

    // Generate port IDs for new ports (simple timestamp-based)
    const fromPortId = sourceMode === 'existing'
      ? sourceExistingPortId
      : `port-${Date.now()}-src`;

    const toPortId = targetMode === 'existing'
      ? targetExistingPortId
      : `port-${Date.now()}-tgt`;

    onSave({
      sourceSchema,
      targetSchema,
      fromPortId,
      toPortId,
      label,
      inverse,
      inverseLabel,
      newSourcePort: sourceMode === 'new' ? {
        polarity: sourceNewPolarity,
        label: sourceNewLabel,
        color: sourceNewColor,
      } : undefined,
      newTargetPort: targetMode === 'new' ? {
        polarity: targetNewPolarity,
        label: targetNewLabel,
        color: targetNewColor,
      } : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-xl w-[90%] max-w-[700px] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="m-0 text-lg text-content font-semibold">Create Relationship</h2>
          <button
            className="w-9 h-9 border-none rounded-md bg-transparent text-content-subtle text-2xl cursor-pointer flex items-center justify-center hover:bg-surface-alt hover:text-content"
            onClick={onCancel}
          >
            &times;
          </button>
        </div>

        {/* Two facing panels */}
        <div className="p-4 flex gap-3 items-stretch">
          <PortPanel
            schema={sourceSchema}
            mode={sourceMode}
            onModeChange={setSourceMode}
            existingPortId={sourceExistingPortId}
            onExistingPortChange={setSourceExistingPortId}
            newPolarity={sourceNewPolarity}
            onNewPolarityChange={setSourceNewPolarity}
            newLabel={sourceNewLabel}
            onNewLabelChange={setSourceNewLabel}
            newColor={sourceNewColor}
            onNewColorChange={setSourceNewColor}
            align="left"
          />

          {/* Arrow indicator */}
          <div className="flex items-center justify-center px-2">
            <svg className="w-6 h-6 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>

          <PortPanel
            schema={targetSchema}
            mode={targetMode}
            onModeChange={setTargetMode}
            existingPortId={targetExistingPortId}
            onExistingPortChange={setTargetExistingPortId}
            newPolarity={targetNewPolarity}
            onNewPolarityChange={setTargetNewPolarity}
            newLabel={targetNewLabel}
            onNewLabelChange={setTargetNewLabel}
            newColor={targetNewColor}
            onNewColorChange={setTargetNewColor}
            align="right"
          />
        </div>

        {/* Label fields */}
        <div className="px-4 pb-3 flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-content-muted uppercase tracking-wide">Relationship Label (optional)</label>
            <input
              type="text"
              className="w-full px-2 py-1.5 bg-surface rounded text-sm text-content border border-border mt-1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., manages, depends on"
            />
          </div>
        </div>

        {/* Validation error */}
        {validation.error && (
          <div className="px-4 pb-3">
            <div className="text-sm text-danger">{validation.error}</div>
          </div>
        )}

        {/* Inverse checkbox */}
        <div className="px-4 pb-3 border-t border-border-subtle pt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={inverse}
              onChange={(e) => setInverse(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-content">Also create inverse relationship</span>
          </label>
          {inverse && (
            <div className="mt-2 ml-6">
              <label className="text-xs text-content-muted uppercase tracking-wide">Inverse label (optional)</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 bg-surface rounded text-sm text-content border border-border mt-1"
                value={inverseLabel}
                onChange={(e) => setInverseLabel(e.target.value)}
                placeholder="e.g., managed by, depended on by"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-4 py-3 border-t border-border-subtle">
          <button
            className="px-4 py-2 rounded-md bg-surface text-content text-sm font-medium cursor-pointer hover:bg-surface-alt transition-colors border border-border"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 border-none rounded-md bg-emerald-500 text-white text-sm font-medium cursor-pointer hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSave}
            disabled={!validation.valid}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// Simplified polarity validation
function validatePolarities(source: Polarity, target: Polarity): boolean {
  // Bidirectional connects to anything
  if (source === 'bidirectional' || target === 'bidirectional') return true;

  // Relay/intercept bypass most checks
  if (source === 'relay' || target === 'intercept') return true;
  if (source === 'intercept' || target === 'relay') return true;

  // Basic rules: source -> sink, sink -> source
  if (source === 'source' && target === 'sink') return true;
  if (source === 'sink' && target === 'source') return true;

  // Same polarity not allowed (except bidirectional handled above)
  return false;
}
