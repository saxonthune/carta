import { useState, useCallback, type ReactNode } from 'react';
import type { Node } from '@xyflow/react';
import { registry } from '../constructs/registry';
import { fieldRenderers } from './fields';
import type { ConstructNodeData, Deployable, ConstructValues } from '../constructs/types';

interface InstanceViewerProps {
  node: Node;
  deployables: Deployable[];
  onNodeUpdate: (nodeId: string, updates: Partial<ConstructNodeData>) => void;
}

type ViewerTab = 'details' | 'connections';

export default function InstanceViewer({ node, deployables, onNodeUpdate }: InstanceViewerProps) {
  const data = node.data as ConstructNodeData;
  const schema = registry.getSchema(data.constructType);
  const [nameValue, setNameValue] = useState(data.name);
  const [activeTab, setActiveTab] = useState<ViewerTab>('details');

  const handleNameChange = useCallback((newName: string) => {
    setNameValue(newName);
    onNodeUpdate(node.id, { name: newName });
  }, [node.id, onNodeUpdate]);

  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    const newValues: ConstructValues = {
      ...data.values,
      [fieldName]: value,
    };
    onNodeUpdate(node.id, { values: newValues });
  }, [node.id, data.values, onNodeUpdate]);

  const handleDeployableChange = useCallback((deployableId: string | null) => {
    onNodeUpdate(node.id, { deployableId });
  }, [node.id, onNodeUpdate]);

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

  const tabs: { id: ViewerTab; label: string; icon: ReactNode }[] = [
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
        className="flex items-center gap-2 px-4 py-2.5 text-white border-b border-white/20 shrink-0"
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
        <span className="text-sm font-semibold">Instance Viewer</span>
        <span className="text-xs opacity-75">• {schema.displayName}</span>
      </div>

      {/* Content with tabs */}
      <div className="flex-1 min-h-0 flex gap-3 p-3">
        {/* Vertical Tab Bar */}
        <div className="bg-surface-depth-1 flex flex-col w-[110px] shrink-0 p-2 gap-1 rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex flex-row items-center justify-start gap-2 p-1 rounded-lg cursor-pointer transition-all ${
                activeTab === tab.id
                  ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-sm shadow-accent/20'
                  : 'text-content bg-transparent hover:bg-surface-depth-3/50'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <div className="w-4 h-4 shrink-0">
                {tab.icon}
              </div>
              <span className="text-[12px] font-medium leading-tight">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-surface-depth-3 p-4 overflow-y-auto min-h-0 rounded-xl">
          <div className="max-w-3xl mx-auto space-y-3">
            {activeTab === 'details' && (
              <>
                {/* Instance Info Island */}
                <div className="bg-surface-depth-2 rounded-xl p-3">
                  <h3 className="text-xs font-semibold text-content-muted uppercase mb-3">Instance Info</h3>
                  
                  {/* Name field */}
                  <div className="flex flex-col gap-1 mb-3">
                    <label className="text-[11px] font-semibold text-content-muted uppercase">Name</label>
                    <input
                      type="text"
                      className="px-2.5 py-1.5 rounded text-sm text-content bg-surface outline-none focus:ring-2 focus:ring-accent/60 focus:shadow-[0_0_0_2px_rgba(99,102,241,0.1)] transition-all border border-transparent"
                      value={nameValue}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Enter instance name"
                    />
                  </div>

                  {/* Semantic ID (read-only) */}
                  {data.semanticId && (
                    <div className="flex flex-col gap-1 mb-3">
                      <label className="text-[11px] font-semibold text-content-muted uppercase">Semantic ID</label>
                      <div className="px-2.5 py-1.5 rounded text-sm text-content-subtle bg-surface-alt font-mono text-xs">
                        {data.semanticId}
                      </div>
                    </div>
                  )}

                  {/* Deployable selector */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-content-muted uppercase">Deployable</label>
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-surface border border-transparent focus-within:ring-2 focus-within:ring-accent/60 transition-all">
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
                  </div>
                </div>

                {/* Fields Island */}
                {schema.fields.length > 0 && (
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
