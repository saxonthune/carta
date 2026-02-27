import { useState } from 'react';
import Modal from '../ui/Modal.js';
import Button from '../ui/Button.js';
import SegmentedControl from '../ui/SegmentedControl.js';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import type { PackageDiff, SchemaDiff, GroupDiff, RelationshipDiff } from '@carta/schema';

interface PackageDiffModalProps {
  diff: PackageDiff;
  libraryDiff?: PackageDiff;
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

type DiffMode = 'local' | 'library';
const DIFF_MODE_OPTIONS: { id: DiffMode; label: string }[] = [
  { id: 'local', label: 'Your Changes' },
  { id: 'library', label: 'Library Update' },
];

export default function PackageDiffModal({ diff, libraryDiff, onClose, onReset }: PackageDiffModalProps) {
  const [diffMode, setDiffMode] = useState<DiffMode>(libraryDiff ? 'library' : 'local');
  const activeDiff = diffMode === 'library' && libraryDiff ? libraryDiff : diff;

  const handleReset = () => {
    const message = diffMode === 'library'
      ? 'This will update all schemas in this package to the latest library versions. Instance data is preserved but custom fields will become orphaned.'
      : 'This will replace all schemas in this package with the standard library versions. Instance data is preserved but custom fields will become orphaned.';
    const confirmed = window.confirm(message);
    if (!confirmed) return;
    onReset();
    onClose();
  };

  const buttonLabel = diffMode === 'library' ? 'Update to Library Version' : 'Reset to Library';

  return (
    <Modal isOpen={true} onClose={onClose} title={`${activeDiff.packageName} — Changes`} maxWidth="480px">
      <div className="flex flex-col gap-3">
        {/* Mode toggle */}
        {libraryDiff && (
          <div className="flex justify-center">
            <SegmentedControl options={DIFF_MODE_OPTIONS} value={diffMode} onChange={setDiffMode} />
          </div>
        )}
        {/* Summary */}
        <div className="text-sm text-content-muted">
          {activeDiff.summary.added > 0 && <span className="text-green-400">{activeDiff.summary.added} added</span>}
          {activeDiff.summary.added > 0 && (activeDiff.summary.removed > 0 || activeDiff.summary.modified > 0) && ', '}
          {activeDiff.summary.removed > 0 && <span className="text-red-400">{activeDiff.summary.removed} removed</span>}
          {activeDiff.summary.removed > 0 && activeDiff.summary.modified > 0 && ', '}
          {activeDiff.summary.modified > 0 && <span className="text-amber-400">{activeDiff.summary.modified} modified</span>}
          {activeDiff.summary.added === 0 && activeDiff.summary.removed === 0 && activeDiff.summary.modified === 0 && (
            <span>No schema changes detected</span>
          )}
        </div>

        {/* Schema diffs */}
        {activeDiff.schemas.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium text-content-muted uppercase">Schemas</div>
            {activeDiff.schemas.map((sd) => (
              <SchemaDiffRow key={sd.type} diff={sd} />
            ))}
          </div>
        )}

        {/* Port schema diffs */}
        {activeDiff.portSchemas.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium text-content-muted uppercase">Port Schemas</div>
            {activeDiff.portSchemas.map((pd) => (
              <div key={pd.id} className="flex items-center gap-2 border border-border rounded px-2 py-1.5">
                <span className="text-sm text-content">{pd.displayName}</span>
                <StatusBadge status={pd.status} />
              </div>
            ))}
          </div>
        )}

        {/* Group diffs */}
        {activeDiff.groups && activeDiff.groups.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium text-content-muted uppercase">Groups</div>
            {activeDiff.groups.map((gd: GroupDiff) => (
              <div key={gd.name} className="flex items-center gap-2 border border-border rounded px-2 py-1.5">
                <span className="text-sm text-content">{gd.name}</span>
                <StatusBadge status={gd.status} />
                {gd.detail && <span className="text-xs text-content-muted italic">{gd.detail}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Relationship diffs */}
        {activeDiff.relationships && activeDiff.relationships.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium text-content-muted uppercase">Relationships</div>
            {activeDiff.relationships.map((rd: RelationshipDiff) => (
              <div key={`${rd.sourceSchemaType}-${rd.targetSchemaType}`} className="flex items-center gap-2 border border-border rounded px-2 py-1.5">
                <span className="text-sm text-content">{rd.sourceSchemaType} → {rd.targetSchemaType}</span>
                <StatusBadge status={rd.status} />
                {rd.detail && <span className="text-xs text-content-muted italic">{rd.detail}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border">
          <Button size="sm" variant="danger" onClick={handleReset}>
            {buttonLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
