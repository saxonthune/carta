interface DocumentRowProps {
  title: string;
  updatedAt: string;
  nodeCount: number;
  filename?: string;
  onClick: () => void;
}

export default function DocumentRow({ title, updatedAt, nodeCount, filename, onClick }: DocumentRowProps) {
  return (
    <button
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-surface-depth-3/50 transition-colors border-none bg-transparent text-left"
      onClick={onClick}
    >
      <svg className="w-5 h-5 text-content-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <div className="flex-1 min-w-0 flex items-baseline gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-content truncate">{title}</div>
          <div className="text-xs text-content-muted">
            {updatedAt} · {nodeCount} node{nodeCount === 1 ? '' : 's'}
          </div>
        </div>
        {filename && (
          <div className="text-xs text-content-muted font-mono truncate">
            {filename}
          </div>
        )}
      </div>
    </button>
  );
}
