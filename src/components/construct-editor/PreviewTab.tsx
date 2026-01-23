import { useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import ConstructNode from '../ConstructNode';
import type { ConstructSchema, ConstructNodeData } from '../../constructs/types';

interface PreviewTabProps {
  formData: ConstructSchema;
}

export default function PreviewTab({ formData }: PreviewTabProps) {
  // Mock node data for preview
  const mockNodeData: ConstructNodeData = useMemo(() => ({
    constructType: formData.type || 'preview',
    semanticId: `${formData.type || 'preview'}-sample`,
    values: formData.fields.reduce((acc, f) => ({ ...acc, [f.name]: f.default || '' }), {}),
    connections: [],
    deployableId: null,
    isExpanded: true,
  }), [formData.type, formData.fields]);

  // Generate compiled preview
  const compiledPreview = useMemo(() => {
    if (!formData.type) return 'No type defined yet';

    const sampleData = {
      id: `${formData.type}-sample`,
      type: formData.type,
      ...formData.fields.reduce((acc, f) => ({ ...acc, [f.name]: f.default || `sample_${f.name}` }), {}),
    };

    if (formData.ports && formData.ports.length > 0) {
      Object.assign(sampleData, {
        ports: formData.ports.map(p => ({
          id: p.id,
          portType: p.portType,
          label: p.label,
        })),
      });
    }

    return JSON.stringify(sampleData, null, 2);
  }, [formData.type, formData.fields, formData.ports]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="bg-surface-elevated rounded-lg p-4">
        <h3 className="m-0 mb-3 text-sm font-semibold text-content-muted uppercase tracking-wide">Node Preview</h3>
        <div className="flex items-center justify-center p-4 bg-surface-depth-3 rounded-lg min-h-[200px]">
          {formData.type ? (
            <ReactFlowProvider>
              <div style={{ width: '300px', height: 'auto' }}>
                <ConstructNode
                  data={mockNodeData}
                  selected={false}
                />
              </div>
            </ReactFlowProvider>
          ) : (
            <p className="text-content-muted text-sm italic">Define a type to preview the node</p>
          )}
        </div>
      </div>

      <div className="bg-surface-elevated rounded-lg p-4 flex-1 flex flex-col min-h-0">
        <h3 className="m-0 mb-3 text-sm font-semibold text-content-muted uppercase tracking-wide">Compiled Output Preview</h3>
        <div className="flex-1 overflow-y-auto min-h-0">
          <pre className="bg-surface p-3 rounded-lg text-xs text-content overflow-x-auto">
            <code>{compiledPreview}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
