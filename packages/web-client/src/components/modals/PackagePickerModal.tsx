import { useState } from 'react';
import Modal from '../ui/Modal.js';
import Button from '../ui/Button.js';
import SegmentedControl from '../ui/SegmentedControl.js';
import { usePackagePicker, type PackagePickerItem, type DocumentPackageItem } from '../../hooks/usePackagePicker.js';
import { Check } from '@phosphor-icons/react';
import type { ConstructSchema } from '@carta/domain';
import { computePackageDiff, type PackageDiff } from '@carta/domain';
import PackageDiffModal from './PackageDiffModal.js';
import { useDocumentContext } from '../../contexts/DocumentContext.js';

interface PackagePickerModalProps {
  onClose: () => void;
}

type PickerTab = 'library' | 'document';
const TAB_OPTIONS: { id: PickerTab; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'document', label: 'Document' },
];

interface PackageCardProps {
  item: PackagePickerItem;
  onLoad: (item: PackagePickerItem) => void;
  onRepair: (item: PackagePickerItem) => void;
  onViewChanges?: (packageId: string) => void;
}

function PackageCard({ item, onLoad, onRepair, onViewChanges }: PackageCardProps) {
  const { definition, status, schemaCount } = item;

  const handleRepair = () => {
    if (schemaCount > 0) {
      // Reset to library version — warn about orphaned fields
      const confirmed = window.confirm(
        'This will replace your customized schemas with the standard library versions. Instance data is preserved but custom fields will become orphaned.'
      );
      if (!confirmed) return;
    }
    onRepair(item);
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-3 flex items-start gap-3">
      <div
        className="w-3 h-3 rounded-full shrink-0 mt-0.5"
        style={{ backgroundColor: definition.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-content">{definition.name}</div>
        <div className="text-xs text-content-muted">{definition.description}</div>
        <div className="text-xs text-content-muted">{definition.schemas.length} schemas</div>
      </div>
      <div className="shrink-0 flex flex-col gap-1 items-end">
        {status === 'available' && (
          <Button size="sm" onClick={() => onLoad(item)}>
            Load
          </Button>
        )}
        {status === 'loaded' && (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <Check size={14} weight="bold" />
            <span>Loaded</span>
          </div>
        )}
        {status === 'modified' && schemaCount === 0 && (
          <Button size="sm" variant="accent" onClick={handleRepair}>
            Repair
          </Button>
        )}
        {status === 'modified' && schemaCount > 0 && (
          <>
            <button
              className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer bg-transparent border-none underline"
              onClick={() => onViewChanges?.(definition.id)}
            >
              View Changes
            </button>
            <Button size="sm" variant="danger" onClick={handleRepair}>
              Reset to Library
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function DocumentPackageCard({ item, onViewChanges }: { item: DocumentPackageItem; onViewChanges?: (id: string) => void }) {
  const { package: pkg, schemaCount, isLibraryOrigin, driftStatus } = item;

  return (
    <div className="bg-surface border border-border rounded-lg p-3 flex items-start gap-3">
      <div
        className="w-3 h-3 rounded-full shrink-0 mt-0.5"
        style={{ backgroundColor: pkg.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-content">{pkg.name}</span>
          {isLibraryOrigin && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-depth-1 text-content-muted">Library</span>
          )}
        </div>
        {pkg.description && (
          <div className="text-xs text-content-muted">{pkg.description}</div>
        )}
        <div className="text-xs text-content-muted">{schemaCount} schemas</div>
      </div>
      <div className="shrink-0 flex flex-col gap-1 items-end">
        {isLibraryOrigin && driftStatus === 'modified' && (
          <>
            <span className="text-xs text-amber-400">Modified</span>
            <button
              className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer bg-transparent border-none underline"
              onClick={() => onViewChanges?.(pkg.id)}
            >
              View Changes
            </button>
          </>
        )}
        {isLibraryOrigin && driftStatus === 'desync' && (
          <span className="text-xs text-red-400">Desync</span>
        )}
        {isLibraryOrigin && driftStatus === 'clean' && (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <Check size={14} weight="bold" />
          </div>
        )}
      </div>
    </div>
  );
}

function CreatePackageForm({ unpackagedSchemas, onCreate, onCancel }: {
  unpackagedSchemas: ConstructSchema[];
  onCreate: (name: string, color: string, description: string, schemaTypes?: string[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [description, setDescription] = useState('');
  const [selectedSchemas, setSelectedSchemas] = useState<Set<string>>(new Set());

  const toggleSchema = (type: string) => {
    setSelectedSchemas(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    const schemaTypes = selectedSchemas.size > 0 ? Array.from(selectedSchemas) : undefined;
    onCreate(name.trim(), color, description.trim(), schemaTypes);
  };

  return (
    <div className="bg-surface border border-accent/30 rounded-lg p-3 flex flex-col gap-2">
      <div className="text-sm font-medium text-content">New Package</div>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          className="w-6 h-6 p-0 border border-content-muted/20 rounded cursor-pointer"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <input
          type="text"
          className="flex-1 bg-surface-inset border border-border rounded px-2 py-1 text-sm text-content"
          placeholder="Package name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <textarea
        className="bg-surface-inset border border-border rounded px-2 py-1 text-xs text-content resize-none"
        placeholder="Description (optional)"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {unpackagedSchemas.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-content-muted">Include unpackaged schemas:</div>
          <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5">
            {unpackagedSchemas.map((s) => (
              <label key={s.type} className="flex items-center gap-2 text-xs text-content cursor-pointer hover:bg-surface-depth-1 px-1 py-0.5 rounded">
                <input
                  type="checkbox"
                  checked={selectedSchemas.has(s.type)}
                  onChange={() => toggleSchema(s.type)}
                />
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                {s.displayName}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" variant="accent" onClick={handleCreate} disabled={!name.trim()}>Create</Button>
      </div>
    </div>
  );
}

interface DocumentTabProps {
  packages: DocumentPackageItem[];
  unpackagedSchemas: ConstructSchema[];
  onCreatePackage: (name: string, color: string, description: string, schemaTypes?: string[]) => void;
  onViewChanges?: (id: string) => void;
}

function DocumentTab({ packages, unpackagedSchemas, onCreatePackage, onViewChanges }: DocumentTabProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {packages.length === 0 && !showCreateForm && (
        <div className="text-sm text-content-muted text-center py-4">
          No packages in this document yet.
        </div>
      )}
      {packages.map((item) => (
        <DocumentPackageCard key={item.package.id} item={item} onViewChanges={onViewChanges} />
      ))}
      {showCreateForm ? (
        <CreatePackageForm
          unpackagedSchemas={unpackagedSchemas}
          onCreate={(name, color, description, schemaTypes) => {
            onCreatePackage(name, color, description, schemaTypes);
            setShowCreateForm(false);
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      ) : (
        <button
          className="w-full py-2 text-sm text-content-muted hover:text-content border border-dashed border-border rounded-lg cursor-pointer bg-transparent transition-colors hover:border-content-muted"
          onClick={() => setShowCreateForm(true)}
        >
          + Create Package
        </button>
      )}
    </div>
  );
}

export default function PackagePickerModal({ onClose }: PackagePickerModalProps) {
  const { items, documentPackages, unpackagedSchemas, loadPackage, repairPackage, createPackage } = usePackagePicker();
  const { adapter } = useDocumentContext();
  const [activeTab, setActiveTab] = useState<PickerTab>('library');
  const [diffState, setDiffState] = useState<PackageDiff | null>(null);

  const handleLoad = (item: PackagePickerItem) => {
    loadPackage(item.definition);
    // State updates reactively via manifest subscription — no manual setState needed
  };

  const handleRepair = (item: PackagePickerItem) => {
    repairPackage(item.definition);
    // State updates reactively via manifest subscription — no manual setState needed
  };

  const handleViewChanges = (packageId: string) => {
    const diff = computePackageDiff(adapter, packageId);
    if (diff) setDiffState(diff);
  };

  const handleResetFromDiff = () => {
    if (!diffState) return;
    // Find the library definition by matching package name/color back to items
    const libraryItem = items.find(i => i.definition.name === diffState.packageName);
    if (libraryItem) {
      repairPackage(libraryItem.definition);
    }
  };

  return (
    <>
      <Modal isOpen={true} onClose={onClose} title="Schema Packages" maxWidth="520px">
        <div className="flex flex-col gap-3">
          <div className="flex justify-center">
            <SegmentedControl options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} />
          </div>
          {activeTab === 'library' && (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <PackageCard key={item.definition.id} item={item} onLoad={handleLoad} onRepair={handleRepair} onViewChanges={handleViewChanges} />
              ))}
            </div>
          )}
          {activeTab === 'document' && (
            <DocumentTab
              packages={documentPackages}
              unpackagedSchemas={unpackagedSchemas}
              onCreatePackage={createPackage}
              onViewChanges={handleViewChanges}
            />
          )}
        </div>
      </Modal>
      {diffState && (
        <PackageDiffModal
          diff={diffState}
          onClose={() => setDiffState(null)}
          onReset={handleResetFromDiff}
        />
      )}
    </>
  );
}
