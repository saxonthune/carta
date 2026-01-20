interface NodeControlsProps {
  selectedCount: number;
  onRename: () => void;
  onDelete: () => void;
  onCopy: () => void;
}

export default function NodeControls({
  selectedCount,
  onRename,
  onDelete,
  onCopy,
}: NodeControlsProps) {
  const canRename = selectedCount === 1;

  return (
    <div className="absolute top-[120px] left-2.5 flex flex-col shadow-md rounded overflow-hidden z-[5]">
      <button
        className={`flex justify-center items-center w-8 h-8 p-1.5 border-none bg-white text-gray-800 cursor-pointer border-b border-gray-200 hover:bg-gray-100 transition-colors ${!canRename ? 'text-gray-400 cursor-not-allowed opacity-50 hover:bg-white' : ''}`}
        onClick={onRename}
        disabled={!canRename}
        title={canRename ? "Rename (F2)" : "Select single node to rename"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      <button
        className="flex justify-center items-center w-8 h-8 p-1.5 border-none bg-white text-gray-800 cursor-pointer border-b border-gray-200 hover:bg-gray-100 transition-colors"
        onClick={onCopy}
        title={`Copy ${selectedCount > 1 ? `(${selectedCount} nodes)` : ''} (Ctrl+C)`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
      <button
        className="flex justify-center items-center w-8 h-8 p-1.5 border-none bg-white text-red-600 cursor-pointer hover:bg-red-50 transition-colors"
        onClick={onDelete}
        title={`Delete ${selectedCount > 1 ? `(${selectedCount} nodes)` : ''} (Del)`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4"
        >
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}
