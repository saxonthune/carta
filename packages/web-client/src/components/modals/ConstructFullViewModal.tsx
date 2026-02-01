import { useMemo } from 'react';
import DraggableWindow from '../ui/DraggableWindow';
import { compiler } from '@carta/compiler';
import { getDisplayName } from '@carta/domain';
import type { ConstructNodeData, ConstructSchema, Deployable } from '@carta/domain';

interface ConstructFullViewModalProps {
  nodeId: string;
  data: ConstructNodeData;
  schemas: ConstructSchema[];
  deployables: Deployable[];
  onClose: () => void;
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

  return (
    <DraggableWindow
      isOpen={true}
      onClose={onClose}
      title={displayName}
      subtitle={schema?.displayName}
      maxWidth="640px"
    >
      <div className="flex flex-col gap-3">
        {/* Fields (read-only) - Island */}
        {schema && schema.fields.length > 0 && (
          <section className="bg-surface-depth-2 rounded-xl p-4">
            <h3 className="m-0 mb-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Fields</h3>
            <div className="bg-surface-inset rounded-lg p-3 flex flex-col gap-1.5">
              {schema.fields.map((field) => {
                const val = data.values[field.name] ?? field.default;
                return (
                  <div key={field.name} className="flex gap-2 text-sm">
                    <span className="text-content-subtle min-w-[100px] shrink-0">{field.label}</span>
                    <span className="text-content break-words">
                      {val === null || val === undefined || val === '' ? '—' : String(val)}
                    </span>
                  </div>
                );
              })}
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
