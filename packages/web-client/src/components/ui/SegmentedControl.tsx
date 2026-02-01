interface SegmentedControlOption<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div className={`inline-flex rounded-lg bg-surface-inset shadow-sm overflow-hidden ${className}`}>
      {options.map((option) => (
        <button
          key={option.id}
          className={`px-4 py-1.5 text-sm font-medium cursor-pointer border-none transition-colors ${
            value === option.id
              ? 'bg-accent text-white'
              : 'bg-transparent text-content-muted hover:text-content'
          }`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
