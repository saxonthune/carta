import { useEffect, useRef, useCallback } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import type { ConstructSchema } from '@carta/domain';

interface MetamapFilterProps {
  schemas: ConstructSchema[];
  filterText: string;
  onFilterChange: (text: string) => void;
  onClose: () => void;
  onSelect: (schemaType: string) => void;
  matchCount: number;
}

export default function MetamapFilter({
  schemas,
  filterText,
  onFilterChange,
  onClose,
  onSelect,
  matchCount,
}: MetamapFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && matchCount === 1) {
        const q = filterText.toLowerCase();
        const match = schemas.find(
          s => s.displayName.toLowerCase().includes(q) || s.type.toLowerCase().includes(q)
        );
        if (match) onSelect(match.type);
      }
    },
    [onClose, onSelect, matchCount, filterText, schemas]
  );

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-surface rounded-lg px-3 py-2"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)' }}
    >
      <MagnifyingGlass weight="bold" size={16} className="text-content-subtle shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={filterText}
        onChange={e => onFilterChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Filter schemas..."
        className="bg-transparent border-none outline-none text-content text-sm w-48 placeholder:text-content-subtle"
      />
      {filterText.trim() && (
        <span className="text-[10px] font-medium text-content-subtle bg-surface-alt px-1.5 py-0.5 rounded shrink-0">
          {matchCount} match{matchCount !== 1 ? 'es' : ''}
        </span>
      )}
      <button
        onClick={onClose}
        className="text-content-subtle hover:text-content p-0.5 shrink-0"
      >
        <X weight="bold" size={16} />
      </button>
    </div>
  );
}
