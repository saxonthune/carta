import { useState } from 'react';
import type { ImportAnalysis, ImportOptions, AnalyzedSchema } from '../utils/importAnalyzer';
import { defaultImportOptions } from '../utils/importAnalyzer';

interface ImportPreviewModalProps {
  analysis: ImportAnalysis;
  onConfirm: (options: ImportOptions) => void;
  onCancel: () => void;
}

function SchemaItem({ schema }: { schema: AnalyzedSchema }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 text-sm">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: schema.item.color }}
        />
        <span className="text-content">{schema.item.displayName}</span>
        <span className="text-content-muted text-xs">({schema.item.type})</span>
      </div>
      {schema.status === 'conflict' && (
        <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
          conflict
        </span>
      )}
      {schema.status === 'new' && (
        <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
          new
        </span>
      )}
    </div>
  );
}

export default function ImportPreviewModal({
  analysis,
  onConfirm,
  onCancel,
}: ImportPreviewModalProps) {
  const [options, setOptions] = useState<ImportOptions>(defaultImportOptions);
  const [schemasExpanded, setSchemasExpanded] = useState(false);

  const handleToggle = (key: keyof ImportOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasSelectedAnything = options.schemas || options.nodes || options.deployables;

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
        <div className="flex items-center justify-between px-5 py-4 border-b border">
          <div>
            <h2 className="m-0 text-lg text-content">Import Preview</h2>
            <p className="m-0 text-sm text-content-muted mt-0.5">{analysis.title}</p>
          </div>
          <button
            className="w-8 h-8 border-none rounded-md bg-transparent text-content-subtle text-2xl cursor-pointer flex items-center justify-center hover:bg-surface-alt hover:text-content"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
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
            <div className="border rounded-lg overflow-hidden">
              <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-alt">
                <input
                  type="checkbox"
                  checked={options.schemas}
                  onChange={() => handleToggle('schemas')}
                  disabled={analysis.schemas.summary.total === 0}
                  className="w-4 h-4 accent-accent"
                />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-content font-medium">Construct Schemas</span>
                  <div className="flex items-center gap-2">
                    {analysis.schemas.summary.conflicts > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                        {analysis.schemas.summary.conflicts} conflict{analysis.schemas.summary.conflicts !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-content-muted text-sm">
                      ({analysis.schemas.summary.total})
                    </span>
                    {analysis.schemas.summary.total > 0 && (
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
                    <SchemaItem key={schema.item.type} schema={schema} />
                  ))}
                </div>
              )}
            </div>

            {/* Nodes - disabled for now */}
            <div className="border rounded-lg opacity-60">
              <label className="flex items-center gap-3 p-3 cursor-not-allowed">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="w-4 h-4"
                />
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-content font-medium">Nodes</span>
                    <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      Coming soon
                    </span>
                  </div>
                  <span className="text-content-muted text-sm">
                    ({analysis.nodes.summary.total})
                  </span>
                </div>
              </label>
            </div>

            {/* Deployables - disabled for now */}
            <div className="border rounded-lg opacity-60">
              <label className="flex items-center gap-3 p-3 cursor-not-allowed">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="w-4 h-4"
                />
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-content font-medium">Deployables</span>
                    <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      Coming soon
                    </span>
                  </div>
                  <span className="text-content-muted text-sm">
                    ({analysis.deployables.summary.total})
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-4 border-t border">
          <button
            className="px-5 py-2.5 rounded-md bg-surface text-content text-sm font-medium cursor-pointer hover:bg-surface-alt transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-5 py-2.5 border-none rounded-md bg-accent text-white text-sm font-medium cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
