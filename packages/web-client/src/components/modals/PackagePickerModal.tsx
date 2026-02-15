import Modal from '../ui/Modal.js';
import Button from '../ui/Button.js';
import { usePackagePicker, type PackagePickerItem } from '../../hooks/usePackagePicker.js';
import { Check } from '@phosphor-icons/react';

interface PackagePickerModalProps {
  onClose: () => void;
}

interface PackageCardProps {
  item: PackagePickerItem;
  onLoad: (item: PackagePickerItem) => void;
}

function PackageCard({ item, onLoad }: PackageCardProps) {
  const { definition, status } = item;

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
      <div className="shrink-0">
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
        {status === 'modified' && (
          <div className="text-xs text-amber-400">Modified</div>
        )}
      </div>
    </div>
  );
}

export default function PackagePickerModal({ onClose }: PackagePickerModalProps) {
  const { items, loadPackage } = usePackagePicker();

  const handleLoad = (item: PackagePickerItem) => {
    loadPackage(item.definition);
    // State updates reactively via manifest subscription — no manual setState needed
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Schema Packages" maxWidth="520px">
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <PackageCard key={item.definition.id} item={item} onLoad={handleLoad} />
        ))}
      </div>
    </Modal>
  );
}
