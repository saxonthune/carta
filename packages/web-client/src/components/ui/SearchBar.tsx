import { MagnifyingGlass, X } from '@phosphor-icons/react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
}

/**
 * Reusable search bar primitive matching the design from Metamap.
 * Includes search icon, input, and clear button.
 */
export default function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  className = '',
}: SearchBarProps) {
  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <div
      className={`flex items-center gap-2 bg-surface rounded-lg px-3 py-1.5 border border-border-subtle ${className}`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
    >
      <MagnifyingGlass weight="regular" size={18} className="text-content-subtle shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            handleClear();
          }
        }}
        placeholder={placeholder}
        className="bg-transparent border-none outline-none text-content text-sm w-40 placeholder:text-content-subtle"
      />
      {value.trim() && (
        <button
          onClick={handleClear}
          className="text-content-subtle hover:text-content p-0.5 shrink-0 -mr-1"
        >
          <X weight="bold" size={16} />
        </button>
      )}
    </div>
  );
}
