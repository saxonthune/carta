import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseSelectionOptions {
  onSelectionChange?: (selectedIds: string[]) => void;
}

export interface UseSelectionResult {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  isSelected: (id: string) => boolean;
  onNodePointerDown: (nodeId: string, event: React.PointerEvent) => void;
  clearSelection: () => void;
  mergeBoxSelection: (ids: string[]) => void;
}

export function useSelection(options: UseSelectionOptions): UseSelectionResult {
  const [selectedIds, setSelectedIdsInternal] = useState<string[]>([]);
  const onSelectionChangeRef = useRef(options.onSelectionChange);

  // Keep ref up to date
  useEffect(() => {
    onSelectionChangeRef.current = options.onSelectionChange;
  }, [options.onSelectionChange]);

  const setSelectedIds = useCallback((ids: string[]) => {
    setSelectedIdsInternal(ids);
    onSelectionChangeRef.current?.(ids);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, [setSelectedIds]);

  const isSelected = useCallback(
    (id: string) => {
      return selectedIds.includes(id);
    },
    [selectedIds]
  );

  const mergeBoxSelection = useCallback(
    (ids: string[]) => {
      setSelectedIds(ids);
    },
    [setSelectedIds]
  );

  const onNodePointerDown = useCallback(
    (nodeId: string, event: React.PointerEvent) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        // Toggle: add if not selected, remove if selected
        if (selectedIds.includes(nodeId)) {
          setSelectedIds(selectedIds.filter((id) => id !== nodeId));
        } else {
          setSelectedIds([...selectedIds, nodeId]);
        }
      } else {
        // Replace selection with this node
        setSelectedIds([nodeId]);
      }
    },
    [selectedIds, setSelectedIds]
  );

  return {
    selectedIds,
    setSelectedIds,
    isSelected,
    onNodePointerDown,
    clearSelection,
    mergeBoxSelection,
  };
}
