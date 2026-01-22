import { registry } from '../../constructs/registry';
import { canConnect } from '../../constructs/ports';
import type { ConstructSchema, SuggestedRelatedConstruct } from '../../constructs/types';

interface RelatedTabProps {
  formData: ConstructSchema;
  isReadOnly: boolean;
  addSuggestedRelated: () => void;
  updateSuggestedRelated: (index: number, updates: Partial<SuggestedRelatedConstruct>) => void;
  removeSuggestedRelated: (index: number) => void;
}

export default function RelatedTab({
  formData,
  isReadOnly,
  addSuggestedRelated,
  updateSuggestedRelated,
  removeSuggestedRelated
}: RelatedTabProps) {
  const allSchemas = registry.getAllSchemas();
  // Filter out the current construct type from suggestions
  const availableSchemas = allSchemas.filter(s => s.type !== formData.type);
  const ports = formData.ports || [];

  return (
    <div className="bg-surface-elevated rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Related Constructs</h3>
          <p className="text-xs text-content-muted mt-1 mb-0">
            Define construct types that commonly relate to this one. These appear in the right-click "Add Related" menu.
          </p>
        </div>
        {!isReadOnly && (
          <button
            className="px-2.5 py-1 bg-surface-alt rounded text-content text-xs cursor-pointer hover:bg-content-muted transition-colors"
            onClick={addSuggestedRelated}
            disabled={availableSchemas.length === 0}
          >
            + Add Related
          </button>
        )}
      </div>

      {(!formData.suggestedRelated || formData.suggestedRelated.length === 0) ? (
        <p className="text-content-muted text-sm italic m-0">
          No related constructs defined. Add suggestions to enable quick-add from the canvas.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {formData.suggestedRelated.map((related, index) => {
            const relatedSchema = registry.getSchema(related.constructType);
            return (
              <div key={index} className="bg-surface p-3 rounded border border-surface-alt">
                {/* Header with delete button */}
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    {relatedSchema && (
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: relatedSchema.color }}
                      />
                    )}
                    <span className="text-sm font-medium text-content">
                      {relatedSchema?.displayName || related.constructType}
                    </span>
                  </div>
                  {!isReadOnly && (
                    <button
                      className="px-2 py-1 border text-danger text-xs hover:bg-danger-muted rounded transition-colors"
                      onClick={() => removeSuggestedRelated(index)}
                      title="Remove suggestion"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Configuration */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-content-muted mb-1">
                      Construct Type <span className="text-danger">*</span>
                    </label>
                    <select
                      className="w-full px-2 py-1.5 bg-surface-alt rounded text-content text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      value={related.constructType}
                      onChange={(e) => updateSuggestedRelated(index, { constructType: e.target.value, toPortId: undefined })}
                      disabled={isReadOnly}
                    >
                      <option value="">Select a construct type...</option>
                      {availableSchemas.map(schema => (
                        <option key={schema.type} value={schema.type}>
                          {schema.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Port Connection Section */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-content-muted mb-1">
                        From Port (This Construct)
                      </label>
                      <select
                        className="w-full px-2 py-1.5 bg-surface-alt rounded text-content text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        value={related.fromPortId || ''}
                        onChange={(e) => updateSuggestedRelated(index, { fromPortId: e.target.value || undefined })}
                        disabled={isReadOnly}
                      >
                        <option value="">(No connection)</option>
                        {ports.map(port => (
                          <option key={port.id} value={port.id}>
                            {port.label} ({port.direction})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-content-muted mb-1">
                        To Port (Related Construct)
                      </label>
                      <select
                        className="w-full px-2 py-1.5 bg-surface-alt rounded text-content text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        value={related.toPortId || ''}
                        onChange={(e) => updateSuggestedRelated(index, { toPortId: e.target.value || undefined })}
                        disabled={isReadOnly || !related.constructType}
                      >
                        <option value="">(No connection)</option>
                        {relatedSchema?.ports?.map(port => (
                          <option key={port.id} value={port.id}>
                            {port.label} ({port.direction})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Validation Messages */}
                  {(related.fromPortId || related.toPortId) && (
                    <div className="text-xs">
                      {related.fromPortId && !related.toPortId && (
                        <p className="text-warning m-0">⚠️ Both ports must be selected for auto-connection</p>
                      )}
                      {!related.fromPortId && related.toPortId && (
                        <p className="text-warning m-0">⚠️ Both ports must be selected for auto-connection</p>
                      )}
                      {related.fromPortId && related.toPortId && (() => {
                        const fromPort = ports.find(p => p.id === related.fromPortId);
                        const toPort = relatedSchema?.ports?.find(p => p.id === related.toPortId);
                        const isValid = fromPort && toPort && canConnect(fromPort.direction, toPort.direction);
                        return isValid ? (
                          <p className="text-content-muted m-0">
                            ✓ Valid pairing: {fromPort.direction} → {toPort.direction}
                          </p>
                        ) : (
                          <p className="text-danger m-0">
                            ✗ Invalid pairing: {fromPort?.direction || '?'} cannot connect to {toPort?.direction || '?'}
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Custom label */}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-content-muted mb-1">
                    Menu Label (optional)
                  </label>
                  <input
                    type="text"
                    className="w-full px-2 py-1.5 bg-surface-alt rounded text-content text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    value={related.label || ''}
                    onChange={(e) => updateSuggestedRelated(index, { label: e.target.value || undefined })}
                    placeholder={relatedSchema?.displayName || 'Custom label for menu'}
                    disabled={isReadOnly}
                  />
                </div>

                {/* Summary */}
                {related.fromPortId && related.toPortId && (
                  <div className="mt-2 pt-2 border-t border-surface-alt">
                    <div className="text-xs text-content-muted">
                      <span className="font-medium">Auto-connect:</span> "{ports.find(p => p.id === related.fromPortId)?.label || related.fromPortId}" → "{relatedSchema?.ports?.find(p => p.id === related.toPortId)?.label || related.toPortId}"
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {availableSchemas.length === 0 && (
        <div className="mt-3 p-3 bg-surface rounded border border-surface-alt">
          <p className="text-xs text-content-muted m-0">
            No other construct types available. Create more construct types to add suggestions.
          </p>
        </div>
      )}
    </div>
  );
}
