import { useCallback, useEffect, useRef } from 'react';

export type ContextMenuType = 'pane' | 'node' | 'edge';

interface ContextMenuProps {
  x: number;
  y: number;
  type: ContextMenuType;
  nodeId?: string;
  edgeId?: string;
  selectedCount: number;
  onAddNode: (x: number, y: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteSelected: () => void;
  onDeleteEdge?: (edgeId: string) => void;
  onCopyNodes: (nodeIds?: string[]) => void;
  onPasteNodes: (x: number, y: number) => void;
  canPaste: boolean;
  onClose: () => void;
}

export default function ContextMenu({
  x,
  y,
  type,
  nodeId,
  edgeId,
  selectedCount,
  onAddNode,
  onDeleteNode,
  onDeleteSelected,
  onDeleteEdge,
  onCopyNodes,
  onPasteNodes,
  canPaste,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleAddNode = useCallback(() => {
    onAddNode(x, y);
    onClose();
  }, [x, y, onAddNode, onClose]);

  const handleDeleteNode = useCallback(() => {
    if (nodeId) {
      onDeleteNode(nodeId);
    }
    onClose();
  }, [nodeId, onDeleteNode, onClose]);

  const handleDeleteSelected = useCallback(() => {
    onDeleteSelected();
    onClose();
  }, [onDeleteSelected, onClose]);

  const handleCopyNodes = useCallback(() => {
    onCopyNodes();
    onClose();
  }, [onCopyNodes, onClose]);

  const handlePasteNodes = useCallback(() => {
    onPasteNodes(x, y);
    onClose();
  }, [x, y, onPasteNodes, onClose]);

  const handleDeleteEdge = useCallback(() => {
    if (edgeId && onDeleteEdge) {
      onDeleteEdge(edgeId);
    }
    onClose();
  }, [edgeId, onDeleteEdge, onClose]);

  const showMultipleSelected = selectedCount > 1;

  return (
    <div
      ref={menuRef}
      className="absolute z-[1000] bg-white rounded-lg shadow-lg overflow-hidden min-w-[150px]"
      style={{ left: x, top: y }}
    >
      {type === 'pane' && (
        <>
          <button
            className="block w-full px-4 py-2.5 border-none bg-white text-gray-800 text-sm text-left cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={handleAddNode}
          >
            + Add Node Here
          </button>
          {canPaste && (
            <button
              className="block w-full px-4 py-2.5 border-none bg-white text-gray-800 text-sm text-left cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={handlePasteNodes}
            >
              Paste
            </button>
          )}
        </>
      )}
      {type === 'node' && (
        <>
          <button
            className="block w-full px-4 py-2.5 border-none bg-white text-gray-800 text-sm text-left cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={handleCopyNodes}
          >
            Copy {showMultipleSelected ? `(${selectedCount})` : ''}
          </button>
          {showMultipleSelected ? (
            <button
              className="block w-full px-4 py-2.5 border-none bg-white text-red-600 text-sm text-left cursor-pointer hover:bg-red-50 transition-colors"
              onClick={handleDeleteSelected}
            >
              Delete {selectedCount} nodes
            </button>
          ) : (
            <button
              className="block w-full px-4 py-2.5 border-none bg-white text-red-600 text-sm text-left cursor-pointer hover:bg-red-50 transition-colors"
              onClick={handleDeleteNode}
            >
              Delete
            </button>
          )}
        </>
      )}
      {type === 'edge' && (
        <button
          className="block w-full px-4 py-2.5 border-none bg-white text-red-600 text-sm text-left cursor-pointer hover:bg-red-50 transition-colors"
          onClick={handleDeleteEdge}
        >
          Delete Connection
        </button>
      )}
    </div>
  );
}
