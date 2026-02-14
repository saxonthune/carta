import { useState, useMemo } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { Edge } from '@xyflow/react';
import type { ExportAnalysis, ExportOptions } from '../../utils/exportAnalyzer';
import { defaultExportOptions } from '../../utils/exportAnalyzer';
import type { ConstructSchema } from '@carta/domain';
import { CARTA_FILE_VERSION, type CartaFile } from '../../utils/cartaFile';

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

  const hasSelectedAnything = options.schemas || options.nodes || options.portSchemas || options.schemaGroups;

  // Generate the raw CartaFile JSON for preview
  const rawJson = useMemo(() => {
    const cartaFile: CartaFile = {
      version: CARTA_FILE_VERSION,
      title: analysis.title,
      description: analysis.description || undefined,
      pages: [{
        id: 'preview',
        name: 'Main',
        order: 0,
        nodes: options.nodes ? analysis.nodes.items : [],
        edges: options.nodes ? edges : [],
      }],
      customSchemas: options.schemas ? analysis.schemas.items : [],
      portSchemas: options.portSchemas ? analysis.portSchemas.items : [],
      schemaGroups: options.schemaGroups ? analysis.schemaGroups.items : [],
      schemaPackages: [],
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(cartaFile, null, 2);
  }, [analysis, edges, options]);

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title="Export Preview"
      subtitle={analysis.title}
      maxWidth="500px"
      footer={
        <div className="flex gap-2 justify-between">
          <Button variant="secondary" onClick={() => setShowRawPreview(!showRawPreview)}>
            {showRawPreview ? 'Back' : 'Preview Raw'}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={() => onConfirm(options)} disabled={!hasSelectedAnything}>Export Selected</Button>
          </div>
        </div>
      }
    >
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
                      <CaretDown
                        weight="bold"
                        size={14}
                        className={`text-content-muted transition-transform ${schemasExpanded ? 'rotate-180' : ''}`}
                      />
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
                      <CaretDown
                        weight="bold"
                        size={14}
                        className={`text-content-muted transition-transform ${portSchemasExpanded ? 'rotate-180' : ''}`}
                      />
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
                      <CaretDown
                        weight="bold"
                        size={14}
                        className={`text-content-muted transition-transform ${schemaGroupsExpanded ? 'rotate-180' : ''}`}
                      />
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
    </Modal>
  );
}
