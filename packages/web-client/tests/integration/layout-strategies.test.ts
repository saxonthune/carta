import { describe, it, expect } from 'vitest';
import {
  computeGridPositions,
  transformDirectionalPositions,
  computeWagonSnapPositions,
  normalizePositionsToContentArea,
} from '../../src/utils/layoutStrategies.js';

describe('computeGridPositions', () => {
  it('produces 2x2 grid with correct spacing for 4 items in 2 columns', () => {
    const items = [
      { id: 'a', x: 0, y: 0, width: 100, height: 50 },
      { id: 'b', x: 0, y: 0, width: 80, height: 60 },
      { id: 'c', x: 0, y: 0, width: 90, height: 55 },
      { id: 'd', x: 0, y: 0, width: 95, height: 50 },
    ];
    const contentTopY = 60;
    const padding = 20;
    const cols = 2;

    const result = computeGridPositions(items, cols, contentTopY, padding);

    // colWidth = max(100, 80, 90, 95) + 30 = 130
    // rowHeight = max(50, 60, 55, 50) + 30 = 90
    expect(result.get('a')).toEqual({ x: 20, y: 60 }); // col 0, row 0
    expect(result.get('b')).toEqual({ x: 150, y: 60 }); // col 1, row 0
    expect(result.get('c')).toEqual({ x: 20, y: 150 }); // col 0, row 1
    expect(result.get('d')).toEqual({ x: 150, y: 150 }); // col 1, row 1
  });

  it('produces 2x2 grid with last row having 1 item for 3 items in 2 columns', () => {
    const items = [
      { id: 'a', x: 0, y: 0, width: 100, height: 50 },
      { id: 'b', x: 0, y: 0, width: 100, height: 50 },
      { id: 'c', x: 0, y: 0, width: 100, height: 50 },
    ];
    const contentTopY = 60;
    const padding = 20;
    const cols = 2;

    const result = computeGridPositions(items, cols, contentTopY, padding);

    // colWidth = 100 + 30 = 130
    // rowHeight = 50 + 30 = 80
    expect(result.get('a')).toEqual({ x: 20, y: 60 }); // col 0, row 0
    expect(result.get('b')).toEqual({ x: 150, y: 60 }); // col 1, row 0
    expect(result.get('c')).toEqual({ x: 20, y: 140 }); // col 0, row 1
  });

  it('determines column width from widest item', () => {
    const items = [
      { id: 'a', x: 0, y: 0, width: 200, height: 50 }, // widest
      { id: 'b', x: 0, y: 0, width: 100, height: 50 },
    ];
    const contentTopY = 60;
    const padding = 20;
    const cols = 2;

    const result = computeGridPositions(items, cols, contentTopY, padding);

    // colWidth = 200 + 30 = 230
    expect(result.get('a')).toEqual({ x: 20, y: 60 });
    expect(result.get('b')).toEqual({ x: 250, y: 60 }); // 20 + 230 = 250
  });

  it('starts all y positions at contentTopY', () => {
    const items = [
      { id: 'a', x: 0, y: 0, width: 100, height: 50 },
      { id: 'b', x: 0, y: 0, width: 100, height: 50 },
    ];
    const contentTopY = 100;
    const padding = 20;
    const cols = 1;

    const result = computeGridPositions(items, cols, contentTopY, padding);

    // Single column, items stack vertically
    expect(result.get('a')?.y).toBe(100); // row 0 at contentTopY
    expect(result.get('b')?.y).toBe(180); // row 1 at contentTopY + rowHeight
  });
});

describe('transformDirectionalPositions', () => {
  it('returns positions unchanged for TB direction', () => {
    const tbPositions = new Map([
      ['a', { x: 10, y: 20 }],
      ['b', { x: 50, y: 60 }],
    ]);
    const itemDims = new Map([
      ['a', { width: 100, height: 50 }],
      ['b', { width: 100, height: 50 }],
    ]);

    const result = transformDirectionalPositions(tbPositions, 'TB', itemDims);

    expect(result.get('a')).toEqual({ x: 10, y: 20 });
    expect(result.get('b')).toEqual({ x: 50, y: 60 });
  });

  it('swaps x and y for LR direction', () => {
    const tbPositions = new Map([
      ['a', { x: 10, y: 20 }],
      ['b', { x: 50, y: 60 }],
    ]);
    const itemDims = new Map([
      ['a', { width: 100, height: 50 }],
      ['b', { width: 100, height: 50 }],
    ]);

    const result = transformDirectionalPositions(tbPositions, 'LR', itemDims);

    expect(result.get('a')).toEqual({ x: 20, y: 10 }); // swapped
    expect(result.get('b')).toEqual({ x: 60, y: 50 }); // swapped
  });

  it('mirrors y positions for BT direction', () => {
    const tbPositions = new Map([
      ['a', { x: 10, y: 20 }],
      ['b', { x: 50, y: 100 }], // maxY = 100
    ]);
    const itemDims = new Map([
      ['a', { width: 100, height: 50 }],
      ['b', { width: 100, height: 50 }],
    ]);

    const result = transformDirectionalPositions(tbPositions, 'BT', itemDims);

    // maxY = 100
    // a: y = 100 - 20 - 50 = 30
    // b: y = 100 - 100 - 50 = -50
    expect(result.get('a')).toEqual({ x: 10, y: 30 });
    expect(result.get('b')).toEqual({ x: 50, y: -50 });
  });

  it('swaps x and y then mirrors x for RL direction', () => {
    const tbPositions = new Map([
      ['a', { x: 10, y: 20 }],
      ['b', { x: 50, y: 100 }], // maxY = 100
    ]);
    const itemDims = new Map([
      ['a', { width: 100, height: 50 }],
      ['b', { width: 100, height: 50 }],
    ]);

    const result = transformDirectionalPositions(tbPositions, 'RL', itemDims);

    // maxY = 100
    // a: x = 100 - 20 - 50 = 30, y = 10
    // b: x = 100 - 100 - 50 = -50, y = 50
    expect(result.get('a')).toEqual({ x: 30, y: 10 });
    expect(result.get('b')).toEqual({ x: -50, y: 50 });
  });

  it('round-trip property: TB → positions → TB returns same positions', () => {
    const original = new Map([
      ['a', { x: 10, y: 20 }],
      ['b', { x: 50, y: 60 }],
    ]);
    const itemDims = new Map([
      ['a', { width: 100, height: 50 }],
      ['b', { width: 100, height: 50 }],
    ]);

    const transformed = transformDirectionalPositions(original, 'TB', itemDims);

    expect(transformed).toEqual(original);
  });
});

describe('computeWagonSnapPositions', () => {
  it('places wagon at (constructWidth + gap, 0) for construct with one wagon', () => {
    const children = [
      { id: 'construct1', type: 'construct', parentId: 'org1', data: {} },
    ];
    const allNodes = [
      { id: 'construct1', type: 'construct', parentId: 'org1', data: {} },
      { id: 'wagon1', type: 'organizer', parentId: 'construct1', data: { attachedToSemanticId: 'construct1' } },
    ];
    const getConstructWidth = (node: { id: string }) => (node.id === 'construct1' ? 200 : 100);
    const gap = 10;

    const result = computeWagonSnapPositions(children, allNodes, getConstructWidth, gap);

    expect(result).toEqual([
      { id: 'wagon1', position: { x: 210, y: 0 } }, // 200 + 10
    ]);
  });

  it('returns no patches for construct with no wagons', () => {
    const children = [
      { id: 'construct1', type: 'construct', parentId: 'org1', data: {} },
    ];
    const allNodes = [
      { id: 'construct1', type: 'construct', parentId: 'org1', data: {} },
    ];
    const getConstructWidth = () => 200;
    const gap = 10;

    const result = computeWagonSnapPositions(children, allNodes, getConstructWidth, gap);

    expect(result).toEqual([]);
  });

  it('skips organizer children (not constructs)', () => {
    const children = [
      { id: 'organizer1', type: 'organizer', parentId: 'org1', data: {} },
    ];
    const allNodes = [
      { id: 'organizer1', type: 'organizer', parentId: 'org1', data: {} },
      { id: 'wagon1', type: 'organizer', parentId: 'organizer1', data: { attachedToSemanticId: 'org1' } },
    ];
    const getConstructWidth = () => 200;
    const gap = 10;

    const result = computeWagonSnapPositions(children, allNodes, getConstructWidth, gap);

    // organizer1 is skipped, so wagon1 is not processed
    expect(result).toEqual([]);
  });

  it('skips wagon without attachedToSemanticId', () => {
    const children = [
      { id: 'construct1', type: 'construct', parentId: 'org1', data: {} },
    ];
    const allNodes = [
      { id: 'construct1', type: 'construct', parentId: 'org1', data: {} },
      { id: 'wagon1', type: 'organizer', parentId: 'construct1', data: {} }, // no attachedToSemanticId
    ];
    const getConstructWidth = () => 200;
    const gap = 10;

    const result = computeWagonSnapPositions(children, allNodes, getConstructWidth, gap);

    expect(result).toEqual([]);
  });
});

describe('normalizePositionsToContentArea', () => {
  it('shifts positions already at origin to (padding, contentTopY)', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 100, y: 50 }],
    ]);
    const contentTopY = 60;
    const padding = 20;

    const result = normalizePositionsToContentArea(positions, contentTopY, padding);

    expect(result.get('a')).toEqual({ x: 20, y: 60 }); // 0 - 0 + 20, 0 - 0 + 60
    expect(result.get('b')).toEqual({ x: 120, y: 110 }); // 100 - 0 + 20, 50 - 0 + 60
  });

  it('normalizes negative positions to start at (padding, contentTopY)', () => {
    const positions = new Map([
      ['a', { x: -50, y: -30 }],
      ['b', { x: 50, y: 20 }],
    ]);
    const contentTopY = 60;
    const padding = 20;

    const result = normalizePositionsToContentArea(positions, contentTopY, padding);

    // minX = -50, minY = -30
    expect(result.get('a')).toEqual({ x: 20, y: 60 }); // -50 - (-50) + 20, -30 - (-30) + 60
    expect(result.get('b')).toEqual({ x: 120, y: 110 }); // 50 - (-50) + 20, 20 - (-30) + 60
  });

  it('preserves relative spacing after normalization', () => {
    const positions = new Map([
      ['a', { x: 10, y: 20 }],
      ['b', { x: 110, y: 120 }],
    ]);
    const contentTopY = 60;
    const padding = 20;

    const result = normalizePositionsToContentArea(positions, contentTopY, padding);

    const aPos = result.get('a')!;
    const bPos = result.get('b')!;

    // Relative spacing should be preserved
    expect(bPos.x - aPos.x).toBe(100); // original spacing
    expect(bPos.y - aPos.y).toBe(100); // original spacing
  });

  it('returns empty map for empty input', () => {
    const positions = new Map<string, { x: number; y: number }>();
    const contentTopY = 60;
    const padding = 20;

    const result = normalizePositionsToContentArea(positions, contentTopY, padding);

    expect(result.size).toBe(0);
  });
});
