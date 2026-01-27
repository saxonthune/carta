import { useState, useMemo } from 'react';
import type { Edge } from '@xyflow/react';
import type { ExportAnalysis, ExportOptions } from '../utils/exportAnalyzer';
import { defaultExportOptions } from '../utils/exportAnalyzer';
import type { ConstructSchema } from '../constructs/types';
import { CARTA_FILE_VERSION, type CartaFile } from '../utils/cartaFile';

interface ExportPreviewModalProps {
  analysis: ExportAnalysis;
  edges: Edge[];
  onConfirm: (options: ExportOptions) => void;
  onCancel: () => void;
}

function SchemaItem({ schema }: { schema: ConstructSchema }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 text-sm">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: schema.color }}
        />
        <span className="text-content">{schema.displayName}</span>
        <span className="text-content-muted text-xs">({schema.type})</span>
      </div>
    </div>
  );
}

export default function ExportPreviewModal({
  analysis,
  edges,
  onConfirm,
  onCancel,
}: ExportPreviewModalProps) {
  const [options, setOptions] = useState<ExportOptions>(defaultExportOptions);
  const [schemasExpanded, setSchemasExpanded] = useState(false);
  const [portSchemasExpanded, setPortSchemasExpanded] = useState(false);
  const [schemaGroupsExpanded, setSchemaGroupsExpanded] = useState(false);
  const [showRawPreview, setShowRawPreview] = useState(false);

  const handleToggle = (key: keyof ExportOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasSelectedAnything = options.schemas || options.nodes || options.deployables || options.portSchemas || options.schemaGroups;

  // Generate the raw CartaFile JSON for preview
  const rawJson = useMemo(() => {
    const cartaFile: CartaFile = {
      version: CARTA_FILE_VERSION,
      title: analysis.title,
      description: analysis.description || undefined,
      nodes: options.nodes ? analysis.nodes.items : [],
      edges: options.nodes ? edges : [],
      deployables: options.deployables ? analysis.deployables.items : [],
      customSchemas: options.schemas ? analysis.schemas.items : [],
      portSchemas: options.portSchemas ? analysis.portSchemas.items : [],
      schemaGroups: options.schemaGroups ? analysis.schemaGroups.items : [],
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(cartaFile, null, 2);
  }, [analysis, edges, options]);

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
            <h2 className="m-0 text-lg text-content">Export Preview</h2>
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
          {showRawPreview ? (
            <div className="h-full flex flex-col">
              <pre className="flex-1 p-3 bg-surface-alt rounded-lg text-xs text-content font-mono overflow-auto max-h-[400px] whitespace-pre-wrap break-all">
                {rawJson}
              </pre>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Schemas */}
              <div className="border rounded-lg overflow-hidden">
                <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-alt">
                  <input
                    type="checkbox"
                    checked={options.schemas}
                    onChange={() => handleToggle('schemas')}
                    disabled={analysis.schemas.count === 0}
                    className="w-4 h-4 accent-accent"
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-content font-medium">Construct Schemas</span>
                    <div className="flex items-center gap-2">
                      <span className="text-content-muted text-sm">
                        ({analysis.schemas.count})
                      </span>
                      {analysis.schemas.count > 0 && (
                        <button
                          type="button"
                          className="p-1 hover:bg-surface-alt rounded"
                          onClick={(e) => {
                            e.preventDefault();
                            setSchemasExpanded(!schemasExpanded);
                          }}
                        >
                          <svg
                            className={`w-4 h-4 text-content-muted transition-transform ${schemasExpanded ? 'rotate-180' : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </label>
                {schemasExpanded && analysis.schemas.items.length > 0 && (
                  <div className="border-t bg-surface-alt/50">
                    {analysis.schemas.items.map((schema) => (
                      <SchemaItem key={schema.type} schema={schema} />
                    ))}
                  </div>
                )}
              </div>

              {/* Instances */}
              <div className="border rounded-lg overflow-hidden">
                <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-alt">
                  <input
                    type="checkbox"
                    checked={options.nodes}
                    onChange={() => handleToggle('nodes')}
                    disabled={analysis.nodes.count === 0 && analysis.edgeCount === 0}
                    className="w-4 h-4 accent-accent"
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-content font-medium">Instances</span>
                    <span className="text-content-muted text-sm">
                      ({analysis.nodes.count} nodes, {analysis.edgeCount} edges)
                    </span>
                  </div>
                </label>
              </div>

              {/* Deployables */}
              <div className="border rounded-lg overflow-hidden">
                <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-alt">
                  <input
                    type="checkbox"
                    checked={options.deployables}
                    onChange={() => handleToggle('deployables')}
                    disabled={analysis.deployables.count === 0}
                    className="w-4 h-4 accent-accent"
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-content font-medium">Deployables</span>
                    <span className="text-content-muted text-sm">
                      ({analysis.deployables.count})
                    </span>
                  </div>
                </label>
              </div>

              {/* Port Schemas */}
              <div className="border rounded-lg overflow-hidden">
                <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-alt">
                  <input
                    type="checkbox"
                    checked={options.portSchemas}
                    onChange={() => handleToggle('portSchemas')}
                    disabled={analysis.portSchemas.count === 0}
                    className="w-4 h-4 accent-accent"
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-content font-medium">Port Schemas</span>
                    <div className="flex items-center gap-2">
                      <span className="text-content-muted text-sm">
                        ({analysis.portSchemas.count})
                      </span>
                      {analysis.portSchemas.count > 0 && (
                        <button
                          type="button"
                          className="p-1 hover:bg-surface-alt rounded"
                          onClick={(e) => {
                            e.preventDefault();
                            setPortSchemasExpanded(!portSchemasExpanded);
                          }}
                        >
                          <svg
                            className={`w-4 h-4 text-content-muted transition-transform ${portSchemasExpanded ? 'rotate-180' : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </label>
                {portSchemasExpanded && analysis.portSchemas.items.length > 0 && (
                  <div className="border-t bg-surface-alt/50">
                    {analysis.portSchemas.items.map((portSchema) => (
                      <div key={portSchema.id} className="flex items-center justify-between py-1.5 px-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: portSchema.color }}
                          />
                          <span className="text-content">{portSchema.displayName}</span>
                          <span className="text-content-muted text-xs">({portSchema.polarity})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schema Groups */}
              <div className="border rounded-lg overflow-hidden">
                <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-alt">
                  <input
                    type="checkbox"
                    checked={options.schemaGroups}
                    onChange={() => handleToggle('schemaGroups')}
                    disabled={analysis.schemaGroups.count === 0}
                    className="w-4 h-4 accent-accent"
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-content font-medium">Schema Groups</span>
                    <div className="flex items-center gap-2">
                      <span className="text-content-muted text-sm">
                        ({analysis.schemaGroups.count})
                      </span>
                      {analysis.schemaGroups.count > 0 && (
                        <button
                          type="button"
                          className="p-1 hover:bg-surface-alt rounded"
                          onClick={(e) => {
                            e.preventDefault();
                            setSchemaGroupsExpanded(!schemaGroupsExpanded);
                          }}
                        >
                          <svg
                            className={`w-4 h-4 text-content-muted transition-transform ${schemaGroupsExpanded ? 'rotate-180' : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </label>
                {schemaGroupsExpanded && analysis.schemaGroups.items.length > 0 && (
                  <div className="border-t bg-surface-alt/50">
                    {analysis.schemaGroups.items.map((group) => (
                      <div key={group.id} className="flex items-center justify-between py-1.5 px-2 text-sm">
                        <div className="flex items-center gap-2">
                          {group.color && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: group.color }}
                            />
                          )}
                          <span className="text-content">{group.name}</span>
                          {group.parentId && (
                            <span className="text-content-muted text-xs">(nested)</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-between px-4 py-3 border-t border">
          <button
            className="px-4 py-2 rounded-md bg-surface text-content text-sm font-medium cursor-pointer hover:bg-surface-alt transition-colors border border-border"
            onClick={() => setShowRawPreview(!showRawPreview)}
          >
            {showRawPreview ? 'Back' : 'Preview Raw'}
          </button>
          <div className="flex gap-2">
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
              Export Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
