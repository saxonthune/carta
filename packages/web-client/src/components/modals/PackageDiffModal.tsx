import { useState } from 'react';
import Modal from '../ui/Modal.js';
import Button from '../ui/Button.js';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import type { PackageDiff, SchemaDiff } from '@carta/domain';

interface PackageDiffModalProps {
  diff: PackageDiff;
  onClose: () => void;
  onReset: () => void;
}

function StatusBadge({ status }: { status: 'added' | 'removed' | 'modified' }) {
  const colors = {
    added: 'text-green-400 bg-green-400/10',
    removed: 'text-red-400 bg-red-400/10',
    modified: 'text-amber-400 bg-amber-400/10',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[status]}`}>
      {status}
    </span>
  );
}

function SchemaDiffRow({ diff }: { diff: SchemaDiff }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = diff.status === 'modified' && diff.fieldChanges && diff.fieldChanges.length > 0;

  return (
    <div className="border border-border rounded px-2 py-1.5">
      <div
        className={`flex items-center gap-2 ${hasDetails ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {hasDetails && (expanded ? <CaretDown size={12} /> : <CaretRight size={12} />)}
        <span className="text-sm text-content">{diff.displayName}</span>
        <span className="text-xs text-content-muted">({diff.type})</span>
        <StatusBadge status={diff.status} />
      </div>
      {expanded && diff.fieldChanges && (
        <div className="mt-1.5 ml-5 flex flex-col gap-0.5">
          {diff.fieldChanges.map((fc) => (
            <div key={fc.fieldName} className="flex items-center gap-2 text-xs">
              <StatusBadge status={fc.status} />
              <span className="text-content-muted">{fc.fieldName}</span>
              {fc.detail && <span className="text-content-muted italic">{fc.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PackageDiffModal({ diff, onClose, onReset }: PackageDiffModalProps) {
  const handleReset = () => {
    const confirmed = window.confirm(
      'This will replace all schemas in this package with the standard library versions. Instance data is preserved but custom fields will become orphaned.'
    );
    if (!confirmed) return;
    onReset();
    onClose();
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`${diff.packageName} — Changes`} maxWidth="480px">
      <div className="flex flex-col gap-3">
        {/* Summary */}
        <div className="text-sm text-content-muted">
          {diff.summary.added > 0 && <span className="text-green-400">{diff.summary.added} added</span>}
          {diff.summary.added > 0 && (diff.summary.removed > 0 || diff.summary.modified > 0) && ', '}
          {diff.summary.removed > 0 && <span className="text-red-400">{diff.summary.removed} removed</span>}
          {diff.summary.removed > 0 && diff.summary.modified > 0 && ', '}
          {diff.summary.modified > 0 && <span className="text-amber-400">{diff.summary.modified} modified</span>}
          {diff.summary.added === 0 && diff.summary.removed === 0 && diff.summary.modified === 0 && (
            <span>No schema changes detected</span>
          )}
        </div>

        {/* Schema diffs */}
        {diff.schemas.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium text-content-muted uppercase">Schemas</div>
            {diff.schemas.map((sd) => (
              <SchemaDiffRow key={sd.type} diff={sd} />
            ))}
          </div>
        )}

        {/* Port schema diffs */}
        {diff.portSchemas.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium text-content-muted uppercase">Port Schemas</div>
            {diff.portSchemas.map((pd) => (
              <div key={pd.id} className="flex items-center gap-2 border border-border rounded px-2 py-1.5">
                <span className="text-sm text-content">{pd.displayName}</span>
                <StatusBadge status={pd.status} />
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border">
          <Button size="sm" variant="danger" onClick={handleReset}>
            Reset to Library
          </Button>
        </div>
      </div>
    </Modal>
  );
}
