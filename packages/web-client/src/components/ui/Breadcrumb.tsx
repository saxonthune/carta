interface BreadcrumbProps {
  segments: string[];
  onNavigate: (index: number) => void;
}

export default function Breadcrumb({ segments, onNavigate }: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button
        className="text-sm text-content-muted hover:text-content px-1.5 py-0.5 rounded hover:bg-surface-depth-3/50 transition-colors border-none bg-transparent cursor-pointer"
        onClick={() => onNavigate(-1)}
      >
        /
      </button>
      {segments.map((segment, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-content-muted/50">/</span>
          <button
            className="text-sm text-content-muted hover:text-content px-1.5 py-0.5 rounded hover:bg-surface-depth-3/50 transition-colors border-none bg-transparent cursor-pointer"
            onClick={() => onNavigate(i)}
          >
            {segment}
          </button>
        </span>
      ))}
    </div>
  );
}
