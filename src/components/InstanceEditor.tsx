import { useState, useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { useDocument } from '../hooks/useDocument';
import { fieldRenderers } from './fields';
import TabBar, { type Tab } from './ui/TabBar';
import type { ConstructNodeData, Deployable, ConstructValues } from '../constructs/types';
import { getDisplayName } from '../utils/displayUtils';

interface InstanceEditorProps {
  node: Node;
  deployables: Deployable[];
  onNodeUpdate: (nodeId: string, updates: Partial<ConstructNodeData>) => void;
}

type ViewerTab = 'details' | 'connections';

export default function InstanceEditor({ node, deployables, onNodeUpdate }: InstanceEditorProps) {
  const { getSchema, addDeployable } = useDocument();
  const data = node.data as ConstructNodeData;
  const schema = getSchema(data.constructType);
  const [semanticIdValue, setSemanticIdValue] = useState(data.semanticId);
  const [activeTab, setActiveTab] = useState<ViewerTab>('details');
  const [showAddDeployable, setShowAddDeployable] = useState(false);
  const [newDeployableName, setNewDeployableName] = useState('');

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

  const handleDeployableChange = useCallback((deployableId: string | null) => {
    onNodeUpdate(node.id, { deployableId });
  }, [node.id, onNodeUpdate]);

  const handleAddDeployable = useCallback(() => {
    if (newDeployableName.trim()) {
      const newDeployable = addDeployable({
        name: newDeployableName.trim(),
        description: '',
      });
      onNodeUpdate(node.id, { deployableId: newDeployable.id });
      setNewDeployableName('');
      setShowAddDeployable(false);
    }
  }, [newDeployableName, addDeployable, onNodeUpdate, node.id]);

  const handleAddDeployableKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDeployable();
    } else if (e.key === 'Escape') {
      setShowAddDeployable(false);
      setNewDeployableName('');
    }
  }, [handleAddDeployable]);

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
      icon: (
        <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
      )
    },
    {
      id: 'connections',
      label: 'Connections',
      icon: (
        <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 8l4 4-4 4M3 12h18" />
        </svg>
      )
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Schema header with color accent */}
      <div
        className="flex items-center gap-2 px-4 py-2 text-white border-b border-white/20 shrink-0"
        style={{ backgroundColor: schema.color }}
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
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
                  <div className="flex flex-col gap-1 mb-3">
                    <label className="text-[11px] font-semibold text-content-muted uppercase">Semantic ID</label>
                    <input
                      type="text"
                      className="px-2.5 py-1.5 rounded text-sm text-content bg-surface outline-none focus:ring-2 focus:ring-accent/60 focus:shadow-[0_0_0_2px_rgba(99,102,241,0.1)] transition-all border border-transparent font-mono text-xs"
                      value={semanticIdValue}
                      onChange={(e) => handleSemanticIdChange(e.target.value)}
                      placeholder="e.g., controller-user-api"
                    />
                  </div>

                  {/* Deployable selector */}
                  <div className="flex flex-col gap-1 relative">
                    <label className="text-[11px] font-semibold text-content-muted uppercase">Deployable</label>

                    {/* Add deployable inline form */}
                    {showAddDeployable && (
                      <div className="mb-2 bg-surface-depth-1 rounded-lg p-2 border border-accent/30 shadow-sm">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="flex-1 px-2 py-1 text-xs rounded bg-surface text-content outline-none focus:ring-2 focus:ring-accent/60 transition-all border border-subtle"
                            placeholder="Deployable name"
                            value={newDeployableName}
                            onChange={(e) => setNewDeployableName(e.target.value)}
                            onKeyDown={handleAddDeployableKeyDown}
                            autoFocus
                          />
                          <button
                            className="px-3 py-1 text-xs font-medium rounded bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleAddDeployable}
                            disabled={!newDeployableName.trim()}
                          >
                            Add
                          </button>
                          <button
                            className="px-2 py-1 text-xs rounded text-content-muted hover:text-content hover:bg-surface-alt transition-colors"
                            onClick={() => {
                              setShowAddDeployable(false);
                              setNewDeployableName('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded bg-surface border border-transparent focus-within:ring-2 focus-within:ring-accent/60 transition-all">
                        <svg
                          className="w-4 h-4 text-content-subtle shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                          <line x1="12" y1="22.08" x2="12" y2="12" />
                        </svg>
                        <select
                          className={`flex-1 bg-transparent outline-none text-sm cursor-pointer ${
                            !data.deployableId ? 'text-content-subtle italic' : 'text-content'
                          }`}
                          value={data.deployableId || ''}
                          onChange={(e) => handleDeployableChange(e.target.value || null)}
                        >
                          <option value="" className="italic text-content-subtle">None</option>
                          {deployables.map((d) => (
                            <option key={d.id} value={d.id} className="not-italic text-content">
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        className="text-xs text-accent hover:text-accent-hover font-medium cursor-pointer hover:underline transition-colors"
                        onClick={() => setShowAddDeployable(!showAddDeployable)}
                      >
                        + Add
                      </button>
                    </div>
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
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 8l4 4-4 4M3 12h18" />
                          </svg>
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
