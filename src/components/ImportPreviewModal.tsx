import { useState } from 'react';
import type { ImportAnalysis, ImportOptions, AnalyzedSchema, AnalyzedNode, AnalyzedDeployable } from '../utils/importAnalyzer';
import { defaultImportOptions } from '../utils/importAnalyzer';

interface ImportPreviewModalProps {
  analysis: ImportAnalysis;
  onConfirm: (options: ImportOptions) => void;
  onCancel: () => void;
}

function SchemaItem({ schema, selected, onToggle }: { schema: AnalyzedSchema; selected: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center gap-3 py-1.5 px-2 text-sm cursor-pointer hover:bg-surface-alt">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-4 h-4 accent-accent"
      />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: schema.item.color }}
        />
        <span className="text-content truncate">{schema.item.displayName}</span>
        <span className="text-content-muted text-xs">({schema.item.type})</span>
      </div>
      {schema.status === 'conflict' && (
        <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded flex-shrink-0">
          conflict
        </span>
      )}
      {schema.status === 'new' && (
        <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded flex-shrink-0">
          new
        </span>
      )}
    </label>
  );
}

function InstanceItem({ instance, analysis, selected, onToggle }: { instance: AnalyzedNode; analysis: ImportAnalysis; selected: boolean; onToggle: () => void }) {
  const nodeData = instance.item.data as any;
  
  // Find the schema from the analysis's file schemas
  const schema = analysis.schemas.items.find(
    s => s.item.type === nodeData.constructType
  )?.item;
  
  return (
    <label className="flex items-center gap-3 py-1.5 px-2 text-sm cursor-pointer hover:bg-surface-alt">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-4 h-4 accent-accent"
      />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {schema && (
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: schema.color }}
          />
        )}
        <span className="text-content truncate">{nodeData.semanticId}</span>
        <span className="text-content-muted text-xs">({nodeData.constructType})</span>
      </div>
      {instance.status === 'conflict' && (
        <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded flex-shrink-0">
          conflict
        </span>
      )}
      {instance.status === 'new' && (
        <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded flex-shrink-0">
          new
        </span>
      )}
    </label>
  );
}

function DeployableItem({ deployable, selected, onToggle }: { deployable: AnalyzedDeployable; selected: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center gap-3 py-1.5 px-2 text-sm cursor-pointer hover:bg-surface-alt">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-4 h-4 accent-accent"
      />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: deployable.item.color || '#6b7280' }}
        />
        <span className="text-content truncate">{deployable.item.name}</span>
      </div>
      {deployable.status === 'conflict' && (
        <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded flex-shrink-0">
          conflict
        </span>
      )}
      {deployable.status === 'new' && (
        <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded flex-shrink-0">
          new
        </span>
      )}
    </label>
  );
}

export default function ImportPreviewModal({
  analysis,
  onConfirm,
  onCancel,
}: ImportPreviewModalProps) {
  const [options, setOptions] = useState<ImportOptions>(defaultImportOptions(analysis));
  const [schemasExpanded, setSchemasExpanded] = useState(true);
  const [instancesExpanded, setInstancesExpanded] = useState(true);
  const [deployablesExpanded, setDeployablesExpanded] = useState(true);

  const toggleSchema = (schemaType: string) => {
    setOptions(prev => {
      const newSchemas = new Set(prev.schemas);
      if (newSchemas.has(schemaType)) {
        newSchemas.delete(schemaType);
      } else {
        newSchemas.add(schemaType);
      }
      return { ...prev, schemas: newSchemas };
    });
  };

  const toggleInstance = (nodeId: string) => {
    setOptions(prev => {
      const newNodes = new Set(prev.nodes);
      if (newNodes.has(nodeId)) {
        newNodes.delete(nodeId);
      } else {
        newNodes.add(nodeId);
      }
      return { ...prev, nodes: newNodes };
    });
  };

  const toggleDeployable = (deployableId: string) => {
    setOptions(prev => {
      const newDeployables = new Set(prev.deployables);
      if (newDeployables.has(deployableId)) {
        newDeployables.delete(deployableId);
      } else {
        newDeployables.add(deployableId);
      }
      return { ...prev, deployables: newDeployables };
    });
  };

  const selectAllSchemas = () => {
    setOptions(prev => ({
      ...prev,
      schemas: new Set(analysis.schemas.items.map(s => s.item.type))
    }));
  };

  const deselectAllSchemas = () => {
    setOptions(prev => ({
      ...prev,
      schemas: new Set()
    }));
  };

  const selectAllInstances = () => {
    setOptions(prev => ({
      ...prev,
      nodes: new Set(analysis.nodes.items.map(n => n.item.id))
    }));
  };

  const deselectAllInstances = () => {
    setOptions(prev => ({
      ...prev,
      nodes: new Set()
    }));
  };

  const selectAllDeployables = () => {
    setOptions(prev => ({
      ...prev,
      deployables: new Set(analysis.deployables.items.map(d => d.item.id))
    }));
  };

  const deselectAllDeployables = () => {
    setOptions(prev => ({
      ...prev,
      deployables: new Set()
    }));
  };

  const hasSelectedAnything = options.schemas.size > 0 || options.nodes.size > 0 || options.deployables.size > 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-xl w-[90%] max-w-[500px] flex flex-col shadow-2xl max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border">
          <div>
            <h2 className="m-0 text-lg text-content">Import Preview</h2>
            <p className="m-0 text-sm text-content-muted mt-0.5">{analysis.title}</p>
          </div>
          <button
            className="w-9 h-9 border-none rounded-md bg-transparent text-content-subtle text-2xl cursor-pointer flex items-center justify-center hover:bg-surface-alt hover:text-content"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Conflict warning */}
          {analysis.hasConflicts && (
            <div className="flex items-start gap-3 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <svg
                className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <p className="m-0 text-amber-800 font-medium text-sm">
                  Schema conflicts detected
                </p>
                <p className="m-0 text-amber-700 text-xs mt-1">
                  Some schemas have the same type as existing custom schemas. Importing will replace them.
                </p>
              </div>
            </div>
          )}

          {/* Categories */}
          <div className="space-y-3">
            {/* Schemas */}
            <div className="bg-surface-depth-2 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-alt text-left"
                onClick={() => setSchemasExpanded(!schemasExpanded)}
              >
                <svg
                  className={`w-4 h-4 text-content-muted transition-transform flex-shrink-0 ${schemasExpanded ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="text-content font-medium">Construct Schemas</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {analysis.schemas.summary.conflicts > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                      {analysis.schemas.summary.conflicts} conflict{analysis.schemas.summary.conflicts !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-content-muted text-sm">
                    ({options.schemas.size}/{analysis.schemas.summary.total})
                  </span>
                </div>
              </button>
              {schemasExpanded && analysis.schemas.items.length > 0 && (
                <div className="bg-surface-depth-3">
                  <div className="flex gap-2 p-2 bg-surface-depth-2">
                    <button
                      type="button"
                      onClick={selectAllSchemas}
                      className="flex-1 px-2 py-1 text-xs bg-surface-alt text-content rounded hover:bg-surface-depth-3 transition-colors"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllSchemas}
                      className="flex-1 px-2 py-1 text-xs bg-surface-alt text-content rounded hover:bg-surface-depth-3 transition-colors"
                    >
                      None
                    </button>
                  </div>
                  {analysis.schemas.items.map((schema) => (
                    <SchemaItem
                      key={schema.item.type}
                      schema={schema}
                      selected={options.schemas.has(schema.item.type)}
                      onToggle={() => toggleSchema(schema.item.type)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Instances */}
            <div className="bg-surface-depth-2 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-alt text-left"
                onClick={() => setInstancesExpanded(!instancesExpanded)}
              >
                <svg
                  className={`w-4 h-4 text-content-muted transition-transform flex-shrink-0 ${instancesExpanded ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="text-content font-medium">Instances</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {analysis.nodes.summary.conflicts > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                      {analysis.nodes.summary.conflicts} conflict{analysis.nodes.summary.conflicts !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-content-muted text-sm">
                    ({options.nodes.size}/{analysis.nodes.summary.total})
                  </span>
                </div>
              </button>
              {instancesExpanded && analysis.nodes.items.length > 0 && (
                <div className="bg-surface-depth-3">
                  <div className="flex gap-2 p-2 bg-surface-depth-2">
                    <button
                      type="button"
                      onClick={selectAllInstances}
                      className="flex-1 px-2 py-1 text-xs bg-surface-alt text-content rounded hover:bg-surface-depth-3 transition-colors"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllInstances}
                      className="flex-1 px-2 py-1 text-xs bg-surface-alt text-content rounded hover:bg-surface-depth-3 transition-colors"
                    >
                      None
                    </button>
                  </div>
                  {analysis.nodes.items.map((instance) => (
                    <InstanceItem
                      key={instance.item.id}
                      instance={instance}
                      analysis={analysis}
                      selected={options.nodes.has(instance.item.id)}
                      onToggle={() => toggleInstance(instance.item.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Deployables */}
            <div className="bg-surface-depth-2 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-alt text-left"
                onClick={() => setDeployablesExpanded(!deployablesExpanded)}
              >
                <svg
                  className={`w-4 h-4 text-content-muted transition-transform flex-shrink-0 ${deployablesExpanded ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="text-content font-medium">Deployables</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {analysis.deployables.summary.conflicts > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                      {analysis.deployables.summary.conflicts} conflict{analysis.deployables.summary.conflicts !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-content-muted text-sm">
                    ({options.deployables.size}/{analysis.deployables.summary.total})
                  </span>
                </div>
              </button>
              {deployablesExpanded && analysis.deployables.items.length > 0 && (
                <div className="bg-surface-depth-3">
                  <div className="flex gap-2 p-2 bg-surface-depth-2">
                    <button
                      type="button"
                      onClick={selectAllDeployables}
                      className="flex-1 px-2 py-1 text-xs bg-surface-alt text-content rounded hover:bg-surface-depth-3 transition-colors"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllDeployables}
                      className="flex-1 px-2 py-1 text-xs bg-surface-alt text-content rounded hover:bg-surface-depth-3 transition-colors"
                    >
                      None
                    </button>
                  </div>
                  {analysis.deployables.items.map((deployable) => (
                    <DeployableItem
                      key={deployable.item.id}
                      deployable={deployable}
                      selected={options.deployables.has(deployable.item.id)}
                      onToggle={() => toggleDeployable(deployable.item.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-4 py-3 border-t border">
          <button
            className="px-4 py-2 rounded-md bg-surface text-content text-sm font-medium cursor-pointer hover:bg-surface-alt transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 border-none rounded-md bg-emerald-500 text-white text-sm font-medium cursor-pointer hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onConfirm(options)}
            disabled={!hasSelectedAnything}
          >
            Import Selected
          </button>
        </div>
      </div>
    </div>
  );
}
