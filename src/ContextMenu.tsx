import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { SchemaGroup } from './constructs/types';

export type ContextMenuType = 'pane' | 'node' | 'edge';

export interface RelatedConstructOption {
  constructType: string;
  displayName: string;
  color: string;
  fromPortId?: string;
  toPortId?: string;
  label?: string;
  groupId?: string;
}

// Delay before closing submenus (allows diagonal mouse movement)
const SUBMENU_CLOSE_DELAY = 100;

interface ContextMenuProps {
  x: number;
  y: number;
  type: ContextMenuType;
  nodeId?: string;
  edgeId?: string;
  selectedCount: number;
  relatedConstructs?: RelatedConstructOption[];
  schemaGroups?: SchemaGroup[];
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

// Group related constructs by their groupId
interface GroupedRelated {
  group: SchemaGroup | null;
  items: RelatedConstructOption[];
}

export default function ContextMenu({
  x,
  y,
  type,
  nodeId,
  edgeId,
  selectedCount,
  relatedConstructs,
  schemaGroups = [],
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
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const relatedSubmenuTimeout = useRef<number | null>(null);
  const groupSubmenuTimeout = useRef<number | null>(null);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (relatedSubmenuTimeout.current) clearTimeout(relatedSubmenuTimeout.current);
      if (groupSubmenuTimeout.current) clearTimeout(groupSubmenuTimeout.current);
    };
  }, []);

  const handleRelatedSubmenuEnter = useCallback(() => {
    if (relatedSubmenuTimeout.current) {
      clearTimeout(relatedSubmenuTimeout.current);
      relatedSubmenuTimeout.current = null;
    }
    setShowRelatedSubmenu(true);
  }, []);

  const handleRelatedSubmenuLeave = useCallback(() => {
    relatedSubmenuTimeout.current = window.setTimeout(() => {
      setShowRelatedSubmenu(false);
      setExpandedGroup(null);
    }, SUBMENU_CLOSE_DELAY);
  }, []);

  const handleGroupEnter = useCallback((groupId: string) => {
    if (groupSubmenuTimeout.current) {
      clearTimeout(groupSubmenuTimeout.current);
      groupSubmenuTimeout.current = null;
    }
    setExpandedGroup(groupId);
  }, []);

  const handleGroupLeave = useCallback(() => {
    groupSubmenuTimeout.current = window.setTimeout(() => {
      setExpandedGroup(null);
    }, SUBMENU_CLOSE_DELAY);
  }, []);

  // Group related constructs by their groupId
  const groupedRelated = useMemo((): GroupedRelated[] => {
    if (!relatedConstructs || relatedConstructs.length === 0) return [];

    const groupMap = new Map<string | null, RelatedConstructOption[]>();

    // Build lookup for groups
    const groupLookup = new Map(schemaGroups.map(g => [g.id, g]));

    for (const item of relatedConstructs) {
      const key = item.groupId || null;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(item);
    }

    // Convert to array, with grouped items first, then ungrouped
    const result: GroupedRelated[] = [];
    for (const [groupId, items] of groupMap) {
      if (groupId) {
        const group = groupLookup.get(groupId) || null;
        result.push({ group, items });
      }
    }
    // Add ungrouped items at the end
    const ungrouped = groupMap.get(null);
    if (ungrouped) {
      result.push({ group: null, items: ungrouped });
    }

    return result;
  }, [relatedConstructs, schemaGroups]);

  // Determine if we need nested submenus (multiple groups)
  const hasMultipleGroups = groupedRelated.length > 1 || (groupedRelated.length === 1 && groupedRelated[0].group !== null);

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
      className="fixed z-[1000] bg-white rounded-lg shadow-lg min-w-[150px]"
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
              onMouseEnter={handleRelatedSubmenuEnter}
              onMouseLeave={handleRelatedSubmenuLeave}
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
                <div className="absolute left-full top-0 bg-white rounded-lg shadow-lg min-w-[180px]">
                  {hasMultipleGroups ? (
                    // Render grouped submenus
                    groupedRelated.map((groupData, groupIndex) => {
                      const groupKey = groupData.group?.id || 'ungrouped';
                      return (
                        <div
                          key={groupKey}
                          className="relative"
                          onMouseEnter={() => handleGroupEnter(groupKey)}
                          onMouseLeave={handleGroupLeave}
                        >
                          <button
                            className="block w-full px-4 py-2.5 border-none bg-white text-gray-800 text-sm text-left cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between"
                            style={groupData.group ? { borderLeft: `3px solid ${groupData.group.color}` } : undefined}
                          >
                            <span>{groupData.group?.name || 'Other'} ({groupData.items.length})</span>
                            <svg className="w-4 h-4 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                          {expandedGroup === groupKey && (
                            <div className="absolute left-full top-0 bg-white rounded-lg shadow-lg min-w-[180px]">
                              {groupData.items.map((related, index) => (
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
                          {groupIndex < groupedRelated.length - 1 && (
                            <div className="border-t border-gray-100 my-0.5" />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    // Render flat list (no groups or single ungrouped set)
                    relatedConstructs!.map((related, index) => (
                      <button
                        key={index}
                        className="block w-full px-4 py-2.5 border-none border-l-[3px] border-l-transparent bg-white text-gray-800 text-sm text-left cursor-pointer hover:bg-gray-100 transition-colors"
                        style={{ borderLeftColor: related.color }}
                        onClick={() => handleAddRelatedConstruct(related.constructType, related.fromPortId, related.toPortId)}
                      >
                        {related.label || related.displayName}
                      </button>
                    ))
                  )}
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
