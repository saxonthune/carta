/**
 * @deprecated This file uses the old React Flow-based metamap which reads suggestedRelated
 * directly from ConstructSchema. Use MetamapV2 instead, which reads from schemaRelationships.
 * This file will be deleted once the old metamap toggle is removed.
 */

import { useState, useMemo, useEffect } from 'react';
import { ArrowRight, Warning } from '@phosphor-icons/react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { portRegistry } from '@carta/domain';
import type { ConstructSchema, PortConfig, Polarity } from '@carta/domain';

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
              <Select
                size="sm"
                className="mt-1"
                value={existingPortId}
                onChange={(e) => onExistingPortChange(e.target.value)}
              >
                <option value="">Select port...</option>
                {ports.map((port: PortConfig) => (
                  <option key={port.id} value={port.id}>
                    {port.label} ({port.portType})
                  </option>
                ))}
              </Select>
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
              <Select
                size="sm"
                className="mt-1"
                value={newPolarity}
                onChange={(e) => onNewPolarityChange(e.target.value as Polarity)}
              >
                {POLARITIES.map(pol => (
                  <option key={pol} value={pol}>{pol}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs text-content-muted uppercase tracking-wide">Port Label</label>
              <Input
                size="sm"
                className="mt-1"
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
                <Input
                  size="sm"
                  className="flex-1"
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

export function MetamapConnectionModal({
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

  const duplicateWarning = useMemo(() => {
    // Determine current selected polarities
    let srcPolarity: Polarity | null = null;
    let tgtPolarity: Polarity | null = null;

    if (sourceMode === 'existing' && sourceExistingPortId) {
      const port = (sourceSchema.ports || []).find(p => p.id === sourceExistingPortId);
      const ps = port ? portRegistry.get(port.portType) : null;
      srcPolarity = ps?.polarity ?? null;
    } else if (sourceMode === 'new') {
      srcPolarity = sourceNewPolarity;
    }

    if (targetMode === 'existing' && targetExistingPortId) {
      const port = (targetSchema.ports || []).find(p => p.id === targetExistingPortId);
      const ps = port ? portRegistry.get(port.portType) : null;
      tgtPolarity = ps?.polarity ?? null;
    } else if (targetMode === 'new') {
      tgtPolarity = targetNewPolarity;
    }

    if (!srcPolarity || !tgtPolarity) return null;

    // Check existing relationships from source → target
    let count = 0;
    for (const rel of sourceSchema.suggestedRelated || []) {
      if (rel.constructType !== targetSchema.type) continue;
      const fromPort = (sourceSchema.ports || []).find(p => p.id === rel.fromPortId);
      const toPort = (targetSchema.ports || []).find(p => p.id === rel.toPortId);
      const fromPs = fromPort ? portRegistry.get(fromPort.portType) : null;
      const toPs = toPort ? portRegistry.get(toPort.portType) : null;
      if (fromPs?.polarity === srcPolarity && toPs?.polarity === tgtPolarity) count++;
    }
    // Also check target → source (inverse direction)
    for (const rel of targetSchema.suggestedRelated || []) {
      if (rel.constructType !== sourceSchema.type) continue;
      const fromPort = (targetSchema.ports || []).find(p => p.id === rel.fromPortId);
      const toPort = (sourceSchema.ports || []).find(p => p.id === rel.toPortId);
      const fromPs = fromPort ? portRegistry.get(fromPort.portType) : null;
      const toPs = toPort ? portRegistry.get(toPort.portType) : null;
      if (fromPs?.polarity === tgtPolarity && toPs?.polarity === srcPolarity) count++;
    }

    return count > 0 ? count : null;
  }, [sourceSchema, targetSchema, sourceMode, targetMode, sourceExistingPortId, targetExistingPortId, sourceNewPolarity, targetNewPolarity]);

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
    <Modal
      isOpen={true}
      onClose={onCancel}
      title="Create Relationship"
      maxWidth="700px"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={!validation.valid}>Save</Button>
        </div>
      }
    >
      {/* Two facing panels */}
      <div className="flex gap-3 items-stretch">
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
          <ArrowRight weight="bold" size={20} className="text-content-muted" />
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

      {/* Duplicate polarity warning */}
      {duplicateWarning && (
        <div className="mt-3 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md flex items-start gap-2">
          <Warning size={16} weight="fill" className="text-amber-500 mt-0.5 shrink-0" />
          <span className="text-sm text-amber-800 dark:text-amber-200">
            {duplicateWarning === 1
              ? 'A relationship with this polarity already exists between these schemas.'
              : `${duplicateWarning} relationships with this polarity already exist between these schemas.`}
            {' '}You can still create another.
          </span>
        </div>
      )}

      {/* Label fields */}
      <div className="mt-4 flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-content-muted uppercase tracking-wide">Relationship Label (optional)</label>
          <Input
            size="sm"
            className="mt-1"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., manages, depends on"
          />
        </div>
      </div>

      {/* Validation error */}
      {validation.error && (
        <div className="mt-3">
          <div className="text-sm text-danger">{validation.error}</div>
        </div>
      )}

      {/* Inverse checkbox */}
      <div className="mt-4 pt-3 border-t border-border">
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
            <Input
              size="sm"
              className="mt-1"
              value={inverseLabel}
              onChange={(e) => setInverseLabel(e.target.value)}
              placeholder="e.g., managed by, depended on by"
            />
          </div>
        )}
      </div>
    </Modal>
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
