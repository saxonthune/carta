import type { ConstructSchema } from '../constructs/types';
import { getPortsForSchema, getPortColor } from '../constructs/ports';

interface SchemaPreviewProps {
  schema: ConstructSchema;
}

export default function SchemaPreview({ schema }: SchemaPreviewProps) {
  const ports = getPortsForSchema(schema.ports);

  // Filter fields that show in collapsed state
  const collapsedFields = schema.fields.filter(f => f.showInMinimalDisplay);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="text-xs text-content-muted mb-2 uppercase tracking-wide">Preview</div>

      {/* Static node preview */}
      <div
        className="relative bg-surface border-[3px] rounded-lg min-w-[200px] max-w-[280px] text-content shadow-md"
        style={{ borderColor: schema.color || '#6366f1' }}
      >
        {/* Port indicators (just dots showing position) */}
        {ports.map((port) => {
          const style: React.CSSProperties = {
            position: 'absolute',
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: getPortColor(port.portType),
          };

          if (port.position === 'left') {
            style.left = -6;
            style.top = `${port.offset}%`;
            style.transform = 'translateY(-50%)';
          } else if (port.position === 'right') {
            style.right = -6;
            style.top = `${port.offset}%`;
            style.transform = 'translateY(-50%)';
          } else if (port.position === 'top') {
            style.top = -6;
            style.left = `${port.offset}%`;
            style.transform = 'translateX(-50%)';
          } else {
            style.bottom = -6;
            style.left = `${port.offset}%`;
            style.transform = 'translateX(-50%)';
          }

          return <div key={port.id} style={style} title={port.label} />;
        })}

        {/* Header */}
        <div
          className="flex items-center justify-center gap-1.5 px-2 py-1 text-white text-xs uppercase border-b border-white/20 font-semibold"
          style={{ backgroundColor: schema.color || '#6366f1' }}
        >
          {schema.displayName || 'New Construct'}
        </div>

        {/* ID section */}
        <div className="px-2 py-1 bg-surface">
          <div className="text-xs text-content-muted uppercase tracking-wide">ID</div>
          <div className="text-sm text-content font-medium">{schema.displayName ? `example-${schema.type}` : 'example-id'}</div>
        </div>

        {/* Collapsed fields preview */}
        {collapsedFields.length > 0 && (
          <div className="px-2 py-1.5 text-xs text-content-muted border-t">
            {collapsedFields.map((field) => (
              <div key={field.name} className="flex gap-1 justify-between">
                <span className="text-content-subtle">{field.label}:</span>
                <span className="text-content font-medium">{field.default?.toString() || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
