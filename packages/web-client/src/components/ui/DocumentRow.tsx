import { FileText } from '@phosphor-icons/react';

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
      <FileText weight="regular" size={16} className="text-content-muted shrink-0" />
      <div className="flex-1 min-w-0 flex items-baseline gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-content truncate">{title}</div>
          <div className="text-xs text-content-muted">
            {updatedAt}{nodeCount > 0 ? ` · ${nodeCount} node${nodeCount === 1 ? '' : 's'}` : ''}
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
