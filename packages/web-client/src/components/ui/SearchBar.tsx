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
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-content-subtle shrink-0"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
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
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
