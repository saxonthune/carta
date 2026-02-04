interface FolderRowProps {
  name: string;
  onClick: () => void;
}

export default function FolderRow({ name, onClick }: FolderRowProps) {
  return (
    <button
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-surface-depth-3/50 transition-colors border-none bg-transparent text-left"
      onClick={onClick}
    >
      <svg className="w-5 h-5 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <span className="text-sm font-medium text-content flex-1 min-w-0 truncate">{name}</span>
      <svg className="w-4 h-4 text-content-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}
