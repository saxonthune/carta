import { useState, useCallback } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';
import { useNodes } from './useNodes';
import { getClipboardBounds, calculatePastePosition, transformPastedNodes } from '../utils/clipboardLogic';

interface UseClipboardOptions {
  selectedNodeIds: string[];
}

export interface UseClipboardResult {
  clipboard: Node[];
  copyNodes: (nodeIds?: string[]) => void;
  pasteNodes: (x?: number, y?: number) => void;
  canPaste: boolean;
}

export function useClipboard(options: UseClipboardOptions): UseClipboardResult {
  const { selectedNodeIds } = options;
  const { nodes, setNodes, getNextNodeId } = useNodes();
  const { screenToFlowPosition } = useReactFlow();
  const [clipboard, setClipboard] = useState<Node[]>([]);

  const copyNodes = useCallback(
    (nodeIdsToCopy?: string[]) => {
      const ids = nodeIdsToCopy || selectedNodeIds;
      if (ids.length === 0) return;

      const nodesToCopy = nodes.filter((n) => ids.includes(n.id));
      if (nodesToCopy.length > 0) {
        setClipboard(JSON.parse(JSON.stringify(nodesToCopy)));
      }
    },
    [nodes, selectedNodeIds]
  );

  const pasteNodes = useCallback(
    (x?: number, y?: number) => {
      if (clipboard.length === 0) return;

      const bounds = getClipboardBounds(clipboard);
      const basePosition = calculatePastePosition(x, y, bounds, screenToFlowPosition);
      const newNodes = transformPastedNodes(clipboard, basePosition, bounds, getNextNodeId);

      setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), ...newNodes]);
    },
    [clipboard, setNodes, screenToFlowPosition, getNextNodeId]
  );

  return {
    clipboard,
    copyNodes,
    pasteNodes,
    canPaste: clipboard.length > 0,
  };
}
