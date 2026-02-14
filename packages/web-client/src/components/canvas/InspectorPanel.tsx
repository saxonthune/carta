import { useCallback, useMemo } from 'react';
import type { Node } from '@xyflow/react';
import type { ConstructNodeData, ConstructSchema } from '@carta/domain';
import { getDisplayName } from '@carta/domain';
import { compiler } from '@carta/compiler';
import { CloseIcon } from '../ui/icons';
import { fieldRenderers } from '../fields';

interface InspectorPanelProps {
  node: Node | null;
  schemas: ConstructSchema[];
  onNodeUpdate: (nodeId: string, updates: Partial<ConstructNodeData>) => void;
  onClose: () => void;
}

export default function InspectorPanel({
  node,
  schemas,
  onNodeUpdate,
  onClose,
}: InspectorPanelProps) {
  // If no node selected or not a construct node, hide the panel
  if (!node || node.type !== 'construct') {
    return null;
  }

  const data = node.data as ConstructNodeData;
  const schema = schemas.find(s => s.type === data.constructType);

  if (!schema) {
    return null;
  }

  const displayName = getDisplayName(data, schema);

  // Handle field value changes
  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    const newValues = { ...data.values, [fieldName]: value };
    onNodeUpdate(node.id, { values: newValues });
  }, [node.id, data.values, onNodeUpdate]);

  // Single-construct compile preview
  const compilePreview = useMemo(() => {
    try {
      const fakeNode = {
        id: node.id,
        type: 'construct' as const,
        position: { x: 0, y: 0 },
        data,
      };
      return compiler.compile(
        [fakeNode] as any,
        [],
        { schemas }
      );
    } catch {
      return 'Compilation error';
    }
  }, [node.id, data, schemas]);

  return (
    <div
      className="h-full bg-surface border-l border-border flex flex-col flex-shrink-0"
      style={{ width: 360 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: schema.color }}
          />
          <h2 className="text-sm font-medium text-content truncate">{displayName}</h2>
          <span className="text-xs text-content-muted flex-shrink-0">{schema.displayName}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-surface-alt flex-shrink-0"
          title="Close"
        >
          <CloseIcon className="w-4 h-4 text-content-muted" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {/* Section 1: Fields */}
        {schema.fields.length > 0 && (
          <section className="bg-surface-depth-2 rounded-xl p-3">
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
          </section>
        )}

        {/* Section 2: Identity */}
        <section className="bg-surface-depth-2 rounded-xl p-3">
          <h3 className="text-xs font-semibold text-content-muted uppercase mb-3">Identity</h3>
          <div className="bg-surface-inset rounded-lg p-3 flex flex-col gap-1.5">
            <div className="flex gap-2 text-sm">
              <span className="text-content-subtle min-w-[100px] shrink-0">Semantic ID</span>
              <span className="text-content font-mono text-xs">{data.semanticId}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="text-content-subtle min-w-[100px] shrink-0">Type</span>
              <span className="text-content font-mono text-xs">{data.constructType}</span>
            </div>
          </div>
        </section>

        {/* Section 3: Connections */}
        {data.connections && data.connections.length > 0 && (
          <section className="bg-surface-depth-2 rounded-xl p-3">
            <h3 className="text-xs font-semibold text-content-muted uppercase mb-3">Connections</h3>
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

        {/* Section 4: Compile Preview */}
        <section className="bg-surface-depth-2 rounded-xl p-3">
          <h3 className="text-xs font-semibold text-content-muted uppercase mb-3">Compile Preview</h3>
          <div className="bg-surface-inset rounded-lg p-3">
            <pre className="m-0 font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto text-content max-h-[200px] overflow-y-auto">
              {compilePreview}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
