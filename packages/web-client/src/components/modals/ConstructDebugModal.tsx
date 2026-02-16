import { useMemo } from 'react';
import type { CartaNode } from '@carta/types';
import Modal from '../ui/Modal';
import { compiler } from '@carta/compiler';
import { getDisplayName } from '@carta/domain';
import type { ConstructNodeData, ConstructSchema } from '@carta/domain';

interface ConstructDebugModalProps {
  node: CartaNode;
  schema: ConstructSchema | undefined;
  onClose: () => void;
}

export default function ConstructDebugModal({
  node,
  schema,
  onClose,
}: ConstructDebugModalProps) {
  const data = node.data as ConstructNodeData;
  const displayName = schema ? getDisplayName(data, schema) : data.semanticId;

  // Single-construct compile preview
  const compilePreview = useMemo(() => {
    if (!schema) return 'Unknown schema';
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
        { schemas: [schema] }
      );
    } catch {
      return 'Compilation error';
    }
  }, [node.id, data, schema]);

  // Strip functions from node data for JSON serialization
  const sanitizedNode = useMemo(() => {
    const cleaned = { ...node };
    if (cleaned.data) {
      const cleanedData: any = {};
      for (const [key, value] of Object.entries(cleaned.data)) {
        if (typeof value !== 'function') {
          cleanedData[key] = value;
        }
      }
      cleaned.data = cleanedData;
    }
    return cleaned;
  }, [node]);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Debug: ${displayName}`}
      maxWidth="720px"
    >
      <div className="flex flex-col gap-3">
        {/* Identity - Island */}
        <section className="bg-surface-depth-2 rounded-xl p-4">
          <h3 className="m-0 mb-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Identity</h3>
          <div className="bg-surface-inset rounded-lg p-3 flex flex-col gap-1.5">
            <div className="flex gap-2 text-sm">
              <span className="text-content-subtle min-w-[120px] shrink-0">Semantic ID</span>
              <span className="text-content font-mono text-xs break-all">{data.semanticId}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="text-content-subtle min-w-[120px] shrink-0">Technical ID</span>
              <span className="text-content font-mono text-xs break-all">{node.id}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="text-content-subtle min-w-[120px] shrink-0">Construct Type</span>
              <span className="text-content font-mono text-xs break-all">{data.constructType}</span>
            </div>
            {schema && (
              <div className="flex gap-2 text-sm">
                <span className="text-content-subtle min-w-[120px] shrink-0">Schema Display Name</span>
                <span className="text-content font-mono text-xs break-all">{schema.displayName}</span>
              </div>
            )}
          </div>
        </section>

        {/* Field Values - Island */}
        {schema && schema.fields.length > 0 && (
          <section className="bg-surface-depth-2 rounded-xl p-4">
            <h3 className="m-0 mb-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Field Values</h3>
            <div className="bg-surface-inset rounded-lg p-3 flex flex-col gap-1.5">
              {schema.fields.map((field) => {
                const value = data.values[field.name] ?? field.default;
                let displayValue: string;
                if (value === null || value === undefined || value === '') {
                  displayValue = '—';
                } else if (typeof value === 'object') {
                  displayValue = JSON.stringify(value);
                } else {
                  displayValue = String(value);
                }
                return (
                  <div key={field.name} className="flex gap-2 text-sm">
                    <span className="text-content-subtle min-w-[120px] shrink-0">{field.label}</span>
                    <span className="text-content font-mono text-xs break-all">{displayValue}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Schema Info - Island */}
        {schema && (
          <section className="bg-surface-depth-2 rounded-xl p-4">
            <h3 className="m-0 mb-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Schema Info</h3>
            <div className="bg-surface-inset rounded-lg p-3 flex flex-col gap-1.5">
              <div className="flex gap-2 text-sm">
                <span className="text-content-subtle min-w-[120px] shrink-0">Type</span>
                <span className="text-content font-mono text-xs break-all">{schema.type}</span>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="text-content-subtle min-w-[120px] shrink-0">Display Name</span>
                <span className="text-content font-mono text-xs break-all">{schema.displayName}</span>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="text-content-subtle min-w-[120px] shrink-0">Color</span>
                <span className="text-content font-mono text-xs break-all">{schema.color}</span>
              </div>
              {schema.nodeShape && (
                <div className="flex gap-2 text-sm">
                  <span className="text-content-subtle min-w-[120px] shrink-0">Render Style</span>
                  <span className="text-content font-mono text-xs break-all">{schema.nodeShape}</span>
                </div>
              )}
              {schema.backgroundColorPolicy && (
                <div className="flex gap-2 text-sm">
                  <span className="text-content-subtle min-w-[120px] shrink-0">Background Color Policy</span>
                  <span className="text-content font-mono text-xs break-all">{schema.backgroundColorPolicy}</span>
                </div>
              )}
              {schema.colorMode && (
                <div className="flex gap-2 text-sm">
                  <span className="text-content-subtle min-w-[120px] shrink-0">Color Mode</span>
                  <span className="text-content font-mono text-xs break-all">{schema.colorMode}</span>
                </div>
              )}
              {schema.groupId && (
                <div className="flex gap-2 text-sm">
                  <span className="text-content-subtle min-w-[120px] shrink-0">Group ID</span>
                  <span className="text-content font-mono text-xs break-all">{schema.groupId}</span>
                </div>
              )}
              <div className="flex gap-2 text-sm">
                <span className="text-content-subtle min-w-[120px] shrink-0">Field Count</span>
                <span className="text-content font-mono text-xs break-all">{schema.fields.length}</span>
              </div>
              {schema.ports && schema.ports.length > 0 && (
                <div className="flex gap-2 text-sm">
                  <span className="text-content-subtle min-w-[120px] shrink-0">Ports</span>
                  <span className="text-content font-mono text-xs break-all">
                    {schema.ports.map(p => `${p.label} (${p.portType})`).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Visual State - Island */}
        <section className="bg-surface-depth-2 rounded-xl p-4">
          <h3 className="m-0 mb-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Visual State</h3>
          <div className="bg-surface-inset rounded-lg p-3 flex flex-col gap-1.5">
            {data.instanceColor && (
              <div className="flex gap-2 text-sm">
                <span className="text-content-subtle min-w-[120px] shrink-0">Instance Color</span>
                <span className="text-content font-mono text-xs break-all">{data.instanceColor}</span>
              </div>
            )}
            <div className="flex gap-2 text-sm">
              <span className="text-content-subtle min-w-[120px] shrink-0">Position</span>
              <span className="text-content font-mono text-xs break-all">
                x: {node.position.x.toFixed(2)}, y: {node.position.y.toFixed(2)}
              </span>
            </div>
            {node.measured && (
              <div className="flex gap-2 text-sm">
                <span className="text-content-subtle min-w-[120px] shrink-0">Measured Size</span>
                <span className="text-content font-mono text-xs break-all">
                  {node.measured.width}px × {node.measured.height}px
                </span>
              </div>
            )}
            {node.parentId && (
              <div className="flex gap-2 text-sm">
                <span className="text-content-subtle min-w-[120px] shrink-0">Parent ID (Organizer)</span>
                <span className="text-content font-mono text-xs break-all">{node.parentId}</span>
              </div>
            )}
            <div className="flex gap-2 text-sm">
              <span className="text-content-subtle min-w-[120px] shrink-0">Selected</span>
              <span className="text-content font-mono text-xs break-all">{String(node.selected ?? false)}</span>
            </div>
          </div>
        </section>

        {/* Connections & References - Island */}
        {(data.connections?.length || data.references?.length || data.referencedBy?.length || data.organizedMembers?.length || data.organizedIn) && (
          <section className="bg-surface-depth-2 rounded-xl p-4">
            <h3 className="m-0 mb-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Connections & References</h3>
            <div className="bg-surface-inset rounded-lg p-3 flex flex-col gap-1.5">
              {data.connections && data.connections.length > 0 && (
                <div className="flex gap-2 text-sm">
                  <span className="text-content-subtle min-w-[120px] shrink-0">Connections</span>
                  <div className="flex flex-col gap-0.5">
                    {data.connections.map((c, i) => (
                      <span key={i} className="text-content font-mono text-xs break-all">
                        {c.portId} → {c.targetSemanticId}:{c.targetPortId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {data.references && data.references.length > 0 && (
                <div className="flex gap-2 text-sm">
                  <span className="text-content-subtle min-w-[120px] shrink-0">References</span>
                  <span className="text-content font-mono text-xs break-all">{data.references.join(', ')}</span>
                </div>
              )}
              {data.referencedBy && data.referencedBy.length > 0 && (
                <div className="flex gap-2 text-sm">
                  <span className="text-content-subtle min-w-[120px] shrink-0">Referenced By</span>
                  <span className="text-content font-mono text-xs break-all">{data.referencedBy.join(', ')}</span>
                </div>
              )}
              {data.organizedMembers && data.organizedMembers.length > 0 && (
                <div className="flex gap-2 text-sm">
                  <span className="text-content-subtle min-w-[120px] shrink-0">Organized Members</span>
                  <span className="text-content font-mono text-xs break-all">{data.organizedMembers.join(', ')}</span>
                </div>
              )}
              {data.organizedIn && (
                <div className="flex gap-2 text-sm">
                  <span className="text-content-subtle min-w-[120px] shrink-0">Organized In</span>
                  <span className="text-content font-mono text-xs break-all">{data.organizedIn}</span>
                </div>
              )}
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

        {/* Raw JSON - Island */}
        <section className="bg-surface-depth-2 rounded-xl p-4">
          <h3 className="m-0 mb-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Raw JSON</h3>
          <div className="bg-surface-inset rounded-lg p-3">
            <details>
              <summary className="cursor-pointer text-sm text-content-subtle hover:text-content">Show raw node data</summary>
              <pre className="m-0 mt-2 font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto text-content max-h-[400px] overflow-y-auto">
                {JSON.stringify(sanitizedNode, null, 2)}
              </pre>
            </details>
          </div>
        </section>
      </div>
    </Modal>
  );
}
