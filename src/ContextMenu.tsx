import { useCallback, useEffect, useRef, useState } from 'react';

export type ContextMenuType = 'pane' | 'node' | 'edge';

export interface RelatedConstructOption {
  constructType: string;
  displayName: string;
  color: string;
  fromPortId?: string;
  toPortId?: string;
  label?: string;
}

interface ContextMenuProps {
  x: number;
  y: number;
  type: ContextMenuType;
  nodeId?: string;
  edgeId?: string;
  selectedCount: number;
  relatedConstructs?: RelatedConstructOption[];
  onAddNode: (x: number, y: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteSelected: () => void;
  onDeleteEdge?: (edgeId: string) => void;
  onCopyNodes: (nodeIds?: string[]) => void;
  onPasteNodes: (x: number, y: number) => void;
  onAddRelatedConstruct?: (constructType: string, fromPortId?: string, toPortId?: string) => void;
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
  relatedConstructs,
  onAddNode,
  onDeleteNode,
  onDeleteSelected,
  onDeleteEdge,
  onCopyNodes,
  onPasteNodes,
  onAddRelatedConstruct,
  canPaste,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showRelatedSubmenu, setShowRelatedSubmenu] = useState(false);

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

  const handleAddRelatedConstruct = useCallback((constructType: string, fromPortId?: string, toPortId?: string) => {
    if (onAddRelatedConstruct) {
      onAddRelatedConstruct(constructType, fromPortId, toPortId);
    }
    onClose();
  }, [onAddRelatedConstruct, onClose]);

  const showMultipleSelected = selectedCount > 1;
  const hasRelatedConstructs = relatedConstructs && relatedConstructs.length > 0;

  return (
    <div
      ref={menuRef}
      className="absolute z-[1000] bg-white rounded-lg shadow-lg min-w-[150px]"
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
          {!showMultipleSelected && hasRelatedConstructs && (
            <div
              className="relative"
              onMouseEnter={() => setShowRelatedSubmenu(true)}
              onMouseLeave={() => setShowRelatedSubmenu(false)}
            >
              <button
                className="block w-full px-4 py-2.5 border-none bg-white text-gray-800 text-sm text-left cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between"
              >
                <span>Add Related {relatedConstructs!.length > 0 ? `(${relatedConstructs!.length})` : ''}</span>
                <svg className="w-4 h-4 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              {showRelatedSubmenu && (
                <div className="absolute left-full top-0 bg-white shadow-lg overflow-hidden min-w-[180px] ml-1">
                  {relatedConstructs!.map((related, index) => (
                    <button
                      key={index}
                      className="block w-full px-4 py-2.5 border-none border-l-[3px] border-l-transparent bg-white text-gray-800 text-sm text-left cursor-pointer hover:bg-gray-100 transition-colors"
                      style={{ borderLeftColor: related.color }}
                      onClick={() => handleAddRelatedConstruct(related.constructType, related.fromPortId, related.toPortId)}
                    >
                      {related.label || related.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
