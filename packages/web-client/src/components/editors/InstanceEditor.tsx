import { useState, useCallback } from 'react';
import { FileText, ArrowsLeftRight, Eye, ArrowRight } from '@phosphor-icons/react';
import type { CartaNode } from '@carta/types';
import { useSchemas } from '../../hooks/useSchemas';
import { fieldRenderers } from '../fields';
import TabBar, { type Tab } from '../ui/TabBar';
import { getDisplayName } from '@carta/domain';
import type { ConstructNodeData, ConstructValues } from '@carta/domain';

interface InstanceEditorProps {
  node: CartaNode;
  onNodeUpdate: (nodeId: string, updates: Partial<ConstructNodeData>) => void;
}

type ViewerTab = 'details' | 'connections';

export default function InstanceEditor({ node, onNodeUpdate }: InstanceEditorProps) {
  const { getSchema } = useSchemas();
  const data = node.data as ConstructNodeData;
  const schema = getSchema(data.constructType);
  const [semanticIdValue, setSemanticIdValue] = useState(data.semanticId);
  const [activeTab, setActiveTab] = useState<ViewerTab>('details');

  const handleSemanticIdChange = useCallback((newSemanticId: string) => {
    setSemanticIdValue(newSemanticId);
    onNodeUpdate(node.id, { semanticId: newSemanticId });
  }, [node.id, onNodeUpdate]);

  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    const currentData = node.data as ConstructNodeData;
    const newValues: ConstructValues = {
      ...currentData.values,
      [fieldName]: value,
    };
    onNodeUpdate(node.id, { values: newValues });
  }, [node, onNodeUpdate]);

  if (!schema) {
    return (
      <div className="p-4 text-content-muted">
        <div className="bg-danger-muted border-2 border-danger rounded-lg p-3">
          <p className="text-danger font-semibold">Unknown construct type:</p>
          <p className="text-content mt-1">{data.constructType}</p>
        </div>
      </div>
    );
  }

  const tabs: Tab<ViewerTab>[] = [
    {
      id: 'details',
      label: 'Details',
      icon: <FileText weight="regular" size={18} />
    },
    {
      id: 'connections',
      label: 'Connections',
      icon: <ArrowsLeftRight weight="regular" size={18} />
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Schema header with color accent */}
      <div
        className="flex items-center gap-2 px-4 py-2 text-white border-b border-white/20 shrink-0"
        style={{ backgroundColor: schema.color }}
      >
        <Eye weight="regular" size={20} />
        <span className="text-sm font-semibold">Instance Editor</span>
        <span className="text-xs opacity-75">• {schema.displayName}</span>
      </div>

      {/* Content with tabs */}
      <div className="flex-1 min-h-0 flex gap-3 p-3">
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Content Area */}
        <div className="flex-1 bg-surface-depth-3 p-4 overflow-y-auto min-h-0 rounded-xl">
          <div className="max-w-3xl mx-auto space-y-3">
            {activeTab === 'details' && (
              <>
                {/* Instance Info Island */}
                <div className="bg-surface-depth-2 rounded-xl p-3">
                  <h3 className="text-xs font-semibold text-content-muted uppercase mb-3">Instance Info</h3>

                  {/* Display name (read-only, derived) */}
                  <div className="flex flex-col gap-1 mb-3">
                    <label className="text-[11px] font-semibold text-content-muted uppercase">Display Name</label>
                    <div className="px-2.5 py-1.5 rounded text-sm text-content bg-surface-alt">
                      {getDisplayName(data, schema)}
                    </div>
                  </div>

                  {/* Semantic ID (editable) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-content-muted uppercase">Semantic ID</label>
                    <input
                      type="text"
                      className="px-2.5 py-1.5 rounded text-sm text-content bg-surface outline-none focus:ring-2 focus:ring-accent/60 focus:shadow-[0_0_0_2px_rgba(99,102,241,0.1)] transition-all border border-transparent font-mono text-xs"
                      value={semanticIdValue}
                      onChange={(e) => handleSemanticIdChange(e.target.value)}
                      placeholder="e.g., controller-user-api"
                    />
                  </div>
                </div>

                {/* Fields Island */}
                {Array.isArray(schema.fields) && schema.fields.length > 0 && (
                  <div className="bg-surface-depth-2 rounded-xl p-3">
                    <h3 className="text-xs font-semibold text-content-muted uppercase mb-3">Fields</h3>
                    <div className="space-y-3">
                      {schema.fields.map((field) => {
                        const FieldRenderer = fieldRenderers[field.type];
                        const value = data.values[field.name] ?? field.default;

                        return (
                          <FieldRenderer
                            key={field.name}
                            field={field}
                            value={value}
                            onChange={(newValue: unknown) => handleFieldChange(field.name, newValue)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'connections' && (
              <div className="bg-surface-depth-2 rounded-xl p-3">
                <h3 className="text-xs font-semibold text-content-muted uppercase mb-3">Connections</h3>
                {data.connections && data.connections.length > 0 ? (
                  <div className="space-y-2">
                    {data.connections.map((conn, idx) => (
                      <div key={idx} className="px-2.5 py-1.5 rounded bg-surface text-xs">
                        <div className="flex items-center gap-2 text-content-subtle">
                          <ArrowRight weight="bold" size={14} />
                          <span className="font-medium text-content">{conn.portId}</span>
                          <span>→</span>
                          <span className="font-mono text-content">{conn.targetSemanticId}</span>
                          <span className="text-content-muted">({conn.targetPortId})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-content-muted text-sm text-center py-4">
                    No connections yet. Connect this construct to others on the map.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
