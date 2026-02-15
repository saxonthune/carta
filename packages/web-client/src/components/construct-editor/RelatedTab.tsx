import { useSchemas } from '../../hooks/useSchemas';
import { useSchemaRelationships } from '../../hooks/useSchemaRelationships';
import { canConnect } from '@carta/domain';
import type { SchemaRelationship } from '@carta/domain';

interface RelatedTabProps {
  schemaType: string;
}

function generateRelationshipId(): string {
  return 'rel_' + Math.random().toString(36).substring(2, 11);
}

export default function RelatedTab({ schemaType }: RelatedTabProps) {
  const { schemas: allSchemas, getSchema } = useSchemas();
  const {
    relationships: allRelationships,
    addRelationship,
    updateRelationship,
    removeRelationship
  } = useSchemaRelationships();

  const currentSchema = getSchema(schemaType);
  const ports = currentSchema?.ports || [];

  // Filter to relationships where this schema is source or target
  const schemaRelationships = allRelationships.filter(
    r => r.sourceSchemaType === schemaType || r.targetSchemaType === schemaType
  );

  // Filter out the current construct type from suggestions
  const availableSchemas = allSchemas.filter(s => s.type !== schemaType);

  const handleAdd = () => {
    const newRelationship: SchemaRelationship = {
      id: generateRelationshipId(),
      sourceSchemaType: schemaType,
      sourcePortId: '',
      targetSchemaType: '',
      targetPortId: '',
      packageId: currentSchema?.packageId,
    };
    addRelationship(newRelationship);
  };

  const handleUpdate = (id: string, updates: Partial<SchemaRelationship>) => {
    // If changing target type, clear target port
    if (updates.targetSchemaType !== undefined) {
      updateRelationship(id, { ...updates, targetPortId: '' });
    } else {
      updateRelationship(id, updates);
    }
  };

  return (
    <div className="bg-surface-elevated rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Related Constructs</h3>
          <p className="text-xs text-content-muted mt-1 mb-0">
            Define construct types that commonly relate to this one. These appear in the right-click "Add Related" menu.
          </p>
        </div>
        <button
          className="px-2.5 py-1 bg-surface-alt rounded text-content text-xs cursor-pointer hover:bg-content-muted transition-colors"
          onClick={handleAdd}
          disabled={availableSchemas.length === 0}
        >
          + Add Related
        </button>
      </div>

      {schemaRelationships.length === 0 ? (
        <p className="text-content-muted text-sm italic m-0">
          No related constructs defined. Add suggestions to enable quick-add from the canvas.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {schemaRelationships.map((relationship) => {
            // Determine if this schema is source or target, and get the related schema
            const isSource = relationship.sourceSchemaType === schemaType;
            const relatedType = isSource ? relationship.targetSchemaType : relationship.sourceSchemaType;
            const relatedSchema = getSchema(relatedType);
            const thisPortId = isSource ? relationship.sourcePortId : relationship.targetPortId;
            const relatedPortId = isSource ? relationship.targetPortId : relationship.sourcePortId;

            return (
              <div key={relationship.id} className="bg-surface p-3 rounded border border-surface-alt">
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
                      {relatedSchema?.displayName || relatedType}
                    </span>
                  </div>
                  <button
                    className="px-2 py-1 border text-danger text-xs hover:bg-danger-muted rounded transition-colors"
                    onClick={() => removeRelationship(relationship.id)}
                    title="Remove suggestion"
                  >
                    Remove
                  </button>
                </div>

                {/* Configuration */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-content-muted mb-1">
                      Construct Type <span className="text-danger">*</span>
                    </label>
                    <select
                      className="w-full px-2 py-1.5 bg-surface-alt rounded text-content text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      value={relatedType}
                      onChange={(e) => {
                        if (isSource) {
                          handleUpdate(relationship.id, { targetSchemaType: e.target.value });
                        } else {
                          handleUpdate(relationship.id, { sourceSchemaType: e.target.value });
                        }
                      }}
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
                        value={thisPortId || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (isSource) {
                            updateRelationship(relationship.id, { sourcePortId: value });
                          } else {
                            updateRelationship(relationship.id, { targetPortId: value });
                          }
                        }}
                      >
                        <option value="">(No connection)</option>
                        {ports.map(port => (
                          <option key={port.id} value={port.id}>
                            {port.label} ({port.portType})
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
                        value={relatedPortId || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (isSource) {
                            updateRelationship(relationship.id, { targetPortId: value });
                          } else {
                            updateRelationship(relationship.id, { sourcePortId: value });
                          }
                        }}
                        disabled={!relatedType}
                      >
                        <option value="">(No connection)</option>
                        {relatedSchema?.ports?.map(port => (
                          <option key={port.id} value={port.id}>
                            {port.label} ({port.portType})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Validation Messages */}
                  {(thisPortId || relatedPortId) && (
                    <div className="text-xs">
                      {thisPortId && !relatedPortId && (
                        <p className="text-warning m-0">⚠️ Both ports must be selected for auto-connection</p>
                      )}
                      {!thisPortId && relatedPortId && (
                        <p className="text-warning m-0">⚠️ Both ports must be selected for auto-connection</p>
                      )}
                      {thisPortId && relatedPortId && (() => {
                        const fromPort = ports.find(p => p.id === thisPortId);
                        const toPort = relatedSchema?.ports?.find(p => p.id === relatedPortId);
                        const isValid = fromPort && toPort && canConnect(fromPort.portType, toPort.portType);
                        return isValid ? (
                          <p className="text-content-muted m-0">
                            ✓ Valid pairing: {fromPort.portType} → {toPort.portType}
                          </p>
                        ) : (
                          <p className="text-danger m-0">
                            ✗ Invalid pairing: {fromPort?.portType || '?'} cannot connect to {toPort?.portType || '?'}
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
                    value={relationship.label || ''}
                    onChange={(e) => updateRelationship(relationship.id, { label: e.target.value || undefined })}
                    placeholder={relatedSchema?.displayName || 'Custom label for menu'}
                  />
                </div>

                {/* Summary */}
                {thisPortId && relatedPortId && (
                  <div className="mt-2 pt-2 border-t border-surface-alt">
                    <div className="text-xs text-content-muted">
                      <span className="font-medium">Auto-connect:</span> "{ports.find(p => p.id === thisPortId)?.label || thisPortId}" → "{relatedSchema?.ports?.find(p => p.id === relatedPortId)?.label || relatedPortId}"
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
