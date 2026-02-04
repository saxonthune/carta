import { useState, useCallback } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';
import { useNodes } from './useNodes';
import { generateSemanticId } from '../utils/cartaFile';

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

      const minX = Math.min(...clipboard.map((n) => n.position.x));
      const minY = Math.min(...clipboard.map((n) => n.position.y));

      const basePosition =
        x !== undefined && y !== undefined
          ? screenToFlowPosition({ x, y })
          : { x: minX + 50, y: minY + 50 };

      const newNodes: Node[] = clipboard.map((clipNode) => {
        const newId = getNextNodeId();

        const offsetX = clipNode.position.x - minX;
        const offsetY = clipNode.position.y - minY;

        const position = {
          x: basePosition.x + offsetX,
          y: basePosition.y + offsetY,
        };

        // Generate new semantic ID for the copy
        const newSemanticId = (clipNode.data.constructType && typeof clipNode.data.constructType === 'string')
          ? generateSemanticId(clipNode.data.constructType)
          : `copy-${newId}`;

        return {
          ...clipNode,
          id: newId,
          position,
          selected: true, // Select pasted nodes so they appear on top
          data: {
            ...clipNode.data,
            label: clipNode.data.label ? `${clipNode.data.label} (copy)` : undefined,
            semanticId: newSemanticId,
          },
        };
      });

      // Deselect existing nodes and append new nodes to the end (React Flow z-index)
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
