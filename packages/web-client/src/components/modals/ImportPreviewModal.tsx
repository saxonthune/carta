import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { ImportAnalysis, ImportOptions, AnalyzedSchema, AnalyzedNode } from '../../utils/importAnalyzer';
import { defaultImportOptions } from '../../utils/importAnalyzer';

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

export default function ImportPreviewModal({
  analysis,
  onConfirm,
  onCancel,
}: ImportPreviewModalProps) {
  const [options, setOptions] = useState<ImportOptions>(defaultImportOptions(analysis));
  const [schemasExpanded, setSchemasExpanded] = useState(true);
  const [instancesExpanded, setInstancesExpanded] = useState(true);

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

  const hasSelectedAnything = options.schemas.size > 0 || options.nodes.size > 0;

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title="Import Preview"
      subtitle={analysis.title}
      maxWidth="500px"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(options)} disabled={!hasSelectedAnything}>Import Selected</Button>
        </div>
      }
    >
      {/* Description if present */}
      {analysis.description && (
        <p className="text-sm text-content-muted mb-4">{analysis.description}</p>
      )}

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

        {/* Read-only info: Port Schemas, Schema Groups, Edges */}
        {(analysis.portSchemas.count > 0 || analysis.schemaGroups.count > 0 || analysis.edges.count > 0) && (
          <div className="bg-surface-depth-2 rounded-lg p-3">
            <div className="text-xs text-content-muted uppercase tracking-wide mb-2">Also Included</div>
            <div className="flex flex-wrap gap-3 text-sm">
              {analysis.portSchemas.count > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-violet-400" />
                  <span className="text-content">{analysis.portSchemas.count} port type{analysis.portSchemas.count !== 1 ? 's' : ''}</span>
                </div>
              )}
              {analysis.schemaGroups.count > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-content">{analysis.schemaGroups.count} schema group{analysis.schemaGroups.count !== 1 ? 's' : ''}</span>
                </div>
              )}
              {analysis.edges.count > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-content">{analysis.edges.count} connection{analysis.edges.count !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
