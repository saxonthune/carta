import { Folder, CaretRight } from '@phosphor-icons/react';

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
      <Folder weight="regular" size={16} className="text-amber-500 shrink-0" />
      <span className="text-sm font-medium text-content flex-1 min-w-0 truncate">{name}</span>
      <CaretRight weight="bold" size={14} className="text-content-muted shrink-0" />
    </button>
  );
}
