import { useEffect, useRef } from 'react';
import type { ConstructSchema, SuggestedRelatedConstruct } from '@carta/schema';

const STRUCTURAL_PORT_TYPES = new Set(['parent', 'child', 'flow-in', 'flow-out']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RelationshipKey = any;

interface EdgeDetailPopoverProps {
  sourceSchema: ConstructSchema;
  targetSchema: ConstructSchema;
  relationship: SuggestedRelatedConstruct;
  relationshipIndex: RelationshipKey;
  position: { x: number; y: number };
  onUpdate: (index: RelationshipKey, updates: Partial<SuggestedRelatedConstruct>) => void;
  onDelete: (index: RelationshipKey) => void;
  onClose: () => void;
}

function classifyPort(portType: string | undefined): 'structural' | 'semantic' {
  if (!portType) return 'semantic';
  return STRUCTURAL_PORT_TYPES.has(portType) ? 'structural' : 'semantic';
}

export default function EdgeDetailPopover({
  sourceSchema,
  targetSchema,
  relationship,
  relationshipIndex,
  position,
  onUpdate,
  onDelete,
  onClose,
}: EdgeDetailPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const fromPort = sourceSchema.ports?.find(p => p.id === relationship.fromPortId);
  const toPort = targetSchema.ports?.find(p => p.id === relationship.toPortId);

  const fromClassification = classifyPort(fromPort?.portType);
  const toClassification = classifyPort(toPort?.portType);
  const classification = fromClassification === 'structural' && toClassification === 'structural'
    ? 'structural' : 'semantic';

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-surface-elevated border border-border rounded-lg shadow-lg p-3 min-w-[240px] max-w-[320px]"
      style={{ left: position.x, top: position.y }}
    >
      {/* Schema names */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: sourceSchema.color }}
        />
        <span className="text-node-sm font-medium text-content truncate">{sourceSchema.displayName}</span>
        <span className="text-content-subtle text-node-xs">→</span>
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: targetSchema.color }}
        />
        <span className="text-node-sm font-medium text-content truncate">{targetSchema.displayName}</span>
      </div>

      {/* Port info */}
      <div className="flex gap-3 mb-2 text-node-xs text-content-muted">
        {fromPort && (
          <span>from: <span className="text-content">{fromPort.label}</span></span>
        )}
        {toPort && (
          <span>to: <span className="text-content">{toPort.label}</span></span>
        )}
      </div>

      {/* Classification tag */}
      <div className="mb-2">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
          classification === 'structural'
            ? 'bg-content-muted/10 text-content-muted'
            : 'bg-accent/10 text-accent'
        }`}>
          {classification}
        </span>
      </div>

      {/* Editable label */}
      <div className="mb-3">
        <label className="text-node-xs text-content-muted block mb-0.5">Label</label>
        <input
          ref={inputRef}
          type="text"
          className="w-full px-2 py-1 bg-surface rounded text-node-sm text-content border border-content-muted/20 outline-none focus:border-accent/40"
          defaultValue={relationship.label || ''}
          onBlur={(e) => {
            const newLabel = e.target.value.trim();
            if (newLabel !== (relationship.label || '')) {
              onUpdate(relationshipIndex, { label: newLabel || undefined });
            }
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') {
              onClose();
            }
          }}
          placeholder="Relationship label..."
        />
      </div>

      {/* Delete button */}
      <button
        type="button"
        className="w-full px-3 py-1.5 text-node-sm text-danger bg-danger-muted/30 hover:bg-danger-muted/50 rounded border border-danger/20 cursor-pointer transition-colors"
        onClick={() => onDelete(relationshipIndex)}
      >
        Delete relationship
      </button>
    </div>
  );
}
