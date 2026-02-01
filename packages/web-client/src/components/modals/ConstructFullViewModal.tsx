import { useMemo, useState } from 'react';
import DraggableWindow from '../ui/DraggableWindow';
import { compiler } from '@carta/compiler';
import { getDisplayName } from '@carta/domain';
import type { ConstructNodeData, ConstructSchema, Deployable, FieldSchema } from '@carta/domain';

interface ConstructFullViewModalProps {
  nodeId: string;
  data: ConstructNodeData;
  schemas: ConstructSchema[];
  deployables: Deployable[];
  onClose: () => void;
}

function FullViewFieldCell({ field, value, onCommit }: {
  field: FieldSchema;
  value: unknown;
  onCommit: (value: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isMultiline = field.displayHint === 'multiline' || field.displayHint === 'code';

  const formatValue = (v: unknown) => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'object') {
      if (Array.isArray(v)) return `${v.length} items`;
      return 'object';
    }
    return String(v);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') setEditing(false);
    if (e.key === 'Enter' && !isMultiline) (e.target as HTMLElement).blur();
  };

  if (editing) {
    return (
      <div className="flex gap-2 text-sm">
        <span className="text-content-subtle min-w-[100px] shrink-0">{field.label}</span>
        <div className="flex-1">
          {field.type === 'boolean' ? (
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => { onCommit(e.target.checked); setEditing(false); }}
              onKeyDown={handleKeyDown}
              className="w-4 h-4 cursor-pointer"
              autoFocus
            />
          ) : field.type === 'enum' && field.options ? (
            <select
              className="w-full px-1.5 py-0.5 bg-surface rounded text-sm text-content border border-accent/40 outline-none"
              value={String(value ?? '')}
              onChange={(e) => { onCommit(e.target.value); setEditing(false); }}
              onBlur={() => setEditing(false)}
              onKeyDown={handleKeyDown}
              autoFocus
            >
              <option value="">Select...</option>
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.value}</option>
              ))}
            </select>
          ) : isMultiline ? (
            <textarea
              className="w-full px-1.5 py-0.5 bg-surface rounded text-sm text-content border border-accent/40 outline-none resize-y min-h-[60px] font-mono text-xs"
              defaultValue={String(value ?? '')}
              onBlur={(e) => { onCommit(e.target.value); setEditing(false); }}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setEditing(false); }}
              placeholder={field.placeholder}
              autoFocus
            />
          ) : (
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              className="w-full px-1.5 py-0.5 bg-surface rounded text-sm text-content border border-accent/40 outline-none"
              defaultValue={String(value ?? '')}
              onBlur={(e) => { onCommit(field.type === 'number' ? Number(e.target.value) : e.target.value); setEditing(false); }}
              onKeyDown={handleKeyDown}
              placeholder={field.placeholder}
              autoFocus
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex gap-2 text-sm cursor-pointer hover:bg-surface-alt rounded px-1 -mx-1"
      onClick={() => setEditing(true)}
    >
      <span className="text-content-subtle min-w-[100px] shrink-0">{field.label}</span>
      {isMultiline ? (
        <span className="text-content break-words line-clamp-3 whitespace-pre-wrap">{formatValue(value)}</span>
      ) : field.type === 'boolean' ? (
        <span className="text-content">{value ? 'Yes' : 'No'}</span>
      ) : (
        <span className="text-content break-words">{formatValue(value)}</span>
      )}
    </div>
  );
}

export default function ConstructFullViewModal({
  nodeId,
  data,
  schemas,
  deployables,
  onClose,
}: ConstructFullViewModalProps) {
  const schema = schemas.find(s => s.type === data.constructType);
  const deployable = data.deployableId
    ? deployables.find(d => d.id === data.deployableId)
    : undefined;

  const displayName = schema ? getDisplayName(data, schema) : data.semanticId;

  // Single-construct compile preview
  const compilePreview = useMemo(() => {
    if (!schema) return 'Unknown schema';
    try {
      const fakeNode = {
        id: nodeId,
        type: 'construct' as const,
        position: { x: 0, y: 0 },
        data,
      };
      return compiler.compile(
        [fakeNode] as any,
        [],
        { schemas, deployables }
      );
    } catch {
      return 'Compilation error';
    }
  }, [nodeId, data, schema, schemas, deployables]);

  const handleFieldCommit = (fieldName: string, value: unknown) => {
    data.onValuesChange?.({ ...data.values, [fieldName]: value });
  };

  return (
    <DraggableWindow
      isOpen={true}
      onClose={onClose}
      title={displayName}
      subtitle={schema?.displayName}
      maxWidth="640px"
    >
      <div className="flex flex-col gap-3">
        {/* Fields — click-to-edit - Island */}
        {schema && schema.fields.length > 0 && (
          <section className="bg-surface-depth-2 rounded-xl p-4">
            <h3 className="m-0 mb-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Fields</h3>
            <div className="bg-surface-inset rounded-lg p-3 flex flex-col gap-1.5">
              {schema.fields.map((field) => (
                <FullViewFieldCell
                  key={field.name}
                  field={field}
                  value={data.values[field.name] ?? field.default}
                  onCommit={(val) => handleFieldCommit(field.name, val)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Deployable - Island */}
        {deployable && (
          <section className="bg-surface-depth-2 rounded-xl p-4">
            <h3 className="m-0 mb-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Deployable</h3>
            <div className="bg-surface-inset rounded-lg p-3 text-sm text-content">{deployable.name}</div>
          </section>
        )}

        {/* Identity - Island */}
        <section className="bg-surface-depth-2 rounded-xl p-4">
          <h3 className="m-0 mb-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Identity</h3>
          <div className="bg-surface-inset rounded-lg p-3 flex flex-col gap-1.5">
            <div className="flex gap-2 text-sm">
              <span className="text-content-subtle min-w-[100px] shrink-0">Semantic ID</span>
              <span className="text-content font-mono text-xs">{data.semanticId}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="text-content-subtle min-w-[100px] shrink-0">Technical ID</span>
              <span className="text-content-muted font-mono text-xs">{data.nodeId || nodeId}</span>
            </div>
          </div>
        </section>

        {/* Connections - Island */}
        {data.connections && data.connections.length > 0 && (
          <section className="bg-surface-depth-2 rounded-xl p-4">
            <h3 className="m-0 mb-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Connections</h3>
            <div className="bg-surface-inset rounded-lg p-3 flex flex-col gap-1 text-sm">
              {data.connections.map((c, i) => (
                <div key={i} className="flex gap-1 text-content-muted font-mono text-xs">
                  <span>{c.portId}</span>
                  <span className="text-content-subtle">→</span>
                  <span>{c.targetSemanticId}</span>
                  <span className="text-content-subtle">({c.targetPortId})</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Compile Preview - Island */}
        <section className="bg-surface-depth-2 rounded-xl p-4">
          <h3 className="m-0 mb-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Compile Preview</h3>
          <div className="bg-surface-inset rounded-lg p-3">
            <pre className="m-0 font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto text-content max-h-[200px] overflow-y-auto">
              {compilePreview}
            </pre>
          </div>
        </section>
      </div>
    </DraggableWindow>
  );
}
