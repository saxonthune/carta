import { getPortsForSchema, getPortColor } from '@carta/schema';
import type { ConstructSchema, FieldSchema, DisplayTier } from '@carta/schema';

interface EditorPreviewProps {
  schema: ConstructSchema;
  fieldAssignments: Map<string, { tier: DisplayTier | undefined; order: number }>;
}

function getFieldsForPreviewTier(
  schema: ConstructSchema,
  assignments: Map<string, { tier: DisplayTier | undefined; order: number }>,
  tiers: (DisplayTier | undefined)[]
): FieldSchema[] {
  return schema.fields
    .filter((f) => {
      const assignment = assignments.get(f.name);
      return assignment && tiers.includes(assignment.tier);
    })
    .sort((a, b) => {
      const aOrder = assignments.get(a.name)?.order ?? 0;
      const bOrder = assignments.get(b.name)?.order ?? 0;
      return aOrder - bOrder;
    });
}

function getPillFieldValue(
  schema: ConstructSchema,
  assignments: Map<string, { tier: DisplayTier | undefined; order: number }>
): string {
  const pillField = schema.fields.find((f) => assignments.get(f.name)?.tier === 'pill');
  if (pillField) {
    return pillField.default ? String(pillField.default) : pillField.placeholder || pillField.label;
  }
  return `example-${schema.type || 'id'}`;
}

/** Simple row of colored circles at bottom representing ports */
function PortRow({ schema }: { schema: ConstructSchema }) {
  const ports = getPortsForSchema(schema.ports);
  if (ports.length === 0) return null;

  return (
    <div className="flex gap-1 justify-center py-1 border-t border-surface-alt">
      {ports.map((port) => (
        <div
          key={port.id}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: getPortColor(port.portType) }}
          title={port.label}
        />
      ))}
    </div>
  );
}

function PreviewWrapper({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-content-muted uppercase tracking-wide mb-1.5">{label}</div>
      <div className="flex justify-center px-3">
        {children}
      </div>
    </div>
  );
}

export default function EditorPreview({ schema, fieldAssignments }: EditorPreviewProps) {
  const pillValue = getPillFieldValue(schema, fieldAssignments);
  const color = schema.color || '#6366f1';
  const summaryFields = getFieldsForPreviewTier(schema, fieldAssignments, ['pill', 'summary']);

  return (
    <div className="flex flex-col justify-between h-full w-full">
      {/* Pill */}
      <PreviewWrapper label="Pill">
        <div
          className="rounded-lg text-white text-halo font-bold px-3 py-1.5 truncate text-sm"
          style={{ backgroundColor: color }}
        >
          <span className="opacity-70">{schema.displayName || 'Schema'}:</span> {pillValue}
        </div>
      </PreviewWrapper>

      {/* Summary */}
      <PreviewWrapper label="Summary (Canvas)">
        <div className="relative bg-surface rounded-lg text-xs overflow-hidden" style={{ borderLeft: `2px solid ${color}`, boxShadow: 'var(--node-shadow)' }}>
          <div
            className="px-2 py-1 text-[10px] font-medium text-content-muted bg-surface-alt rounded-t-lg"
          >
            {schema.displayName || 'Schema'}
          </div>
          <div className="px-2 py-1.5">
            <div className="font-semibold text-content truncate mb-1">{pillValue}</div>
            {summaryFields.length === 0 ? (
              <div className="text-content-subtle italic text-[10px]">No summary fields</div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {summaryFields.filter(f => f.displayTier !== 'pill').map((field) => (
                  <div key={field.name} className="flex gap-1 items-baseline">
                    <span className="text-content-subtle text-[10px] shrink-0">{field.label}:</span>
                    <span className="text-content font-medium text-[10px] truncate">
                      {field.default ? String(field.default) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <PortRow schema={schema} />
        </div>
      </PreviewWrapper>
    </div>
  );
}
