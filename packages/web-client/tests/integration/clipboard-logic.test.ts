/**
 * Test: Clipboard Logic Pure Functions
 *
 * Unit tests for pure clipboard paste-positioning and node-cloning functions.
 * These functions are extracted from useClipboard.ts and have no React dependencies.
 */

import { describe, it, expect, vi } from 'vitest';
import { getClipboardBounds, calculatePastePosition, transformPastedNodes } from '../../src/utils/clipboardLogic';
import type { Node } from '@xyflow/react';

describe('getClipboardBounds', () => {
  it('returns bounds equal to position for single node', () => {
    const nodes: Node[] = [
      { id: '1', position: { x: 100, y: 200 }, data: {} },
    ];
    const bounds = getClipboardBounds(nodes);
    expect(bounds).toEqual({ minX: 100, minY: 200 });
  });

  it('returns minimum x and y across multiple nodes', () => {
    const nodes: Node[] = [
      { id: '1', position: { x: 100, y: 200 }, data: {} },
      { id: '2', position: { x: 50, y: 300 }, data: {} },
      { id: '3', position: { x: 150, y: 100 }, data: {} },
    ];
    const bounds = getClipboardBounds(nodes);
    expect(bounds).toEqual({ minX: 50, minY: 100 });
  });

  it('handles negative positions correctly', () => {
    const nodes: Node[] = [
      { id: '1', position: { x: -50, y: 100 }, data: {} },
      { id: '2', position: { x: 100, y: -200 }, data: {} },
      { id: '3', position: { x: 0, y: 0 }, data: {} },
    ];
    const bounds = getClipboardBounds(nodes);
    expect(bounds).toEqual({ minX: -50, minY: -200 });
  });
});

describe('calculatePastePosition', () => {
  it('uses screenToFlowPosition when explicit coordinates provided', () => {
    const mockScreenToFlow = vi.fn((pos) => ({ x: pos.x + 10, y: pos.y + 20 }));
    const bounds = { minX: 100, minY: 200 };

    const result = calculatePastePosition(500, 600, bounds, mockScreenToFlow);

    expect(mockScreenToFlow).toHaveBeenCalledWith({ x: 500, y: 600 });
    expect(result).toEqual({ x: 510, y: 620 });
  });

  it('returns bounds offset by (50, 50) when no explicit coordinates', () => {
    const mockScreenToFlow = vi.fn();
    const bounds = { minX: 100, minY: 200 };

    const result = calculatePastePosition(undefined, undefined, bounds, mockScreenToFlow);

    expect(mockScreenToFlow).not.toHaveBeenCalled();
    expect(result).toEqual({ x: 150, y: 250 });
  });

  it('uses explicit coordinates even when bounds are negative', () => {
    const mockScreenToFlow = vi.fn((pos) => ({ x: pos.x, y: pos.y }));
    const bounds = { minX: -100, minY: -200 };

    const result = calculatePastePosition(0, 0, bounds, mockScreenToFlow);

    expect(mockScreenToFlow).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(result).toEqual({ x: 0, y: 0 });
  });
});

describe('transformPastedNodes', () => {
  it('assigns new IDs to all nodes', () => {
    let counter = 0;
    const getNextNodeId = () => `new-${++counter}`;

    const clipboardNodes: Node[] = [
      { id: 'old-1', position: { x: 0, y: 0 }, data: {} },
      { id: 'old-2', position: { x: 100, y: 100 }, data: {} },
    ];
    const bounds = { minX: 0, minY: 0 };
    const basePosition = { x: 200, y: 200 };

    const result = transformPastedNodes(clipboardNodes, basePosition, bounds, getNextNodeId);

    expect(result[0].id).toBe('new-1');
    expect(result[1].id).toBe('new-2');
  });

  it('preserves relative spacing between nodes', () => {
    const getNextNodeId = () => 'new-id';

    const clipboardNodes: Node[] = [
      { id: '1', position: { x: 100, y: 200 }, data: {} },
      { id: '2', position: { x: 150, y: 250 }, data: {} },
      { id: '3', position: { x: 100, y: 300 }, data: {} },
    ];
    const bounds = { minX: 100, minY: 200 };
    const basePosition = { x: 500, y: 600 };

    const result = transformPastedNodes(clipboardNodes, basePosition, bounds, getNextNodeId);

    // First node should be at basePosition (it's at the bounds origin)
    expect(result[0].position).toEqual({ x: 500, y: 600 });
    // Second node is offset by (50, 50) from first
    expect(result[1].position).toEqual({ x: 550, y: 650 });
    // Third node is offset by (0, 100) from first
    expect(result[2].position).toEqual({ x: 500, y: 700 });
  });

  it('generates semantic IDs based on constructType', () => {
    const getNextNodeId = () => 'new-123';

    // Mock generateSemanticId to return a predictable value
    vi.mock('../../src/utils/cartaFile', () => ({
      generateSemanticId: vi.fn((type) => `${type.toLowerCase()}-sem-id`),
    }));

    const clipboardNodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: { constructType: 'Service' } },
    ];
    const bounds = { minX: 0, minY: 0 };
    const basePosition = { x: 100, y: 100 };

    const result = transformPastedNodes(clipboardNodes, basePosition, bounds, getNextNodeId);

    // Should generate semantic ID from construct type
    expect(typeof result[0].data.semanticId).toBe('string');
    expect(result[0].data.semanticId).toBeTruthy();
  });

  it('uses copy-{id} for nodes without constructType', () => {
    const getNextNodeId = () => 'new-456';

    const clipboardNodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: {} },
    ];
    const bounds = { minX: 0, minY: 0 };
    const basePosition = { x: 100, y: 100 };

    const result = transformPastedNodes(clipboardNodes, basePosition, bounds, getNextNodeId);

    expect(result[0].data.semanticId).toBe('copy-new-456');
  });

  it('appends (copy) to labels, undefined for nodes without labels', () => {
    const getNextNodeId = () => 'new-id';

    const clipboardNodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: { label: 'My Node' } },
      { id: '2', position: { x: 50, y: 50 }, data: {} },
      { id: '3', position: { x: 100, y: 100 }, data: { label: 'Another' } },
    ];
    const bounds = { minX: 0, minY: 0 };
    const basePosition = { x: 200, y: 200 };

    const result = transformPastedNodes(clipboardNodes, basePosition, bounds, getNextNodeId);

    expect(result[0].data.label).toBe('My Node (copy)');
    expect(result[1].data.label).toBeUndefined();
    expect(result[2].data.label).toBe('Another (copy)');
  });

  it('sets all output nodes to selected: true', () => {
    const getNextNodeId = () => 'new-id';

    const clipboardNodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: {}, selected: false },
      { id: '2', position: { x: 50, y: 50 }, data: {}, selected: true },
    ];
    const bounds = { minX: 0, minY: 0 };
    const basePosition = { x: 100, y: 100 };

    const result = transformPastedNodes(clipboardNodes, basePosition, bounds, getNextNodeId);

    expect(result[0].selected).toBe(true);
    expect(result[1].selected).toBe(true);
  });

  it('maintains exact spacing when pasting two nodes', () => {
    const getNextNodeId = () => 'new-id';

    const clipboardNodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: {} },
      { id: '2', position: { x: 200, y: 150 }, data: {} },
    ];
    const bounds = { minX: 0, minY: 0 };
    const basePosition = { x: 1000, y: 1000 };

    const result = transformPastedNodes(clipboardNodes, basePosition, bounds, getNextNodeId);

    // Calculate distances
    const inputDistance = {
      x: clipboardNodes[1].position.x - clipboardNodes[0].position.x,
      y: clipboardNodes[1].position.y - clipboardNodes[0].position.y,
    };
    const outputDistance = {
      x: result[1].position.x - result[0].position.x,
      y: result[1].position.y - result[0].position.y,
    };

    expect(outputDistance).toEqual(inputDistance);
  });
});
