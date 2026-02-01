interface ViewToggleProps {
  mode: 'instances' | 'metamap';
  onChange: (mode: 'instances' | 'metamap') => void;
}

export default function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-lg bg-surface border border-border shadow-sm overflow-hidden">
      <button
        className={`px-4 py-1.5 text-sm font-medium cursor-pointer border-none transition-colors ${
          mode === 'instances'
            ? 'bg-accent text-white'
            : 'bg-surface text-content-muted hover:bg-surface-alt hover:text-content'
        }`}
        onClick={() => onChange('instances')}
      >
        Map
      </button>
      <button
        className={`px-4 py-1.5 text-sm font-medium cursor-pointer border-none transition-colors ${
          mode === 'metamap'
            ? 'bg-accent text-white'
            : 'bg-surface text-content-muted hover:bg-surface-alt hover:text-content'
        }`}
        onClick={() => onChange('metamap')}
      >
        Metamap
      </button>
    </div>
  );
}
