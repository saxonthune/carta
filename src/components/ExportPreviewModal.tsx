import { useState } from 'react';
import type { ExportAnalysis, ExportOptions } from '../utils/exportAnalyzer';
import { defaultExportOptions } from '../utils/exportAnalyzer';
import type { ConstructSchema } from '../constructs/types';

interface ExportPreviewModalProps {
  analysis: ExportAnalysis;
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
  onConfirm,
  onCancel,
}: ExportPreviewModalProps) {
  const [options, setOptions] = useState<ExportOptions>(defaultExportOptions);
  const [schemasExpanded, setSchemasExpanded] = useState(false);

  const handleToggle = (key: keyof ExportOptions) => {
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
            <h2 className="m-0 text-lg text-content">Export Preview</h2>
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
            Export Selected
          </button>
        </div>
      </div>
    </div>
  );
}
